import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Chapter, EntityKind } from '../../core/types';
import { newId } from '../../core/id';
import { auditProject, collectMentions, detectUnknownNames } from '../../core/consistency';
import type { UnknownCandidate } from '../../core/consistency';
import { buildContextPack } from '../../core/contextPack';
import { volumeHeading, volumeList, volumeOf } from '../../core/export/aiExport';
import { chatComplete } from '../../core/ai';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Button, Segmented, Select, StatusPill, Tag, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { IconAlert, IconArrowDown, IconArrowUp, IconChevronDown, IconCopy, IconHistory, IconLink, IconPlus, IconSearch, IconSend, IconSparkles, IconTrash, IconX } from '../../components/icons';
import { UnknownActions, UnknownBubble } from './UnknownActions';
import { CharacterFormModal, emptyCharacter } from '../characters/CharacterFormModal';

/** 稳定空数组引用：避免 useSyncExternalStore 的 getSnapshot 每次返回新数组导致无限循环。 */
const EMPTY_AGENTS: never[] = [];

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

/** 写作台：章节编辑 + 实时一致性提示 + 上下文包 + 查找替换 + 版本历史。 */
/** 自动快照最小间隔：正文有改动时每 10 分钟留一档。 */
const AUTO_SNAPSHOT_MS = 10 * 60 * 1000;

/** 转义正则元字符（非正则模式下按字面量查找）。 */
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface FindMatch { start: number; end: number }

