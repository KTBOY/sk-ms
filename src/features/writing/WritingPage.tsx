import { useEffect, useMemo, useState } from 'react';
import type { Chapter, EntityKind } from '../../core/types';
import { newId } from '../../core/id';
import { auditProject, collectMentions, detectUnknownNames } from '../../core/consistency';
import type { UnknownCandidate } from '../../core/consistency';
import { buildContextPack } from '../../core/contextPack';
import { chatComplete } from '../../core/ai';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Button, Segmented, Select, StatusPill, Tag, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { IconAlert, IconArrowDown, IconArrowUp, IconCopy, IconLink, IconPlus, IconSend, IconSparkles, IconTrash } from '../../components/icons';
import { UnknownActions, UnknownBubble } from './UnknownActions';
import { CharacterFormModal, emptyCharacter } from '../characters/CharacterFormModal';

const KIND_COLORS: Record<EntityKind, string> = {
  character: '#C9A6FF', location: '#6FE3D0', item: '#FFD37A', event: '#FF9E7A', faction: '#7FB0FF',
};

interface Annotation {
  start: number; end: number;
  type: 'mention' | 'unknown';
  kind?: EntityKind;
  entityId?: string;
  word?: string;
}

/** 写作台：章节编辑 + 实时一致性提示 + 上下文包。 */
export function WritingPage() {
  const project = useProjectStore((s) => s.project);
  const saveState = useProjectStore((s) => s.saveState);
  const upsertChapter = useProjectStore((s) => s.upsertChapter);
  const removeChapter = useProjectStore((s) => s.removeChapter);
  const moveChapter = useProjectStore((s) => s.moveChapter);
  const openDetail = useUIStore((s) => s.openDetail);
  const navigate = useUIStore((s) => s.navigate);
  const pushToast = useUIStore((s) => s.pushToast);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [panel, setPanel] = useState<'consistency' | 'context'>('consistency');
  const [bubble, setBubble] = useState<{ candidate: UnknownCandidate; x: number; y: number } | null>(null);
  const [quickCharName, setQuickCharName] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const chapters = useMemo(() => [...(project?.chapters ?? [])].sort((a, b) => a.order - b.order), [project]);
  const chapter = chapters.find((c) => c.id === activeId) ?? chapters[0] ?? null;

  useEffect(() => {
    if (!chapter && chapters.length > 0) setActiveId(chapters[0].id);
  }, [chapter, chapters]);

  const debouncedContent = useDebouncedValue(chapter?.content ?? '', 300);

  const { mentions, unknowns, issues } = useMemo(() => {
    if (!project || !chapter) return { mentions: [], unknowns: [] as UnknownCandidate[], issues: [] };
    return {
      mentions: collectMentions(project, debouncedContent),
      unknowns: detectUnknownNames(project, debouncedContent),
      issues: auditProject(project),
    };
  }, [project, chapter, debouncedContent]);

  // -------------------------------------------------- 预览标注（必须位于条件 return 之前，保证 Hooks 顺序稳定）
  const annotations = useMemo<Annotation[]>(() => {
    if (!chapter) return [];
    const list: Annotation[] = mentions.map((m) => ({
      start: m.start, end: m.end, type: 'mention', kind: m.kind, entityId: m.entityId,
    }));
    const used: Array<[number, number]> = [...list.map((m) => [m.start, m.end] as [number, number])];
    const overlaps = (s: number, e: number) => used.some(([us, ue]) => s < ue && e > us);
    for (const cand of unknowns) {
      let from = 0;
      for (;;) {
        const idx = chapter.content.indexOf(cand.word, from);
        if (idx < 0) break;
        from = idx + 1;
        if (!overlaps(idx, idx + cand.word.length)) {
          list.push({ start: idx, end: idx + cand.word.length, type: 'unknown', word: cand.word });
        }
      }
    }
    return list.sort((a, b) => a.start - b.start);
  }, [chapter, mentions, unknowns]);

  if (!project) return null;

  const patchChapter = (patch: Partial<Chapter>) => {
    if (!chapter) return;
    upsertChapter({ ...chapter, ...patch });
  };

  const addChapter = () => {
    const ch: Chapter = {
      id: newId(), title: `第${chapters.length + 1}章 未命名`, content: '', synopsis: '',
      status: '草稿', order: chapters.length + 1, updatedAt: Date.now(),
    };
    upsertChapter(ch);
    setActiveId(ch.id);
  };

  // -------------------------------------------------- 预览渲染
  const renderPreview = () => {
    if (!chapter) return null;
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    let key = 0;
    const pushText = (text: string) => {
      if (!text) return;
      text.split(/\n/).forEach((seg, i, arr) => {
        if (i > 0) nodes.push(<br key={`br-${key++}`} />);
        if (seg) nodes.push(<span key={`t-${key++}`}>{seg}</span>);
        void arr;
      });
    };
    for (const a of annotations) {
      if (a.start < cursor) continue;
      pushText(chapter.content.slice(cursor, a.start));
      if (a.type === 'mention' && a.kind && a.entityId) {
        nodes.push(
          <span key={`m-${key++}`} className="mention" style={{ '--mc': KIND_COLORS[a.kind] } as React.CSSProperties}
            title="点击查看图谱详情"
            onClick={() => openDetail(a.kind!, a.entityId!)}>
            {chapter.content.slice(a.start, a.end)}
          </span>,
        );
      } else {
        const cand = unknowns.find((u) => u.word === a.word);
        nodes.push(
          <span key={`u-${key++}`} className="mention-unknown"
            title="图谱中未找到，点击处理"
            onClick={(e) => { if (cand) setBubble({ candidate: cand, x: e.clientX, y: e.clientY + 14 }); }}>
            {chapter.content.slice(a.start, a.end)}
          </span>,
        );
      }
      cursor = a.end;
    }
    pushText(chapter.content.slice(cursor));
    return <div className="editor-preview">{nodes}</div>;
  };

  // -------------------------------------------------- AI
  const sendToAI = async () => {
    if (!chapter) return;
    const pack = buildContextPack(project, chapter);
    setAiBusy(true);
    try {
      const result = await chatComplete(project.settings.ai, pack);
      setAiResult(result);
      pushToast('AI 已返回内容', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'AI 调用失败', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const copyPack = async () => {
    if (!chapter) return;
    try {
      await navigator.clipboard.writeText(buildContextPack(project, chapter));
      pushToast('上下文包已复制，粘贴给任意 AI 即可', 'success');
    } catch {
      pushToast('复制失败，请手动选择文本复制', 'error');
    }
  };

  const charName = (id: string) => project.characters.find((c) => c.id === id)?.name;

  return (
    <div className="page page--writing">
      {/* 章节列表 */}
      <aside className="writing-chapters">
        <div className="writing-chapters__head">
          <span>章节（{chapters.length}）</span>
          <Button size="sm" icon={<IconPlus size={12} />} onClick={addChapter}>新增</Button>
        </div>
        <ul>
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button type="button" className={`ch-item ${c.id === chapter?.id ? 'is-active' : ''}`}
                onClick={() => setActiveId(c.id)}>
                <span className={`ch-dot ch-dot--${c.status === '已完成' ? 'done' : c.status === '写作中' ? 'doing' : 'draft'}`} />
                <span className="ch-item__title">{c.title}</span>
                <span className="ch-item__count">{c.content.replace(/\s/g, '').length}字</span>
              </button>
              <span className="ch-ops">
                <button type="button" aria-label="上移" disabled={i === 0} onClick={() => moveChapter(c.id, -1)}><IconArrowUp size={12} /></button>
                <button type="button" aria-label="下移" disabled={i === chapters.length - 1} onClick={() => moveChapter(c.id, 1)}><IconArrowDown size={12} /></button>
                <button type="button" aria-label="删除" onClick={async () => {
                  const ok = await useUIStore.getState().confirm('删除章节', `确定删除「${c.title}」？`);
                  if (ok) { removeChapter(c.id); if (activeId === c.id) setActiveId(null); }
                }}><IconTrash size={12} /></button>
              </span>
            </li>
          ))}
        </ul>
        {chapters.length === 0 && <p className="dim" style={{ padding: 12 }}>暂无章节，点击「新增」开始</p>}
      </aside>

      {/* 编辑区 */}
      <section className="writing-editor">
        {chapter ? (
          <>
            <div className="writing-editor__bar">
              <input className="writing-editor__title" value={chapter.title}
                onChange={(e) => patchChapter({ title: e.target.value })} />
              <Select value={chapter.status} onChange={(e) => patchChapter({ status: e.target.value as Chapter['status'] })}>
                <option value="草稿">草稿</option>
                <option value="写作中">写作中</option>
                <option value="已完成">已完成</option>
              </Select>
              <Segmented value={mode} onChange={setMode}
                options={[{ value: 'edit', label: '编辑' }, { value: 'preview', label: '预览' }]} />
              <StatusPill state={saveState} />
            </div>
            <div className="writing-editor__synopsis">
              <input className="ui-input" value={chapter.synopsis} placeholder="本章大纲（一句话，会进入上下文包）"
                onChange={(e) => patchChapter({ synopsis: e.target.value })} />
            </div>
            {mode === 'edit' ? (
              <Textarea className="editor-area" value={chapter.content}
                onChange={(e) => patchChapter({ content: e.target.value })}
                placeholder="开始写作… 正文中的实体会被自动识别并与图谱对照" />
            ) : (
              <div className="editor-area editor-area--preview">{renderPreview()}</div>
            )}
            <div className="writing-editor__foot">
              <span>{chapter.content.replace(/\s/g, '').length} 字 · 自动保存已开启</span>
              {mode === 'preview' && <span className="dim">紫色=已登记人物 · 青=地点 · 金=物品 · 橙=事件 · 琥珀虚线=未登记（点击处理）</span>}
            </div>
          </>
        ) : (
          <div className="ui-empty" style={{ margin: 'auto' }}>
            <div className="ui-empty__title">还没有章节</div>
            <Button variant="primary" icon={<IconPlus size={14} />} onClick={addChapter}>新增章节</Button>
          </div>
        )}
      </section>

      {/* 右栏 */}
      <aside className="writing-panel">
        <Segmented value={panel} onChange={setPanel}
          options={[
            { value: 'consistency', label: `一致性${unknowns.length + issues.length ? ` (${unknowns.length + issues.length})` : ''}` },
            { value: 'context', label: '上下文包' },
          ]} />

        {panel === 'consistency' && (
          <div className="writing-panel__body">
            {unknowns.length === 0 && issues.length === 0 && (
              <div className="panel-ok">✓ 一切正常：未发现未登记名词与图谱冲突</div>
            )}
            {unknowns.map((cand) => (
              <UnknownActions key={cand.word} candidate={cand} onCreate={(w) => setQuickCharName(w)} />
            ))}
            {issues.length > 0 && (
              <div className="issue-list">
                <h4>图谱体检（{issues.length}）</h4>
                {issues.slice(0, 8).map((iss) => (
                  <button key={iss.key} type="button" className="issue-row" onClick={() => openDetail(iss.kind, iss.entityId)}>
                    <IconAlert size={13} />
                    <span>{iss.message}</span>
                  </button>
                ))}
                {issues.length > 8 && <span className="dim">还有 {issues.length - 8} 条…</span>}
              </div>
            )}
            <div className="mention-summary">
              <h4>本章已引用实体</h4>
              <div className="event-chips">
                {[...new Map(mentions.map((m) => [m.entityId, m])).values()].map((m) => (
                  <Tag key={m.entityId} color={KIND_COLORS[m.kind]} onClick={() => openDetail(m.kind, m.entityId)}>
                    {charName(m.entityId) ?? m.name}
                  </Tag>
                ))}
                {mentions.length === 0 && <span className="dim">正文中暂未识别到已登记实体</span>}
              </div>
            </div>
          </div>
        )}

        {panel === 'context' && chapter && (
          <div className="writing-panel__body">
            <div className="ctx-ops">
              <Button size="sm" icon={<IconCopy size={13} />} onClick={copyPack}>复制上下文包</Button>
              <Button size="sm" variant="primary" icon={<IconSend size={13} />} disabled={aiBusy} onClick={sendToAI}>
                {aiBusy ? '请求中…' : '发送给 AI'}
              </Button>
              {!project.settings.ai.baseUrl && (
                <button type="button" className="unknown-card__link" onClick={() => navigate('settings')}>
                  <IconLink size={12} /> 配置 AI 接口
                </button>
              )}
            </div>
            <pre className="ctx-preview">{buildContextPack(project, chapter)}</pre>
          </div>
        )}
      </aside>

      {/* 未登记名词：快速建档 */}
      <CharacterFormModal
        open={quickCharName !== null}
        initial={quickCharName ? emptyCharacter(quickCharName) : null}
        onClose={() => setQuickCharName(null)}
      />

      {/* 预览气泡 */}
      {bubble && (
        <>
          <div className="unknown-bubble__mask" onClick={() => setBubble(null)} />
          <UnknownBubble candidate={bubble.candidate} position={{ x: bubble.x, y: bubble.y }}
            onCreate={(w) => { setBubble(null); setQuickCharName(w); }}
            onClose={() => setBubble(null)} />
        </>
      )}

      {/* AI 返回结果 */}
      <Modal open={aiResult !== null} title={<><IconSparkles size={15} /> AI 续写结果</>} width={640}
        onClose={() => setAiResult(null)}
        footer={<>
          <Button onClick={() => setAiResult(null)}>关闭</Button>
          <Button variant="primary" onClick={() => {
            if (chapter && aiResult) {
              patchChapter({ content: `${chapter.content}\n\n${aiResult.trim()}` });
              pushToast('已追加到本章正文末尾', 'success');
              setAiResult(null);
              setMode('edit');
            }
          }}>追加到正文</Button>
        </>}>
        <pre className="ctx-preview" style={{ maxHeight: 380 }}>{aiResult}</pre>
      </Modal>
    </div>
  );
}
