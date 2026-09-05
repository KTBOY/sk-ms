import { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { chatComplete } from '../../core/ai';
import {
  buildExtractionPrompt, buildImportPlan, finalizeBatch, gatherProjectText, parseExtraction,
  type ExtractionResult, type ImportPlan,
} from '../../core/aiGraph';
import { Button, Checkbox, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { IconAlert, IconLink, IconSparkles } from '../../components/icons';

/**
 * AI 建谱：粘贴既有正文/大纲 → AI 抽取实体 → 逐条勾选确认 → 一批入库。
 * 解决图谱冷启动：存量作品不必手动逐个录入实体。
 */

interface Row { key: string; title: string; detail: string; exists: boolean }

const relType = (r: { type: string; strength: number }) => `${r.type} · ${r.strength}级`;

export function BuildFromTextModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const importGraph = useProjectStore((s) => s.importGraph);
  const pushToast = useUIStore((s) => s.pushToast);
  const navigate = useUIStore((s) => s.navigate);

  const [step, setStep] = useState<'input' | 'review'>('input');
  const [pasted, setPasted] = useState('');
  const [includeChapters, setIncludeChapters] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());

  const reset = () => {
    setStep('input'); setPasted(''); setIncludeChapters(false); setBusy(false);
    setError(null); setPlan(null); setExcluded(new Set());
  };
  const close = () => { onClose(); setTimeout(reset, 200); };

  const rows = useMemo<Array<{ kind: string; label: string; items: Row[] }>>(() => {
    if (!plan) return [];
    const charName = (id: string | null) =>
      id ? (project?.characters.find((c) => c.id === id)?.name ?? plan.batch.characters.find((c) => c.id === id)?.name ?? '?') : '';
    const locName = (id: string | null) =>
      id ? (project?.locations.find((l) => l.id === id)?.name ?? plan.batch.locations.find((l) => l.id === id)?.name ?? '?') : '';
    const facName = (id: string | null) =>
      id ? (project?.factions.find((f) => f.id === id)?.name ?? plan.batch.factions.find((f) => f.id === id)?.name ?? '?') : '';

    const exists = (name: string, kind: 'character' | 'location' | 'faction' | 'item' | 'event') => {
      if (!project) return false;
      if (kind === 'character') return project.characters.some((c) => c.name === name || c.aliases.includes(name));
      if (kind === 'location') return project.locations.some((x) => x.name === name);
      if (kind === 'faction') return project.factions.some((x) => x.name === name);
      if (kind === 'item') return project.items.some((x) => x.name === name);
      return project.events.some((x) => x.name === name);
    };

    return [
      {
        kind: 'character', label: `人物（${plan.counts.characters}）`,
        items: plan.batch.characters.map((c) => ({
          key: `character:${c.name}`, title: `${c.name}（${c.role}）`, exists: exists(c.name, 'character'),
          detail: [c.factionId ? `势力：${facName(c.factionId)}` : '', c.personality, c.background, c.goals]
            .filter(Boolean).join(' · ').slice(0, 80),
        })),
      },
      {
        kind: 'relation', label: `关系（${plan.counts.relations}）`,
        items: plan.batch.relations.map((r) => ({
          key: `relation:${r.fromId}-${r.toId}`, exists: false,
          title: `${charName(r.fromId)} —${relType(r)}— ${charName(r.toId)}`,
          detail: r.note.slice(0, 80),
        })),
      },
      {
        kind: 'event', label: `事件（${plan.counts.events}）`,
        items: plan.batch.events.map((e) => ({
          key: `event:${e.name}`, exists: exists(e.name, 'event'),
          title: e.name, detail: [e.timeLabel, locName(e.locationId), e.description].filter(Boolean).join(' · ').slice(0, 80),
        })),
      },
      {
        kind: 'item', label: `物品（${plan.counts.items}）`,
        items: plan.batch.items.map((i) => ({
          key: `item:${i.name}`, exists: exists(i.name, 'item'),
          title: i.name, detail: [i.type, i.rarity, i.ownerId ? `持有：${charName(i.ownerId)}` : '', i.description]
            .filter(Boolean).join(' · ').slice(0, 80),
        })),
      },
      {
        kind: 'location', label: `地点（${plan.counts.locations}）`,
        items: plan.batch.locations.map((l) => ({
          key: `location:${l.name}`, exists: exists(l.name, 'location'),
          title: l.name, detail: [l.region, l.parentId ? `上级：${locName(l.parentId)}` : '', l.description]
            .filter(Boolean).join(' · ').slice(0, 80),
        })),
      },
      {
        kind: 'faction', label: `势力（${plan.counts.factions}）`,
        items: plan.batch.factions.map((f) => ({
          key: `faction:${f.name}`, exists: exists(f.name, 'faction'),
          title: `${f.name}（${f.type}·${f.stance}）`, detail: f.description.slice(0, 80),
        })),
      },
    ].filter((sec) => sec.items.length > 0);
  }, [plan, project]);

  if (!project) return null;

  const toggle = (key: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const runExtract = async () => {
    const text = gatherProjectText(project.chapters, includeChapters, pasted.trim());
    if (!text) { setError('请粘贴正文，或勾选「使用已写章节正文」'); return; }
    setBusy(true);
    setError(null);
    try {
      const raw = await chatComplete(project.settings.ai, buildExtractionPrompt(project, text));
      const result: ExtractionResult = parseExtraction(raw);
      const p = buildImportPlan(project, result);
      if (p.batch.characters.length + p.batch.events.length + p.batch.items.length
        + p.batch.locations.length + p.batch.factions.length + p.batch.relations.length === 0) {
        setError('抽取结果与现有图谱完全重复，没有需要导入的内容');
        return;
      }
      setPlan(p);
      setExcluded(new Set());
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 调用失败');
    } finally {
      setBusy(false);
    }
  };

  const doImport = () => {
    if (!plan) return;
    const batch = finalizeBatch(plan, excluded);
    importGraph(batch);
    const total = batch.characters.length + batch.relations.length + batch.events.length
      + batch.items.length + batch.locations.length + batch.factions.length;
    pushToast(
      `已入库 ${total} 项：人物 ${batch.characters.length} · 关系 ${batch.relations.length} · 事件 ${batch.events.length}`
      + ` · 物品 ${batch.items.length} · 地点 ${batch.locations.length} · 势力 ${batch.factions.length}`,
      'success',
    );
    if (plan.skipped.length) pushToast(`与图谱重名跳过：${plan.skipped.slice(0, 6).join('、')}${plan.skipped.length > 6 ? '…' : ''}`, 'info');
    close();
  };

  const checkedCount = plan
    ? plan.batch.characters.filter((x) => !excluded.has(`character:${x.name}`)).length
    + plan.batch.relations.filter((r) => !excluded.has(`relation:${r.fromId}-${r.toId}`)).length
    + plan.batch.events.filter((x) => !excluded.has(`event:${x.name}`)).length
    + plan.batch.items.filter((x) => !excluded.has(`item:${x.name}`)).length
    + plan.batch.locations.filter((x) => !excluded.has(`location:${x.name}`)).length
    + plan.batch.factions.filter((x) => !excluded.has(`faction:${x.name}`)).length
    : 0;

  const aiReady = Boolean(project.settings.ai.baseUrl);

  return (
    <Modal open={open} width={680}
      title={<><IconSparkles size={15} /> AI 建谱 · 从正文导入设定</>}
      onClose={close}
      footer={step === 'input' ? (
        <>
          <Button onClick={close}>取消</Button>
          <Button variant="primary" disabled={busy || !aiReady} icon={<IconSparkles size={13} />} onClick={runExtract}>
            {busy ? '解析中…' : '开始解析'}
          </Button>
        </>
      ) : (
        <>
          <Button onClick={() => setStep('input')}>上一步</Button>
          <Button variant="primary" disabled={checkedCount === 0} onClick={doImport}>
            导入 {checkedCount} 项
          </Button>
        </>
      )}>
      {!aiReady && (
        <button type="button" className="issue-row" style={{ marginBottom: 12, width: '100%' }} onClick={() => navigate('settings')}>
          <IconAlert size={13} />
          <span>尚未配置 AI 接口，无法自动抽取，点击前往设置。</span>
          <IconLink size={12} />
        </button>
      )}

      {step === 'input' ? (
        <div className="ai-build">
          <p className="dim" style={{ marginTop: 0 }}>
            粘贴既有章节、大纲或设定文本，AI 将抽取人物 / 关系 / 事件 / 物品 / 地点 / 势力，
            确认后一次性入库。与图谱同名的实体会自动跳过，不会重复建。
          </p>
          <Textarea className="ui-textarea" style={{ minHeight: 220 }} value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={'粘贴正文片段…\n例如：林霄握紧手中的玄天令，望向青云山巅。师父玄清子曾说……'} />
          <label className="ai-build__opt">
            <Checkbox checked={includeChapters} onChange={(e) => setIncludeChapters(e.target.checked)} />
            <span>同时使用已写章节正文（{project.chapters.length} 章，截取前 1.2 万字）</span>
          </label>
          {error && <div className="ai-build__error"><IconAlert size={13} /> {error}</div>}
        </div>
      ) : plan && (
        <div className="ai-build">
          {plan.skipped.length > 0 && (
            <p className="dim" style={{ marginTop: 0 }}>
              与图谱重名已跳过：{plan.skipped.join('、')}
            </p>
          )}
          <div className="ai-build__secs">
            {rows.map((sec) => (
              <section key={sec.kind} className="ai-build__sec">
                <h4>{sec.label}</h4>
                <ul>
                  {sec.items.map((row) => (
                    <li key={row.key} className={`ai-build__row ${excluded.has(row.key) ? 'is-off' : ''}`}>
                      <Checkbox checked={!excluded.has(row.key)} onChange={() => toggle(row.key)} />
                      <div className="ai-build__row-main">
                        <b>{row.title}</b>
                        {row.detail && <span>{row.detail}</span>}
                      </div>
                      {row.exists && <em>图谱已有同名，导入将跳过</em>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="dim" style={{ marginBottom: 0 }}>
            取消勾选的条目不会入库；引用它们的关联（势力 / 持有者 / 参与者 / 因果 / 关系）会一并清理。
          </p>
        </div>
      )}
    </Modal>
  );
}