export function WritingPage() {
  const project = useProjectStore((s) => s.project);
  const saveState = useProjectStore((s) => s.saveState);
  const upsertChapter = useProjectStore((s) => s.upsertChapter);
  const update = useProjectStore((s) => s.update);
  const removeChapter = useProjectStore((s) => s.removeChapter);
  const moveChapter = useProjectStore((s) => s.moveChapter);
  const snapshotChapter = useProjectStore((s) => s.snapshotChapter);
  const restoreChapterVersion = useProjectStore((s) => s.restoreChapterVersion);
  const openDetail = useUIStore((s) => s.openDetail);
  const navigate = useUIStore((s) => s.navigate);
  const pushToast = useUIStore((s) => s.pushToast);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [panel, setPanel] = useState<'consistency' | 'context' | 'history'>('consistency');
  const [bubble, setBubble] = useState<{ candidate: UnknownCandidate; x: number; y: number } | null>(null);
  const [quickCharName, setQuickCharName] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [agentId, setAgentId] = useState('');
  const agents = useProjectStore((s) => s.appSettings.agents ?? EMPTY_AGENTS);
  const enabledAgents = useMemo(() => agents.filter((a) => a.enabled), [agents]);

  // 查找替换
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [matchIdx, setMatchIdx] = useState(0);

  // 版本历史：自动快照节流（记录上次快照时间与章节）
  const lastSnapRef = useRef<{ at: number; chapterId: string }>({ at: Date.now(), chapterId: '' });

  const chapters = useMemo(() => [...(project?.chapters ?? [])].sort((a, b) => a.order - b.order), [project]);
  const chapter = chapters.find((c) => c.id === activeId) ?? chapters[0] ?? null;

  // 分卷分组：卷按全书章号区间划定（与导出 / 设定集同口径），把章节归入所属卷。
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [groupByVol, setGroupByVol] = useState(true);
  // 当前归卷目标卷（点章节 / 聚焦卷名 / 新建卷时更新）；null = 跟随当前章节所属卷或末卷。
  const [activeVolId, setActiveVolId] = useState<string | null>(null);
  const vols = useMemo(() => (project ? volumeList(project) : []), [project]);
  const groupIndex = useMemo(() => new Map(chapters.map((c, i) => [c.id, i])), [chapters]);
  const volGroups = useMemo(() => {
    if (!project || vols.length === 0) return null;
    const byVol = new Map<string, Chapter[]>();
    const ungrouped: Chapter[] = [];
    for (const c of chapters) {
      const v = volumeOf(project, c.order);
      if (v) { const arr = byVol.get(v.id) ?? []; arr.push(c); byVol.set(v.id, arr); }
      else ungrouped.push(c);
    }
    const groups: Array<{ key: string; volId: string | null; name: string; title: string; chapters: Chapter[] }> =
      vols.map((v, i) => ({ key: v.id, volId: v.id, name: v.name, title: volumeHeading(v, i), chapters: byVol.get(v.id) ?? [] }));
    if (ungrouped.length) groups.push({ key: '__none', volId: null, name: '', title: '未分卷', chapters: ungrouped });
    return groups;
  }, [project, chapters, vols]);
  const showGroups = groupByVol && volGroups !== null;
  const toggleVol = (key: string) => setCollapsed((prev) => {
    const n = new Set(prev);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  useEffect(() => {
    if (!chapter && chapters.length > 0) setActiveId(chapters[0].id);
  }, [chapter, chapters]);

  // 选中章节所在卷自动展开（切换作品 / 跨页跳转时不漏看）。
  useEffect(() => {
    if (!project || !chapter) return;
    const v = volumeOf(project, chapter.order);
    const key = v ? v.id : '__none';
    setCollapsed((prev) => {
      if (!prev.has(key)) return prev;
      const n = new Set(prev); n.delete(key); return n;
    });
  }, [chapter, project]);

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

  // -------------------------------------------------- 查找替换：匹配计算与定位
  const findMatches = useMemo<FindMatch[]>(() => {
    if (!chapter || !findText) return [];
    let re: RegExp;
    try {
      re = new RegExp(useRegex ? findText : escapeRegExp(findText), `g${matchCase ? '' : 'i'}`);
    } catch {
      return [];
    }
    const out: FindMatch[] = [];
    for (;;) {
      const m = re.exec(chapter.content);
      if (!m) break;
      out.push({ start: m.index, end: m.index + m[0].length });
      if (m.index === re.lastIndex) re.lastIndex += 1; // 空匹配防死循环
      if (out.length >= 999) break;
    }
    return out;
  }, [chapter, findText, matchCase, useRegex]);

  useEffect(() => { setMatchIdx((i) => Math.min(i, Math.max(0, findMatches.length - 1))); }, [findMatches.length]);

  /** 把当前匹配滚动进视口并选中（textarea 唯一可靠的原生方案）。 */
  const revealMatch = (idx: number) => {
    const m = findMatches[idx];
    const el = editorRef.current;
    if (!m || !el || mode !== 'edit' || !chapter) return;
    el.focus();
    el.setSelectionRange(m.start, m.end);
    // 粗略滚动定位：按字数比例估算行位置
    const lines = chapter.content.slice(0, m.start).split('\n').length;
    const lineH = 30;
    el.scrollTop = Math.max(0, (lines - 4) * lineH);
  };

  const openFind = (withReplace: boolean) => {
    if (mode !== 'edit') setMode('edit');
    setFindOpen(true);
    const sel = window.getSelection()?.toString();
    if (sel && sel.length <= 50) setFindText(sel);
    setTimeout(() => (withReplace ? replaceInputRef.current?.focus() : findInputRef.current?.focus()), 0);
  };

  // Ctrl+F / Ctrl+H 唤起查找替换
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'f' && key !== 'h') return;
      const target = e.target as HTMLElement | null;
      const inTextField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (inTextField && !((target as HTMLTextAreaElement).classList.contains('editor-area'))) return;
      e.preventDefault();
      openFind(key === 'h');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, chapter?.id]);

  if (!project) return null;

  /** 从 store 取最新章节：快照写入 versions 后闭包里的 chapter 已过期，必须以 store 为准。 */
  const latestChapter = () => useProjectStore.getState().project?.chapters.find((c) => c.id === chapter?.id) ?? null;

  const patchChapter = (patch: Partial<Chapter>) => {
    const cur = latestChapter();
    if (!cur) return;
    // 版本历史：正文即将变化时，按 10 分钟节流把改动前的内容留档
    if (patch.content != null && patch.content !== cur.content) {
      const now = Date.now();
      if (now - lastSnapRef.current.at > AUTO_SNAPSHOT_MS || lastSnapRef.current.chapterId !== cur.id) {
        lastSnapRef.current = { at: now, chapterId: cur.id };
        snapshotChapter(cur.id, 'auto');
      }
    }
    const after = latestChapter() ?? cur;
    upsertChapter({ ...after, ...patch });
  };

  /** 替换当前匹配：改写该处文本，保持光标在原匹配序号。 */
  const replaceCurrent = () => {
    const cur = latestChapter();
    if (!cur || findMatches.length === 0) return;
    const idx = Math.min(matchIdx, findMatches.length - 1);
    const m = findMatches[idx];
    const next = cur.content.slice(0, m.start) + replaceText + cur.content.slice(m.end);
    patchChapter({ content: next });
    pushToast(`已替换第 ${idx + 1} 处`, 'success');
  };

  /** 全部替换：替换前强制留档（label=replace），回滚有底。 */
  const replaceAll = async () => {
    const cur = latestChapter();
    if (!cur || findMatches.length === 0) return;
    const ok = await useUIStore.getState().confirm(
      '全部替换',
      `将「${findText}」全部替换为「${replaceText || '（空）'}」，共 ${findMatches.length} 处。替换前会自动留存当前版本。`,
    );
    if (!ok) return;
    snapshotChapter(cur.id, 'replace');
    lastSnapRef.current = { at: Date.now(), chapterId: cur.id }; // 已留档，跳过自动快照
    const re = new RegExp(useRegex ? findText : escapeRegExp(findText), `g${matchCase ? '' : 'i'}`);
    // 字面量模式下替换文本原样写入（$&、$1 不解释）；正则模式下保留 $1 等捕获组语义
    const source = (latestChapter() ?? cur).content;
    const next = useRegex ? source.replace(re, replaceText) : source.replace(re, () => replaceText);
    patchChapter({ content: next });
    pushToast(`已替换 ${findMatches.length} 处，替换前版本已留存`, 'success');
  };

  /** 手动快照。 */
  const saveSnapshot = () => {
    if (!chapter) return;
    if (snapshotChapter(chapter.id, 'manual')) {
      pushToast('已保存当前版本快照', 'success');
      setPanel('history');
    }
  };

  /** 回滚到快照（store 内会先把当前内容留档）。 */
  const rollbackTo = async (versionId: string, excerpt: string) => {
    if (!chapter) return;
    const ok = await useUIStore.getState().confirm('回滚版本', `将本章正文回滚到「${excerpt}」？当前内容会先自动留档。`);
    if (!ok) return;
    if (restoreChapterVersion(chapter.id, versionId)) pushToast('已回滚，当前内容已留档', 'success');
    else pushToast('回滚失败', 'error');
  };

  /** 当前归卷目标：显式选中的卷 > 当前章节所属卷 > 最后一卷 > 无（则全书末尾追加）。 */
  const targetVolumeId = (): string | null => {
    if (activeVolId && vols.some((v) => v.id === activeVolId)) return activeVolId;
    if (chapter) { const v = volumeOf(project, chapter.order); if (v) return v.id; }
    return vols.length ? vols[vols.length - 1].id : null;
  };

  /** 新增章节：归入目标卷末尾（自动顺延其后各卷区间）；无卷时全书末尾追加。 */
  const addChapter = (volIdArg?: string) => {
    const volId = volIdArg ?? targetVolumeId();
    let createdId = '';
    update((p) => {
      const maxOrder = p.chapters.reduce((m, c) => Math.max(m, c.order), 0);
      let newOrder = maxOrder + 1;
      const v = volId ? (p.volumes ?? []).find((x) => x.id === volId) : undefined;
      if (v) {
        const inVol = p.chapters.filter((c) => c.order >= v.startOrder && c.order <= v.endOrder);
        if (inVol.length) {
          newOrder = Math.max(...inVol.map((c) => c.order)) + 1;
          if (newOrder <= maxOrder) {
            p.chapters.forEach((c) => { if (c.order >= newOrder) c.order += 1; });
            (p.volumes ?? []).forEach((x) => {
              if (x.id === v.id) return;
              if (x.startOrder >= newOrder) { x.startOrder += 1; x.endOrder += 1; }
            });
          }
          v.endOrder = Math.max(v.endOrder, newOrder);
        } else {
          newOrder = maxOrder + 1;
          v.startOrder = newOrder; v.endOrder = newOrder;
        }
      }
      const ch: Chapter = {
        id: newId(), title: `第${newOrder}章 未命名`, content: '', synopsis: '',
        status: '草稿', order: newOrder, updatedAt: Date.now(),
      };
      p.chapters.push(ch);
      createdId = ch.id;
    });
    if (volIdArg) setActiveVolId(volIdArg);
    setActiveId(createdId);
    setGroupByVol(true);
    if (volId) setCollapsed((prev) => { if (!prev.has(volId)) return prev; const n = new Set(prev); n.delete(volId); return n; });
  };

  /** 新建分卷：在全书末尾开一卷并建其第一章（避免空卷破坏章号连续性）；随后可就地改名。 */
  const addVolume = () => {
    let newVolId = '';
    let newChId = '';
    update((p) => {
      p.volumes = p.volumes ?? [];
      const order = p.chapters.reduce((m, c) => Math.max(m, c.order), 0) + 1;
      const vol = { id: newId(), name: '', startOrder: order, endOrder: order };
      const ch: Chapter = { id: newId(), title: `第${order}章 未命名`, content: '', synopsis: '', status: '草稿', order, updatedAt: Date.now() };
      p.volumes.push(vol);
      p.chapters.push(ch);
      newVolId = vol.id; newChId = ch.id;
    });
    setActiveVolId(newVolId);
    setActiveId(newChId);
    setGroupByVol(true);
    pushToast('已新建分卷并建了本卷第一章 —— 填卷名后点「新增」继续', 'success');
  };

  const renameVolume = (id: string, name: string) => update((p) => {
    const v = (p.volumes ?? []).find((x) => x.id === id);
    if (v) v.name = name;
  });

  const delVolume = async (id: string) => {
    const ok = await useUIStore.getState().confirm('删除分卷', '删除该分卷？卷内章节不会被删除，只是不再归属此卷。');
    if (!ok) return;
    update((p) => { p.volumes = (p.volumes ?? []).filter((v) => v.id !== id); });
    if (activeVolId === id) setActiveVolId(null);
    pushToast('已删除分卷（章节保留）', 'success');
  };

  /** 单章行（上移/下移按全局 order 定位，跨卷移动即改变所属卷）。分卷分组与平铺两种视图共用。 */
  const chapterRow = (c: Chapter) => {
    const i = groupIndex.get(c.id) ?? 0;
    return (
      <li key={c.id}>
        <button type="button" className={`ch-item ${c.id === chapter?.id ? 'is-active' : ''}`}
          onClick={() => { setActiveId(c.id); const v = volumeOf(project, c.order); setActiveVolId(v ? v.id : null); }}>
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
    );
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
    const agent = enabledAgents.find((a) => a.id === agentId);
    setAiBusy(true);
    try {
      const result = await chatComplete(project.settings.ai, pack, agent?.prompt);
      setAiResult(result);
      pushToast(agent ? `「${agent.name}」已返回内容` : 'AI 已返回内容', 'success');
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
      {/* 章节列表（按分卷分组、可折叠；无分卷时平铺） */}
      <aside className="writing-chapters">
        <div className="writing-chapters__head">
          <span>章节（{chapters.length}）</span>
          <span className="writing-chapters__acts">
            {vols.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setGroupByVol((v) => !v)}
                title={showGroups ? '切换为平铺列表' : '按分卷分组'}>
                {showGroups ? '平铺' : '分卷'}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={addVolume} title="新建分卷（末尾开一卷并建第一章）">＋卷</Button>
            <Button size="sm" icon={<IconPlus size={12} />} onClick={() => addChapter()}>新增</Button>
          </span>
        </div>
        <ul>
          {showGroups && volGroups
            ? volGroups.map((g) => (
                <Fragment key={g.key}>
                  <li className="vol-head">
                    <div className={`vol-head__row ${g.volId && activeVolId === g.volId ? 'is-active' : ''}`}>
                      <button type="button" className="vol-head__chev-btn" aria-label="折叠/展开" onClick={() => toggleVol(g.key)}>
                        <IconChevronDown size={12} className={`vol-head__chev ${collapsed.has(g.key) ? 'is-collapsed' : ''}`} />
                      </button>
                      {g.volId ? (
                        <input className="vol-head__name" value={g.name} placeholder="卷名（点击编辑）"
                          onFocus={() => setActiveVolId(g.volId!)}
                          onChange={(e) => renameVolume(g.volId!, e.target.value)} />
                      ) : (
                        <span className="vol-head__title">{g.title}</span>
                      )}
                      <span className="vol-head__count">{g.chapters.length}</span>
                      {g.volId && (
                        <span className="vol-ops">
                          <button type="button" title="在本卷末尾新增章节" onClick={() => addChapter(g.volId!)}><IconPlus size={12} /></button>
                          <button type="button" title="删除分卷（保留章节）" onClick={() => void delVolume(g.volId!)}><IconTrash size={12} /></button>
                        </span>
                      )}
                    </div>
                  </li>
                  {!collapsed.has(g.key) && g.chapters.map((c) => chapterRow(c))}
                </Fragment>
              ))
            : chapters.map((c) => chapterRow(c))}
        </ul>
        {chapters.length === 0 && <p className="dim" style={{ padding: 12 }}>暂无章节：点「新增」直接写章，或点「＋卷」先建一个分卷再把章节归入其中。</p>}
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
              <Button size="sm" icon={<IconSearch size={12} />} onClick={() => openFind(false)} title="查找替换（Ctrl+F）">查找</Button>
              <Segmented value={mode} onChange={setMode}
                options={[{ value: 'edit', label: '编辑' }, { value: 'preview', label: '预览' }]} />
              <StatusPill state={saveState} />
            </div>
            <div className="writing-editor__synopsis">
              <input className="ui-input" value={chapter.synopsis} placeholder="本章大纲（一句话，会进入上下文包）"
                onChange={(e) => patchChapter({ synopsis: e.target.value })} />
            </div>
            {findOpen && (
              <div className="find-bar">
                <IconSearch size={13} />
                <input ref={findInputRef} className="ui-input find-bar__input" value={findText}
                  placeholder="查找（Enter 下一个）" autoFocus
                  onChange={(e) => { setFindText(e.target.value); setMatchIdx(0); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); if (findMatches.length) { const n = (matchIdx + 1) % findMatches.length; setMatchIdx(n); revealMatch(n); } }
                    if (e.key === 'Escape') setFindOpen(false);
                  }} />
                <span className="find-bar__arrow">→</span>
                <input ref={replaceInputRef} className="ui-input find-bar__input" value={replaceText}
                  placeholder="替换为"
                  onChange={(e) => setReplaceText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setFindOpen(false); }} />
                <button type="button" className={`find-bar__toggle ${matchCase ? 'is-on' : ''}`}
                  title="区分大小写" onClick={() => setMatchCase((v) => !v)}>Aa</button>
                <button type="button" className={`find-bar__toggle ${useRegex ? 'is-on' : ''}`}
                  title="正则表达式" onClick={() => setUseRegex((v) => !v)}>.*</button>
                <span className="find-bar__count">
                  {findText ? (findMatches.length ? `${matchIdx + 1}/${findMatches.length}` : '无结果') : '0/0'}
                </span>
                <Button size="sm" disabled={!findMatches.length} onClick={() => { if (findMatches.length) { const p = (matchIdx - 1 + findMatches.length) % findMatches.length; setMatchIdx(p); revealMatch(p); } }}>上一个</Button>
                <Button size="sm" disabled={!findMatches.length} onClick={() => { if (findMatches.length) { const n = (matchIdx + 1) % findMatches.length; setMatchIdx(n); revealMatch(n); } }}>下一个</Button>
                <Button size="sm" disabled={!findMatches.length} onClick={replaceCurrent}>替换</Button>
                <Button size="sm" variant="primary" disabled={!findMatches.length} onClick={replaceAll}>全部替换</Button>
                <button type="button" className="ui-iconbtn" aria-label="关闭查找" onClick={() => setFindOpen(false)}><IconX size={13} /></button>
              </div>
            )}
            {mode === 'edit' ? (
              <Textarea ref={editorRef} className="editor-area" value={chapter.content}
                onChange={(e) => patchChapter({ content: e.target.value })}
                placeholder="开始写作… 正文中的实体会被自动识别并与图谱对照；Ctrl+F 查找替换" />
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
            <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => addChapter()}>新增章节</Button>
          </div>
        )}
      </section>

      {/* 右栏 */}
      <aside className="writing-panel">
        <Segmented value={panel} onChange={setPanel}
          options={[
            { value: 'consistency', label: `一致性${unknowns.length + issues.length ? ` (${unknowns.length + issues.length})` : ''}` },
            { value: 'context', label: '上下文包' },
            { value: 'history', label: '历史' },
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
              {enabledAgents.length > 0 && (
                <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  <option value="">不使用角色卡</option>
                  {enabledAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              )}
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

        {panel === 'history' && chapter && (
          <div className="writing-panel__body">
            <div className="ctx-ops">
              <Button size="sm" icon={<IconHistory size={13} />} onClick={saveSnapshot}>保存当前版本</Button>
              <span className="dim">每 10 分钟自动留档 · 上限 20 条</span>
            </div>
            {(chapter.versions?.length ?? 0) === 0 ? (
              <div className="panel-ok">本章还没有历史版本。编辑正文时会自动留档，也可点击上方按钮手动保存。</div>
            ) : (
              <ul className="version-list">
                {[...(chapter.versions ?? [])].reverse().map((v) => (
                  <li key={v.id} className="version-row">
                    <div className="version-row__meta">
                      <span className={`version-badge version-badge--${v.label}`}>
                        {v.label === 'auto' ? '自动' : v.label === 'replace' ? '替换前' : '手动'}
                      </span>
                      <span className="version-row__time">
                        {new Date(v.at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="version-row__count">{v.wordCount} 字</span>
                    </div>
                    <div className="version-row__excerpt">{v.content.replace(/\s+/g, ' ').slice(0, 48) || '（空）'}</div>
                    <div className="version-row__ops">
                      <Button size="sm" onClick={() => rollbackTo(v.id, v.content.replace(/\s+/g, ' ').slice(0, 12))}>回滚到此版本</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
