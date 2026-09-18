import { useEffect, useRef, useState } from 'react';
import { exportTxt, exportMarkdown } from '../../core/export/textExport';
import { exportDocx } from '../../core/export/docxExport';
import { exportEpub } from '../../core/export/epubExport';
import { exportBackup, importBackup } from '../../core/export/backup';
import {
  exportAiContextZip, getSavedTarget, looksLikeAiContextDir, pickTargetDirectory, pickSourceDirectory,
  readWorkspaceDir, supportsDirectoryExport, volumeList, writeWorkspaceToDirectory, type DirHandle,
} from '../../core/export/aiExport';
import {
  parseContextBundle, parseVolumeMarkdown, applyVolumes, applyChapterFiles, countWords,
  type ParsedVolume,
} from '../../core/import/aiImport';
import { classifyWorkspace, DOC_CATEGORY_LABELS, type RawWorkspaceFile } from '../../core/docs/classify';
import { parseAgentSoulFiles, type AgentSeed } from '../../core/import/agentImport';
import type { DocCategory, Project, ProjectDoc, Volume } from '../../core/types';
import { newId } from '../../core/id';
import { isDesktop } from '../../core/desktop';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Button, Input } from '../../components/ui/primitives';
import { IconBook, IconExport, IconGraph, IconItem, IconPlus, IconRefresh, IconSparkles, IconTrash, IconUpload, IconUser } from '../../components/icons';

/** 导出中心：AI 上下文包 / TXT / Markdown / DOCX / EPUB / JSON 备份 + 恢复。 */

/** 稳定空数组引用：避免 useSyncExternalStore 的 getSnapshot 每次返回新数组导致无限循环。 */
const EMPTY_AGENTS: never[] = [];

/** 整个文件夹导入的组装结果（暂存，确认「为新/覆盖」后才落库）。 */
interface ImportPlan {
  project: Project;
  seeds: AgentSeed[];
  source: string;
  counts: {
    hasBundle: boolean;
    chapters: number;
    docs: number;
    docByCategory: Partial<Record<DocCategory, number>>;
    agents: number;
    chapterFiles: number;
    mergedVolumes: number;
    skipped: number;
  };
}

/** 无 novel-context.json 时的空作品基座（仅靠正文/文档构建）。 */
function blankProject(): Project {
  const now = Date.now();
  return {
    id: newId(), name: '导入的作品', genre: '', description: '', createdAt: now, updatedAt: now,
    characters: [], relations: [], events: [], items: [], locations: [], factions: [],
    chapters: [], volumes: [], docs: [], mapLayout: {}, ignoreWords: [],
    settings: { ai: { baseUrl: '', apiKey: '', model: '' } },
  };
}

/** 归类各桶 → 组装成完整作品（图谱 + 正文 + 文档）+ 智能体种子；纯函数，不落库。 */
function assembleWorkspace(files: RawWorkspaceFile[], source: string): ImportPlan {
  const buckets = classifyWorkspace(files);
  if (!buckets.bundle && buckets.chapterFiles.length === 0 && buckets.mergedVolumes.length === 0) {
    throw new Error('没找到 novel-context.json，也没有正文逐章 / 合并稿文件 —— 请选择一个由墨枢导出过的工作区目录');
  }
  let base: Project = buckets.bundle ? parseContextBundle(buckets.bundle.text) : blankProject();
  // 整卷合并稿优先，再叠加逐章文件（均按全局 order 对位覆盖正文）
  if (buckets.mergedVolumes.length) {
    const parsed: ParsedVolume[] = [];
    for (const f of buckets.mergedVolumes) {
      try { parsed.push(parseVolumeMarkdown(f.path.split('/').pop() || f.path, f.text)); } catch { /* 跳过不合格式 */ }
    }
    if (parsed.length) base = applyVolumes(base, parsed).project;
  }
  if (buckets.chapterFiles.length) {
    base = applyChapterFiles(base, buckets.chapterFiles.map((f) => ({ name: f.path, text: f.text }))).project;
  }
  const now = Date.now();
  const docs: ProjectDoc[] = buckets.docs.map((d) => ({
    id: newId(), path: d.path, category: d.category, content: d.content, updatedAt: now,
  }));
  base = { ...base, docs: [...(base.docs ?? []), ...docs] };
  const seeds: AgentSeed[] = buckets.soulFiles.length ? parseAgentSoulFiles(buckets.soulFiles) : [];
  const byCat: Partial<Record<DocCategory, number>> = {};
  for (const d of docs) byCat[d.category] = (byCat[d.category] ?? 0) + 1;
  return {
    project: base, seeds, source,
    counts: {
      hasBundle: !!buckets.bundle,
      chapters: base.chapters.length,
      docs: docs.length,
      docByCategory: byCat,
      agents: seeds.length,
      chapterFiles: buckets.chapterFiles.length,
      mergedVolumes: buckets.mergedVolumes.length,
      skipped: buckets.skipped.length,
    },
  };
}

