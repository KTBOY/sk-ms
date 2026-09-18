import { useEffect, useMemo, useState } from 'react';
import type { DocCategory, ProjectDoc } from '../../core/types';
import { newId } from '../../core/id';
import { docTitle } from '../../core/docs/markdown';
import { categoryOf, DOC_CATEGORY_LABELS, DOC_CATEGORY_ORDER } from '../../core/docs/classify';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Button, Field, Input, Select, Segmented, StatusPill, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { IconDoc, IconEdit, IconEye, IconPlus, IconTrash } from '../../components/icons';
import { DocSemanticView } from './render';

/**
 * 
 * 「文档」页：承载工作区里除结构化图谱 / 正文 / 智能体之外的任意文本文件
 * （setting / ledger / reports / promo / guide / tool / other）。
 * 左：按分类分组的文档树 + 过滤 + 新建 / 删除；右：默认语义化只读视图，可切「编辑原文」
 * （textarea + 300ms 防抖自动保存，与写作台同口径）。语义视图只是原文投影，编辑永远改原文，
 * 保证「导入 → 编辑 → 导出」逐字节无损。
 */

/** 稳定空数组引用：避免 useSyncExternalStore 的 getSnapshot 每次返回新数组导致无限循环。 */
const EMPTY_DOCS: ProjectDoc[] = [];

const baseName = (path: string) => path.split('/').pop() || path;

