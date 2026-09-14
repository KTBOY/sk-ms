import { useEffect, useMemo, useRef, useState } from 'react';
import { exportTxt, exportMarkdown } from '../../core/export/textExport';
import { exportDocx } from '../../core/export/docxExport';
import { exportEpub } from '../../core/export/epubExport';
import { exportBackup, importBackup } from '../../core/export/backup';
import {
  exportAiContextZip, getSavedTarget, looksLikeAiContextDir, pickTargetDirectory,
  supportsDirectoryExport, volumeList, writeWorkspaceToDirectory, type DirHandle,
} from '../../core/export/aiExport';
import {
  parseContextBundle, parseVolumeMarkdown, applyVolumes, countWords,
  type ParsedVolume, type VolumeMergeResult,
} from '../../core/import/aiImport';
import type { Project, Volume } from '../../core/types';
import { newId } from '../../core/id';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Button, Input } from '../../components/ui/primitives';
import { IconBook, IconExport, IconGraph, IconItem, IconPlus, IconSparkles, IconTrash, IconUpload, IconUser } from '../../components/icons';

/** 导出中心：AI 上下文包 / TXT / Markdown / DOCX / EPUB / JSON 备份 + 恢复。 */

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
  const update = useProjectStore((s) => s.update);
  const pushToast = useUIStore((s) => s.pushToast);
  const confirm = useUIStore((s) => s.confirm);
  const agents = useProjectStore((s) => s.appSettings.agents ?? []);
  const [includeWorldbook, setIncludeWorldbook] = useState(true);
  const [target, setTarget] = useState<DirHandle | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bundleRef = useRef<HTMLInputElement>(null);
  const volumeRef = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState<Project | null>(null);
  const [volumes, setVolumes] = useState<ParsedVolume[]>([]);
  const [volumeInfo, setVolumeInfo] = useState<{ added: number; updated: number } | null>(null);

  useEffect(() => {
    void getSavedTarget().then(setTarget).catch(() => setTarget(null));
  }, []);

  if (!project) return null;

  const canDirect = supportsDirectoryExport();
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

  /* ---------------- AI 上下文包回导 ---------------- */

  // 分卷合并预览：选了卷文件就在「导入的 JSON 作品」之上即时演算合并结果
  const mergedPreview = useMemo<VolumeMergeResult | null>(() => {
    if (!imported) return null;
    if (volumes.length === 0) return null;
    try {
      return applyVolumes(imported, volumes);
    } catch {
      return null;
    }
  }, [imported, volumes]);

  const importTarget = mergedPreview?.project ?? imported;

  const handleBundleFile = async () => {
    const file = bundleRef.current?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseContextBundle(text);
      setImported(parsed);
      setVolumeInfo(null);
      pushToast(`已解析「${file.name}」：${parsed.characters.length} 人物 · ${parsed.chapters.length} 章节`, 'success');
    } catch (err) {
      setImported(null);
      pushToast(err instanceof Error ? err.message : '解析失败', 'error');
    } finally {
      if (bundleRef.current) bundleRef.current.value = '';
    }
  };

  const handleVolumeFiles = async () => {
    const files = Array.from(volumeRef.current?.files ?? []);
    if (files.length === 0) return;
    try {
      const parsed: ParsedVolume[] = [];
      for (const f of files) parsed.push(parseVolumeMarkdown(f.name, await f.text()));
      setVolumes(parsed);
      if (imported) {
        const preview = applyVolumes(imported, parsed);
        setVolumeInfo({ added: preview.added, updated: preview.updated });
      }
      pushToast(`已解析 ${parsed.length} 个分卷文件，共 ${parsed.reduce((a, v) => a + v.chapters.length, 0)} 章`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '分卷解析失败', 'error');
    } finally {
      if (volumeRef.current) volumeRef.current.value = '';
    }
  };

  const runImport = async (mode: 'new' | 'overwrite') => {
    if (!importTarget) return;
    const name = importTarget.name;
    if (mode === 'new') {
      const ok = await confirm('导入为新作品', `将把「${name}」导入为一部新作品并载入（${importTarget.characters.length} 人物 · ${importTarget.chapters.length} 章节），不影响现有作品。继续吗？`, false);
      if (!ok) return;
      try {
        // 换新 ID，避免与库内同 ID 旧作品互相覆盖
        await importProject({ ...importTarget, id: newId() });
        pushToast(`《${name}》已导入为新作品并载入`, 'success');
        setImported(null); setVolumes([]); setVolumeInfo(null);
      } catch (err) {
        pushToast(err instanceof Error ? err.message : '导入失败', 'error');
      }
      return;
    }
    const ok = await confirm('覆盖当前作品', `确定用「${name}」覆盖当前作品《${project?.name ?? ''}》的全部数据吗？此操作不可撤销（建议先导出一份 JSON 备份）。`);
    if (!ok) return;
    try {
      await importProject(importTarget);
      pushToast(`当前作品已替换为《${name}》`, 'success');
      setImported(null); setVolumes([]); setVolumeInfo(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '导入失败', 'error');
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

      {/* AI 上下文包回导：把外部 AI 工作区产出的数据导回应用 */}
      <section className="glass-panel ai-export" style={{ marginTop: 20 }}>
        <header className="glass-panel__head">
          <h3>AI 上下文包回导<span className="head-en">AI CONTEXT IMPORT</span></h3>
        </header>
        <div className="ai-export__body">
          <p className="ai-export__desc">
            把 AI 工作区（ZCode 等）维护的上下文包导回应用：选择 <code>novel-context.json</code>
            （结构化全量，兼容 JSON 备份），可选配 <code>导出合并稿/卷XX-卷名.md</code> 等正文分卷文件合并最新章节
            ——作品尚无分卷数据时，会按所选卷文件的范围<b>自动建立分卷</b>。
            <code>00-09</code> 号 Markdown 是导出视图，无需导入；<code>10-outline.md</code> /
            <code>11-writing-log.md</code> 属于 AI 工作区文件，不参与导入。
          </p>
          <div className="ai-export__ops">
            <Button icon={<IconUpload size={14} />} onClick={() => bundleRef.current?.click()}>
              ① 选择 novel-context.json
            </Button>
            <Button icon={<IconBook size={14} />} onClick={() => volumeRef.current?.click()}>
              ② 选择正文分卷（可选，可多选）
            </Button>
            <input ref={bundleRef} type="file" accept="application/json,.json" style={{ display: 'none' }}
              onChange={() => void handleBundleFile()} />
            <input ref={volumeRef} type="file" accept=".md,.markdown,.txt" multiple style={{ display: 'none' }}
              onChange={() => void handleVolumeFiles()} />
          </div>
          {importTarget && (
            <div style={{ marginTop: 12, padding: '10px 14px', border: '1px solid var(--border-dim, rgba(255,255,255,.12))', borderRadius: 8 }}>
              <b>《{importTarget.name}》</b>
              <span className="dim">
                {' '}· {importTarget.genre || '未设类型'} · {importTarget.characters.length} 人物 · {importTarget.relations.length} 关系 ·
                {' '}{importTarget.events.length} 事件 · {importTarget.locations.length} 地点 · {importTarget.factions.length} 势力 ·
                {' '}{importTarget.items.length} 物品 · {importTarget.chapters.length} 章 · 约 {countWords(importTarget).toLocaleString()} 字
              </span>
              {volumes.length > 0 && (
                <p className="dim" style={{ margin: '6px 0 0' }}>
                  已选 {volumes.length} 个分卷（{volumes.map((v) => v.volumeTitle).join('、')}）
                  {volumeInfo ? <>：合并预览 —— 更新 {volumeInfo.updated} 章 · 新增 {volumeInfo.added} 章</> : '（选择 JSON 后自动预览合并）'}
                </p>
              )}
              {mergedPreview && mergedPreview.untouched > 0 && (
                <p className="dim" style={{ margin: '4px 0 0' }}>另有 {mergedPreview.untouched} 章与导入包一致，无需变动</p>
              )}
            </div>
          )}
          <div className="ai-export__ops" style={{ marginTop: 12 }}>
            <Button variant="primary" icon={<IconSparkles size={14} />} disabled={!importTarget} onClick={() => void runImport('new')}>
              导入为新作品
            </Button>
            <Button variant="glass" icon={<IconUpload size={14} />} disabled={!importTarget} onClick={() => void runImport('overwrite')}>
              覆盖当前作品
            </Button>
          </div>
          <p className="dim ai-export__target">
            提示：「导入为新作品」会分配新作品 ID，不影响库内任何作品；「覆盖当前作品」以导入包数据整库替换。
            导入后再次执行「AI 上下文包导出」会以应用数据覆盖工作区里的 00-09 号文件与 JSON（10/11 号 AI 工作区文件不受影响）。
          </p>
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