/* ---------------- 本地文件夹双向同步引擎（仅桌面端，靠 getState 取最新数据） ---------------- */

const AUTOSYNC_KEY = 'novel-atlas:workspace-autosync';
type Baseline = Record<string, string>; // path → 上次同步时的内容（用于区分外部改动）

/** 读取目录快照：文件列表 + path→内容 基线。 */
async function snapshotWorkspace(handle: DirHandle): Promise<{ files: RawWorkspaceFile[]; snap: Baseline }> {
  const files = await readWorkspaceDir(handle);
  const snap: Baseline = {};
  for (const f of files) snap[f.path] = f.text;
  return { files: files.map((f) => ({ path: f.path, text: f.text })), snap };
}

/** 当前快照 vs 基线的变更文件数（新增 / 修改 / 删除）。 */
function diffCount(snap: Baseline, base: Baseline): number {
  let n = 0;
  for (const p in snap) if (snap[p] !== base[p]) n += 1;
  for (const p in base) if (!(p in snap)) n += 1;
  return n;
}

/** 推送：当前作品 → 本地目录，并以写入后的快照刷新基线。 */
async function pushWorkspace(handle: DirHandle, baseline: { current: Baseline }): Promise<number> {
  const { project, appSettings } = useProjectStore.getState();
  if (!project) return 0;
  const stats = await writeWorkspaceToDirectory(project, handle, appSettings.agents ?? []);
  const { snap } = await snapshotWorkspace(handle);
  baseline.current = snap;
  return stats.files;
}

/** 拉取：本地目录中基线之外的外部改动 → 重建作品并覆盖当前（保留作品 id）；无改动则跳过。 */
async function pullWorkspace(handle: DirHandle, baseline: { current: Baseline }): Promise<number> {
  const store = useProjectStore.getState();
  const current = store.project;
  if (!current) return 0;
  const { files, snap } = await snapshotWorkspace(handle);
  const changed = diffCount(snap, baseline.current);
  if (changed === 0) return 0;
  const plan = assembleWorkspace(files, '本地同步');
  await store.importProject({ ...plan.project, id: current.id });
  if (plan.seeds.length) store.importAgents(plan.seeds);
  baseline.current = snap;
  return changed;
}

const FORMATS = [
  { id: 'txt', name: 'TXT', desc: '纯文本连排，全平台通用', icon: IconBook, ext: '直接导出' },
  { id: 'md', name: 'Markdown', desc: '章节标题结构化，可附设定集附录', icon: IconItem },
  { id: 'docx', name: 'DOCX', desc: 'Word 文档，标题样式完整，可投稿打印', icon: IconUser },
  { id: 'epub', name: 'EPUB', desc: 'EPUB3 电子书，可直接导入阅读器', icon: IconBook },
  { id: 'json', name: 'JSON 备份', desc: '全项目数据（含设定图谱），可随时恢复', icon: IconSparkles },
] as const;

