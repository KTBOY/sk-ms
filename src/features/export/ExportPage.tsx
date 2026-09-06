import { useEffect, useMemo, useRef, useState } from 'react';
import { exportTxt, exportMarkdown } from '../../core/export/textExport';
import { exportDocx } from '../../core/export/docxExport';
import { exportEpub } from '../../core/export/epubExport';
import { exportBackup, importBackup } from '../../core/export/backup';
import {
  exportAiContextZip, getSavedTarget, pickTargetDirectory,
  supportsDirectoryExport, writeAiContextToDirectory, type DirHandle,
} from '../../core/export/aiExport';
import {
  parseContextBundle, parseVolumeMarkdown, applyVolumes, countWords,
  type ParsedVolume, type VolumeMergeResult,
} from '../../core/import/aiImport';
import type { Project } from '../../core/types';
import { newId } from '../../core/id';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Button } from '../../components/ui/primitives';
import { IconBook, IconExport, IconGraph, IconItem, IconSparkles, IconUpload, IconUser } from '../../components/icons';

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
  const pushToast = useUIStore((s) => s.pushToast);
  const confirm = useUIStore((s) => s.confirm);
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

  const runDirect = async () => {
    try {
      const handle = target ?? (await pickTargetDirectory());
      setTarget(handle);
      const count = await writeAiContextToDirectory(project, handle);
      pushToast(`已写入 ${count} 个文件到「${handle.name}/」，AI 工具可直接读取`, 'success');
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return; // 用户取消选择
      pushToast(err instanceof Error ? err.message : '导出失败', 'error');
    }
  };

  const runZip = async () => {
    try {
      const filename = await exportAiContextZip(project);
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

      {/* AI 上下文包：供 ZCode / Codex / Qoder 等外部 AI 编程助手直接阅读 */}
      <section className="glass-panel ai-export">
        <header className="glass-panel__head">
          <h3>AI 上下文包<span className="head-en">AI CONTEXT PACK</span></h3>
        </header>
        <div className="ai-export__body">
          <p className="ai-export__desc">
            把人物档案、关系图谱、事件因果、时间线、势力 / 地点 / 物品与一致性提示，
            导出为 <b>11 个主题文件</b>（Markdown + JSON，文件名稳定、全量覆盖）。
            目标文件夹建议放在作品仓库内（如 <code>ai-context/</code>），
            ZCode / Codex / Qoder 即可直接阅读引用；每次导出覆盖同名文件，外部引用不失效。
          </p>
          <div className="ai-export__ops">
            {canDirect && (
              <Button variant="primary" icon={<IconExport size={14} />} onClick={() => void runDirect()}>
                {target ? `重新导出到「${target.name}/」` : '选择文件夹并导出'}
              </Button>
            )}
            <Button variant={canDirect ? 'glass' : 'primary'} icon={<IconGraph size={14} />} onClick={() => void runZip()}>
              下载 ZIP{canDirect ? '（其他浏览器回退）' : '（当前浏览器不支持直写）'}
            </Button>
          </div>
          {target && <p className="dim ai-export__target">目标文件夹：{target.name}/ · 再次导出一键覆盖，无需重新选择</p>}
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
            （结构化全量，兼容 JSON 备份），可选配 <code>卷01-xxx.md</code> 等正文分卷文件合并最新章节。
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