export function DocsPage() {
  const project = useProjectStore((s) => s.project);
  const docs = useProjectStore((s) => s.project?.docs ?? EMPTY_DOCS);
  const saveState = useProjectStore((s) => s.saveState);
  const upsertDoc = useProjectStore((s) => s.upsertDoc);
  const removeDoc = useProjectStore((s) => s.removeDoc);
  const openDetail = useUIStore((s) => s.openDetail);
  const pushToast = useUIStore((s) => s.pushToast);
  const confirm = useUIStore((s) => s.confirm);

  const [filter, setFilter] = useState<'all' | DocCategory>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [draft, setDraft] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [newCat, setNewCat] = useState<'auto' | DocCategory>('auto');

  const selected = docs.find((d) => d.id === selectedId) ?? null;

  // 选中项兜底：删除 / 首次进入时自动选第一篇
  useEffect(() => {
    if (!selected && docs.length > 0) setSelectedId(docs[0].id);
    if (docs.length === 0) setSelectedId(null);
  }, [docs, selected]);

  // 切换文档：重置草稿与视图态
  useEffect(() => {
    setDraft(selected?.content ?? '');
    setMode('view');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // 编辑原文：防抖落库（仅编辑态、内容有变化时）
  const debouncedDraft = useDebouncedValue(draft, 300);
  useEffect(() => {
    if (mode !== 'edit' || !selected) return;
    if (debouncedDraft !== selected.content) upsertDoc({ ...selected, content: debouncedDraft });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDraft, mode, selected?.id]);

  const presentCats = useMemo(
    () => DOC_CATEGORY_ORDER.filter((c) => docs.some((d) => d.category === c)),
    [docs],
  );

  const grouped = useMemo(() => {
    const cats = (filter === 'all' ? presentCats : [filter]).filter((c) => docs.some((d) => d.category === c));
    return cats.map((c) => ({
      category: c,
      items: docs.filter((d) => d.category === c).sort((a, b) => a.path.localeCompare(b.path, 'zh')),
    }));
  }, [docs, filter, presentCats]);

  if (!project) return null;

  const createDoc = () => {
    const norm = newPath.replace(/\\/g, '/').replace(/^\.\//, '').trim();
    if (!norm) { pushToast('请填写文档路径（相对工作区根）', 'error'); return; }
    if (docs.some((d) => d.path === norm)) { pushToast('该路径已存在文档', 'error'); return; }
    const cat: DocCategory = newCat === 'auto' ? categoryOf(norm) : newCat;
    const content = `# ${docTitle('', baseName(norm))}\n\n`;
    const doc: ProjectDoc = { id: newId(), path: norm, category: cat, content, updatedAt: Date.now() };
    upsertDoc(doc);
    setSelectedId(doc.id);
    setNewOpen(false); setNewPath(''); setNewCat('auto');
    pushToast(`已新建「${norm}」`, 'success');
  };

  const delDoc = async (doc: ProjectDoc) => {
    const ok = await confirm('删除文档', `确定删除「${doc.path}」？此操作不可撤销（建议先导出工作区备份）。`);
    if (!ok) return;
    removeDoc(doc.id);
    pushToast(`已删除「${doc.path}」`, 'success');
  };

  return (
    <div className="page page--docs">
      {/* 左：分类文档树 */}
      <aside className="docs-side">
        <div className="docs-side__head">
          <span>文档（{docs.length}）</span>
          <Button size="sm" icon={<IconPlus size={12} />} onClick={() => setNewOpen(true)}>新建</Button>
        </div>
        {docs.length > 0 && (
          <div className="docs-side__filter">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[{ value: 'all' as const, label: '全部' }, ...presentCats.map((c) => ({ value: c, label: DOC_CATEGORY_LABELS[c] }))]}
            />
          </div>
        )}
        <div className="docs-side__list">
          {grouped.length === 0 && <p className="dim" style={{ padding: 12 }}>暂无文档。到「导出」页选择工作区文件夹一键导入，或点「新建」。</p>}
          {grouped.map((g) => (
            <div key={g.category} className="docs-group">
              <div className="docs-group__title">{DOC_CATEGORY_LABELS[g.category]}<i>{g.items.length}</i></div>
              {g.items.map((d) => (
                <button key={d.id} type="button" className={`doc-item ${d.id === selected?.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(d.id)} title={d.path}>
                  <IconDoc size={13} />
                  <span className="doc-item__name">{docTitle(d.content, baseName(d.path))}</span>
                  <span className="doc-item__path">{d.path}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* 右：内容区 */}
      <section className="docs-main">
        {selected ? (
          <>
            <div className="docs-main__bar">
              <div className="docs-main__title">
                <b>{docTitle(selected.content, baseName(selected.path))}</b>
                <span className="dim">{selected.path} · {DOC_CATEGORY_LABELS[selected.category]}</span>
              </div>
              <div className="docs-main__ops">
                <Segmented value={mode} onChange={setMode}
                  options={[{ value: 'view', label: '语义视图' }, { value: 'edit', label: '编辑原文' }]} />
                {mode === 'edit' && <StatusPill state={saveState} />}
                <Button size="sm" variant="danger" icon={<IconTrash size={12} />} onClick={() => void delDoc(selected)}>删除</Button>
              </div>
            </div>
            <div className="docs-main__body">
              {mode === 'view' ? (
                <DocSemanticView doc={selected} project={project} openDetail={openDetail} />
              ) : (
                <>
                  <div className="docs-edit-hint"><IconEdit size={12} /> 直接编辑 Markdown 原文，改动自动保存；语义视图仅是对原文的只读投影。</div>
                  <Textarea className="docs-editor" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
                </>
              )}
            </div>
          </>
        ) : (
          <div className="ui-empty" style={{ margin: 'auto' }}>
            <div className="ui-empty__icon"><IconEye size={40} /></div>
            <div className="ui-empty__title">还没有文档</div>
            <div className="ui-empty__hint">到「导出」页选择整个工作区文件夹一键导入，setting / ledger / reports / promo 等文档会自动收编到这里。</div>
          </div>
        )}
      </section>

      {/* 新建文档 */}
      <Modal open={newOpen} title="新建文档" width={480} onClose={() => setNewOpen(false)}
        footer={<>
          <Button onClick={() => setNewOpen(false)}>取消</Button>
          <Button variant="primary" icon={<IconPlus size={14} />} onClick={createDoc}>创建</Button>
        </>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="相对路径" hint="相对工作区根目录，正斜杠分隔；导出时按此路径原样回写。如 setting/新设定.md">
            <Input value={newPath} placeholder="例如 setting/角色小传.md" autoFocus
              onChange={(e) => setNewPath(e.target.value)} />
          </Field>
          <Field label="分类" hint="选「自动」时按路径顶层目录推导。">
            <Select value={newCat} onChange={(e) => setNewCat(e.target.value as 'auto' | DocCategory)}>
              <option value="auto">自动（按路径推导）</option>
              {DOC_CATEGORY_ORDER.map((c) => <option key={c} value={c}>{DOC_CATEGORY_LABELS[c]}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