export function ExportPage() {
  const project = useProjectStore((s) => s.project);
  const importProject = useProjectStore((s) => s.importProject);
  const importAgents = useProjectStore((s) => s.importAgents);
  const update = useProjectStore((s) => s.update);
  const pushToast = useUIStore((s) => s.pushToast);
  const confirm = useUIStore((s) => s.confirm);
  const agents = useProjectStore((s) => s.appSettings.agents ?? EMPTY_AGENTS);
  const [includeWorldbook, setIncludeWorldbook] = useState(true);
  const [target, setTarget] = useState<DirHandle | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);

  // 本地文件夹双向同步（仅桌面客户端）
  const desktop = isDesktop();
  const [autoSync, setAutoSync] = useState<boolean>(() => isDesktop() && localStorage.getItem(AUTOSYNC_KEY) === '1');
  const [syncBusy, setSyncBusy] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const baselineRef = useRef<Baseline>({});
  const busyRef = useRef(false);

  useEffect(() => {
    void getSavedTarget().then(setTarget).catch(() => setTarget(null));
  }, []);

  // 自动推送：作品变化后防抖写回本地（仅在开启且已绑定目录时）。
  useEffect(() => {
    if (!autoSync || !target) return;
    const timer = setTimeout(() => {
      if (busyRef.current) return;
      busyRef.current = true; setSyncBusy(true);
      pushWorkspace(target, baselineRef)
        .then(() => setLastSyncAt(Date.now()))
        .catch((err) => useUIStore.getState().pushToast(err instanceof Error ? `推送到本地失败：${err.message}` : '推送到本地失败', 'error'))
        .finally(() => { busyRef.current = false; setSyncBusy(false); });
    }, 2000);
    return () => clearTimeout(timer);
  }, [project, autoSync, target]);

  // 自动拉取：定时读目录，只有与基线不同的外部改动才会回灌（避免自写回循环）。
  useEffect(() => {
    if (!autoSync || !target) return;
    const id = setInterval(() => {
      if (busyRef.current) return;
      busyRef.current = true; setSyncBusy(true);
      pullWorkspace(target, baselineRef)
        .then((changed) => {
          if (changed > 0) { setLastSyncAt(Date.now()); useUIStore.getState().pushToast(`已从本地文件夹同步 ${changed} 个变更文件`, 'success'); }
        })
        .catch(() => { /* 瞬时读取失败下轮重试 */ })
        .finally(() => { busyRef.current = false; setSyncBusy(false); });
    }, 6000);
    return () => clearInterval(id);
  }, [autoSync, target]);

  if (!project) return null;

  const canDirect = supportsDirectoryExport();
  const canSync = desktop && canDirect;
  const projectVolumes = volumeList(project);

  /* ---------------- 分卷管理 ---------------- */

  const patchVolume = (id: string, patch: Partial<Volume>) => {
    update((p) => {
      p.volumes = p.volumes ?? [];
      const v = p.volumes.find((x) => x.id === id);
      if (!v) return;
      Object.assign(v, patch);
      if (v.endOrder < v.startOrder) v.endOrder = v.startOrder;
      p.volumes.sort((a, b) => a.startOrder - b.startOrder);
    });
  };

  const addVolume = () => {
    const total = project.chapters.length;
    update((p) => {
      p.volumes = p.volumes ?? [];
      const last = p.volumes.length
        ? p.volumes.reduce((a, b) => (b.startOrder > a.startOrder ? b : a))
        : null;
      const start = last ? last.endOrder + 1 : 1;
      p.volumes.push({ id: newId(), name: '', startOrder: start, endOrder: Math.max(start, total) });
      p.volumes.sort((a, b) => a.startOrder - b.startOrder);
    });
  };

  const removeVolume = (id: string) => {
    update((p) => { p.volumes = (p.volumes ?? []).filter((v) => v.id !== id); });
  };

  // 区间重叠提示（只提示，不强制 —— 导出时先到的卷先占章）
  const overlapIds = new Set<string>();
  for (let i = 1; i < projectVolumes.length; i++) {
    if (projectVolumes[i].startOrder <= projectVolumes[i - 1].endOrder) {
      overlapIds.add(projectVolumes[i - 1].id);
      overlapIds.add(projectVolumes[i].id);
    }
  }

  const runDirect = async () => {
    try {
      const handle = target ?? (await pickTargetDirectory());
      if (await looksLikeAiContextDir(handle)) {
        const ok = await confirm(
          '目标看起来是 AI 上下文目录',
          `「${handle.name}/」顶层已有 00-overview.md / novel-context.json。新导出会在所选目录内再建「<书名>-ai-context/」与「正文/」，通常应选择其上级工作区根目录（如 yrdy/）。仍要写入该目录吗？`,
          false,
        );
        if (!ok) return;
      }
      setTarget(handle);
      const stats = await writeWorkspaceToDirectory(project, handle, agents);
      pushToast(
        `已写入 ${stats.files} 个文件到「${handle.name}/」（新增 ${stats.created} · 更新 ${stats.updated} · 内容不变 ${stats.unchanged}），AI 工具可直接读取`,
        'success',
      );
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return; // 用户取消选择
      pushToast(err instanceof Error ? err.message : '导出失败', 'error');
    }
  };

  const runRepick = async () => {
    try {
      setTarget(await pickTargetDirectory());
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        pushToast(err instanceof Error ? err.message : '选择文件夹失败', 'error');
      }
    }
  };

  const runZip = async () => {
    try {
      const filename = await exportAiContextZip(project, agents);
      pushToast(`${filename} 已开始下载，解压到项目目录即可`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '导出失败', 'error');
    }
  };

  const run = async (id: (typeof FORMATS)[number]['id']) => {
    try {
      switch (id) {
        case 'txt': exportTxt(project); break;
        case 'md': exportMarkdown(project, { includeWorldbook }); break;
        case 'docx': await exportDocx(project, { includeWorldbook }); break;
        case 'epub': await exportEpub(project, { includeWorldbook }); break;
        case 'json': exportBackup(project); break;
      }
      pushToast(`《${project.name}》${FORMATS.find((f) => f.id === id)?.name} 导出成功`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '导出失败', 'error');
    }
  };

  /* ---------------- 整个工作区文件夹一键导入 ---------------- */

  // 归类组装交给模块级 assembleWorkspace（导入预览与实时同步共用）。
  const buildPlan = assembleWorkspace;

  const setPlanSafe = (files: RawWorkspaceFile[], source: string) => {
    try {
      setPlan(buildPlan(files, source));
    } catch (err) {
      setPlan(null);
      pushToast(err instanceof Error ? err.message : '解析失败', 'error');
    }
  };

  const runFolderImport = async () => {
    try {
      const handle = await pickSourceDirectory();
      const files = await readWorkspaceDir(handle);
      if (files.length === 0) { pushToast('所选文件夹里没有可读的文本文件', 'error'); return; }
      setPlanSafe(files, `「${handle.name}/」目录`);
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return; // 用户取消选择
      pushToast(err instanceof Error ? err.message : '读取文件夹失败', 'error');
    }
  };

  const runFilesImport = async () => {
    const input = dirInputRef.current;
    const fileList = input?.files;
    if (!fileList || fileList.length === 0) return;
    try {
      const files: RawWorkspaceFile[] = [];
      for (const f of Array.from(fileList)) {
        files.push({ path: f.webkitRelativePath || f.name, text: await f.text() });
      }
      setPlanSafe(files, `${files.length} 个文件`);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '解析失败', 'error');
    } finally {
      if (input) input.value = '';
    }
  };

  const commitImport = async (mode: 'new' | 'overwrite') => {
    if (!plan) return;
    const { project: p, seeds } = plan;
    const name = p.name;
    if (mode === 'new') {
      const ok = await confirm('导入为新作品', `将把「${name}」导入为一部新作品并载入（${p.characters.length} 人物 · ${p.chapters.length} 章节 · ${p.docs?.length ?? 0} 篇文档），不影响现有作品。继续吗？`, false);
      if (!ok) return;
      try {
        // 换新 ID，避免与库内同 ID 旧作品互相覆盖
        await importProject({ ...p, id: newId() });
        if (seeds.length) importAgents(seeds);
        pushToast(`《${name}》已导入为新作品并载入`, 'success');
        setPlan(null);
      } catch (err) {
        pushToast(err instanceof Error ? err.message : '导入失败', 'error');
      }
      return;
    }
    const ok = await confirm('覆盖当前作品', `确定用「${name}」覆盖当前作品《${project?.name ?? ''}》的全部数据吗？此操作不可撤销（建议先导出一份 JSON 备份）。`);
    if (!ok) return;
    try {
      await importProject(p);
      if (seeds.length) importAgents(seeds);
      pushToast(`当前作品已替换为《${name}》`, 'success');
      setPlan(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '导入失败', 'error');
    }
  };

  /* ---------------- 本地文件夹双向同步（仅桌面端） ---------------- */

  const withSyncGuard = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setSyncBusy(true);
    try { await fn(); } finally { busyRef.current = false; setSyncBusy(false); }
  };

  const pickSyncDir = async () => {
    try {
      const handle = await pickTargetDirectory(); // 与导出共用同一目标目录（持久化句柄）
      setTarget(handle);
      baselineRef.current = {};
      if (autoSync) await withSyncGuard(async () => { await pushWorkspace(handle, baselineRef); setLastSyncAt(Date.now()); });
      pushToast(`已绑定同步文件夹「${handle.name}/」`, 'success');
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') pushToast(err instanceof Error ? err.message : '选择文件夹失败', 'error');
    }
  };

  const manualPush = () => withSyncGuard(async () => {
    if (!target) return;
    try {
      await pushWorkspace(target, baselineRef);
      setLastSyncAt(Date.now());
      pushToast('已推送最新数据到本地文件夹', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '推送失败', 'error');
    }
  });

  const manualPull = () => withSyncGuard(async () => {
    if (!target) return;
    try {
      const changed = await pullWorkspace(target, baselineRef);
      setLastSyncAt(Date.now());
      pushToast(changed ? `已从本地拉取并合并 ${changed} 个变更文件` : '本地文件夹没有新变更', changed ? 'success' : 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '拉取失败', 'error');
    }
  });

  const toggleSync = (v: boolean) => {
    setAutoSync(v);
    localStorage.setItem(AUTOSYNC_KEY, v ? '1' : '0');
    if (v && target) {
      void withSyncGuard(async () => {
        try {
          await pushWorkspace(target, baselineRef);
          setLastSyncAt(Date.now());
          pushToast('自动同步已开启，已推送当前数据到本地', 'success');
        } catch (err) {
          pushToast(err instanceof Error ? err.message : '同步失败', 'error');
        }
      });
    }
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h2>导出中心<span className="page__en">EXPORT</span></h2>
          <p className="page__sub">《{project.name}》· {project.chapters.length} 章 · 全部格式在本机生成，不经任何服务器</p>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={includeWorldbook} onChange={(e) => setIncludeWorldbook(e.target.checked)} />
          附带设定集附录（人物/势力/地点/物品/大事记）
        </label>
      </header>

      {/* 分卷管理：正文分卷导出与设定集分卷视图共用 */}
      <section className="glass-panel ai-export">
        <header className="glass-panel__head">
          <h3>分卷管理<span className="head-en">VOLUMES</span></h3>
        </header>
        <div className="ai-export__body">
          <p className="ai-export__desc">
            分卷按<b>全书章号区间</b>（含首尾）划定，是「AI 上下文包导出」落正文分卷
            （<code>正文/卷NN-卷名/卷首.md</code> + <code>第NNN章-章题.md</code>）与设定集分卷视图的依据。
            回导整卷合稿（<code>导出合并稿/卷XX-卷名.md</code>）时若无分卷数据会自动建立。
          </p>
          {projectVolumes.length === 0 && (
            <p className="dim" style={{ margin: '4px 0 8px' }}>
              尚未定义分卷：正文将统一导出到「正文/未分卷/」。建议先按卷定义区间（如 卷01：第 1–33 章）。
            </p>
          )}
          <div style={{ display: 'grid', gap: 6 }}>
            {projectVolumes.map((v, i) => {
              const count = project.chapters.filter((c) => c.order >= v.startOrder && c.order <= v.endOrder).length;
              return (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="dim" style={{ width: 44 }}>卷{String(i + 1).padStart(2, '0')}</span>
                  <Input value={v.name} placeholder="卷名（如 风雪入青云）" style={{ width: 200 }}
                    onChange={(e) => patchVolume(v.id, { name: e.target.value })} />
                  <label className="dim">第
                    <Input type="number" min={1} value={v.startOrder} style={{ width: 76, margin: '0 4px' }}
                      onChange={(e) => patchVolume(v.id, { startOrder: Math.max(1, Number(e.target.value) || 1) })} />
                    至
                    <Input type="number" min={1} value={v.endOrder} style={{ width: 76, margin: '0 4px' }}
                      onChange={(e) => patchVolume(v.id, { endOrder: Math.max(1, Number(e.target.value) || 1) })} />
                    章
                  </label>
                  <span className="dim">· {count} 章</span>
                  {overlapIds.has(v.id) && <span style={{ color: 'var(--danger, #e07070)' }}>区间重叠</span>}
                  <Button variant="glass" icon={<IconTrash size={13} />} onClick={() => void removeVolume(v.id)}>删除</Button>
                </div>
              );
            })}
          </div>
          <div className="ai-export__ops" style={{ marginTop: 10 }}>
            <Button icon={<IconPlus size={14} />} onClick={addVolume}>添加分卷</Button>
          </div>
        </div>
      </section>

      {/* AI 上下文包：供 ZCode / Codex / Qoder 等外部 AI 编程助手直接阅读 */}
      <section className="glass-panel ai-export" style={{ marginTop: 20 }}>
        <header className="glass-panel__head">
          <h3>AI 上下文包<span className="head-en">AI CONTEXT PACK</span></h3>
        </header>
        <div className="ai-export__body">
          <p className="ai-export__desc">
            目标选择<b>工作区根目录</b>（如 <code>yrdy/</code>），导出生成与写作工作区同构的三部分：
            <b>「{project.name}-ai-context/」</b>（00-09 号主题文件 + novel-context.json，文件名稳定、全量覆盖）、
            <b>「正文/卷NN-卷名/」</b>（卷首.md + 第NNN章-章题.md，NNN 为全书全局章号，三位补零）
            与<b>「agents/NN-名字/SOUL.md」</b>（设置中启用的{agents.length > 0 ? ` ${agents.length} 张智能体角色卡` : '智能体角色卡'}）。
            只增改、不删除：工作区里多出的文件（AI 新写的章节、<code>10-outline.md</code> /
            <code>11-writing-log.md</code> 等）一律不动。
          </p>
          <div className="ai-export__ops">
            {canDirect && (
              <Button variant="primary" icon={<IconExport size={14} />} onClick={() => void runDirect()}>
                {target ? `导出到「${target.name}/」` : '选择工作区根目录并导出'}
              </Button>
            )}
            {canDirect && target && (
              <Button variant="glass" icon={<IconUpload size={14} />} onClick={() => void runRepick()}>
                重选目录
              </Button>
            )}
            <Button variant={canDirect ? 'glass' : 'primary'} icon={<IconGraph size={14} />} onClick={() => void runZip()}>
              下载 ZIP{canDirect ? '（其他浏览器回退）' : '（当前浏览器不支持直写）'}
            </Button>
          </div>
          {target && <p className="dim ai-export__target">目标根目录：{target.name}/ · 再次导出一键覆盖（内容不变的文件自动跳过），无需重新选择</p>}
        </div>
      </section>

      {/* 整个工作区文件夹一键导入：目录句柄（Chromium）/ webkitdirectory（回退） */}
      <section className="glass-panel ai-export" style={{ marginTop: 20 }}>
        <header className="glass-panel__head">
          <h3>导入工作区<span className="head-en">WORKSPACE IMPORT</span></h3>
        </header>
        <div className="ai-export__body">
          <p className="ai-export__desc">
            选择一个写作工作区根目录（如 <code>yrdy/</code>），自动识别并一次导入：
            <code>novel-context.json</code>（图谱 + 章节）、<code>正文/第NNN章.md</code> 与
            <code>导出合并稿/卷XX.md</code>（按全局章号刷新正文）、<code>agents/**/SOUL.md</code>（智能体角色卡），
            以及其余 <code>setting/</code>·<code>ledger/</code>·<code>reports/</code>·<code>promo/</code>·根级 <code>*.md</code>
            等全部文档（进「文档」页）。<code>.writing/</code>、<code>node_modules</code>、二进制文件自动忽略。
          </p>
          <div className="ai-export__ops">
            {canDirect && (
              <Button variant="primary" icon={<IconUpload size={14} />} onClick={() => void runFolderImport()}>
                选择工作区文件夹导入
              </Button>
            )}
            <Button variant={canDirect ? 'glass' : 'primary'} icon={<IconBook size={14} />} onClick={() => dirInputRef.current?.click()}>
              {canDirect ? '按文件方式选文件夹（回退）' : '选择文件夹导入'}
            </Button>
            <input ref={dirInputRef} type="file" style={{ display: 'none' }}
              {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
              multiple
              onChange={() => void runFilesImport()} />
          </div>

          {plan && (
            <div className="import-summary">
              <div className="import-summary__title">
                <b>《{plan.project.name}》</b>
                <span className="dim"> · 来源：{plan.source}{plan.counts.hasBundle ? '' : ' · 无 JSON，仅正文/文档'}</span>
              </div>
              <ul className="import-summary__list">
                <li>图谱：{plan.project.characters.length} 人物 · {plan.project.relations.length} 关系 · {plan.project.events.length} 事件 · {plan.project.locations.length} 地点 · {plan.project.factions.length} 势力 · {plan.project.items.length} 物品</li>
                <li>正文：{plan.counts.chapters} 章 · 约 {countWords(plan.project).toLocaleString()} 字（逐章 {plan.counts.chapterFiles} · 合并稿 {plan.counts.mergedVolumes}）</li>
                <li>文档：{plan.counts.docs} 篇{Object.keys(plan.counts.docByCategory).length > 0 && (
                  <span className="dim">（{Object.entries(plan.counts.docByCategory).map(([c, n]) => `${DOC_CATEGORY_LABELS[c as DocCategory]} ${n}`).join('、')}）</span>
                )}</li>
                <li>智能体：{plan.counts.agents} 张角色卡</li>
                {plan.counts.skipped > 0 && <li className="dim">已忽略 {plan.counts.skipped} 个缓存 / 二进制文件</li>}
              </ul>
            </div>
          )}
          <div className="ai-export__ops" style={{ marginTop: 12 }}>
            <Button variant="primary" icon={<IconSparkles size={14} />} disabled={!plan} onClick={() => void commitImport('new')}>
              导入为新作品
            </Button>
            <Button variant="glass" icon={<IconUpload size={14} />} disabled={!plan} onClick={() => void commitImport('overwrite')}>
              覆盖当前作品
            </Button>
            {plan && <Button variant="glass" onClick={() => setPlan(null)}>清除</Button>}
          </div>
          <p className="dim ai-export__target">
            提示：「导入为新作品」分配新 ID、不影响库内其他作品；「覆盖当前作品」整库替换。
            导入后可在「文档」页查看/编辑 setting·ledger·reports·promo 等文档，再次导出会原路径回写。
          </p>
        </div>
      </section>

      {/* 本地文件夹双向同步：应用 ⇄ 本地目录 自动保持同步（仅桌面客户端） */}
      <section className="glass-panel ai-export" style={{ marginTop: 20 }}>
        <header className="glass-panel__head">
          <h3>本地文件夹同步<span className="head-en">LIVE SYNC · DESKTOP</span></h3>
        </header>
        <div className="ai-export__body">
          <p className="ai-export__desc">
            绑定工作区文件夹后，应用内的修改会<b>自动写回本地</b>；你在其他编辑器 / AI 工具里改这些文件，
            应用也会<b>自动读取并更新</b>，两边保持同步。与「AI 上下文包导出」共用同一目标目录。
            {!canSync && <><b style={{ color: 'var(--danger)' }}> 此功能仅在桌面客户端可用</b>，网页版无法实时读写本地文件系统。</>}
          </p>
          <div className="ai-export__ops">
            <Button variant="primary" icon={<IconUpload size={14} />} disabled={!canSync} onClick={() => void pickSyncDir()}>
              {target ? `同步文件夹：${target.name}/（更换）` : '选择同步文件夹'}
            </Button>
            <label className={`check-row${canSync ? '' : ' is-disabled'}`}>
              <input type="checkbox" checked={autoSync} disabled={!canSync} onChange={(e) => toggleSync(e.target.checked)} />
              自动双向同步
            </label>
          </div>
          <div className="ai-export__ops" style={{ marginTop: 10 }}>
            <Button variant="glass" icon={<IconExport size={14} />} disabled={!canSync || !target || syncBusy} onClick={() => void manualPush()}>立即推送到本地</Button>
            <Button variant="glass" icon={<IconRefresh size={14} />} disabled={!canSync || !target || syncBusy} onClick={() => void manualPull()}>立即从本地拉取</Button>
            <span className="dim">
              {syncBusy ? '同步中…' : lastSyncAt > 0 ? `上次同步：${new Date(lastSyncAt).toLocaleTimeString('zh-CN')}` : '尚未同步'}
            </span>
          </div>
          {canSync && !target && <p className="dim ai-export__target">尚未选择同步文件夹。选择后可开启自动同步；首次会先推送建立基线。</p>}
          {canSync && autoSync && <p className="dim ai-export__target">自动同步已开启：作品变动后 2 秒写回本地，每 6 秒拉取一次外部改动（基于内容比对，不会把自己刚写的回灌）。</p>}
        </div>
      </section>

      <div className="export-grid">
        {FORMATS.map((f) => (
          <div key={f.id} className="export-card">
            <f.icon size={26} />
            <h3>{f.name}</h3>
            <p>{f.desc}</p>
            <Button variant={f.id === 'json' ? 'glass' : 'primary'} icon={<IconExport size={14} />}
              onClick={() => void run(f.id)}>导出</Button>
          </div>
        ))}
      </div>

      <section className="glass-panel" style={{ marginTop: 24 }}>
        <header className="glass-panel__head"><h3>从备份恢复</h3></header>
        <div style={{ padding: 16 }}>
          <p className="dim" style={{ marginBottom: 12 }}>
            选择之前导出的 JSON 备份文件。恢复会<b>覆盖当前作品数据</b>（以备份中的作品 ID 为准）。
          </p>
          <Button icon={<IconUpload size={14} />} onClick={() => fileRef.current?.click()}>选择备份文件</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }}
            onChange={async () => {
              const file = fileRef.current?.files?.[0];
              if (!file) return;
              const ok = await confirm('恢复备份', `确定用「${file.name}」恢复作品数据吗？当前对应作品将被覆盖。`);
              if (!ok) { if (fileRef.current) fileRef.current.value = ''; return; }
              try {
                const p = await importBackup(file);
                await importProject(p);
                pushToast(`作品「${p.name}」已恢复并载入`, 'success');
              } catch (err) {
                pushToast(err instanceof Error ? err.message : '恢复失败', 'error');
              } finally {
                if (fileRef.current) fileRef.current.value = '';
              }
            }} />
        </div>
      </section>
    </div>
  );
}
