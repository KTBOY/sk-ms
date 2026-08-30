import JSZip from 'jszip';
import type { Project } from '../types';
import { auditProject } from '../consistency';
import { downloadBlob, sanitize } from './index';

/**
 * AI 上下文包导出 —— 把设定图谱导出为 AI 编程助手（ZCode / Codex / Qoder 等）
 * 可直接阅读的本地 Markdown 文件集 + 机器可读 JSON。
 *
 * 两条落盘路径：
 * - Chromium：File System Access API，用户选一次目标文件夹（句柄存 IndexedDB 持久化），
 *   之后每次导出直接覆写本地文件 —— 真正的「直接导出到本地」。
 * - 其余浏览器：回退下载 ZIP，用户解压到项目目录。
 *
 * 本模块的 buildAiContextFiles 是纯函数（零 DOM 依赖），可独立验证。
 */

export interface AiContextFile {
  name: string;
  content: string;
}

const fmtDate = (ts: number) => new Date(ts).toLocaleString('zh-CN');
const cell = (s: string) => s.replace(/\|/g, '｜').replace(/\s*\n+\s*/g, ' ');
const dim = (s: string) => (s && s.trim() ? s.trim() : '—');

/* ---------------- 名称解析工具 ---------------- */

function characterName(project: Project, id: string | null | undefined): string {
  return project.characters.find((c) => c.id === id)?.name ?? '？';
}
function locationName(project: Project, id: string | null | undefined): string {
  return project.locations.find((l) => l.id === id)?.name ?? '—';
}
function factionName(project: Project, id: string | null | undefined): string {
  return project.factions.find((f) => f.id === id)?.name ?? '无';
}
const sortedEvents = (project: Project) => [...project.events].sort((a, b) => a.sortIndex - b.sortIndex);
const sortedChapters = (project: Project) => [...project.chapters].sort((a, b) => a.order - b.order);

/* ---------------- 各文件构建 ---------------- */

function buildOverview(project: Project): string {
  const words = project.chapters.reduce((acc, c) => acc + c.content.replace(/\s/g, '').length, 0);
  const files: Array<[string, string]> = [
    ['01-characters.md', '人物完整档案（身份、外貌、性格、背景、目标、五维数值）'],
    ['02-relationships.md', '人物关系图谱（边表：谁 → 谁、关系类型、强度、备注）'],
    ['03-events.md', '事件因果网络（时间序，含前因 → 后果链、参与者、地点）'],
    ['04-timeline.md', '编年大事记（按全书时间序排列的紧凑列表）'],
    ['05-locations.md', '地点设定'],
    ['06-factions.md', '势力设定'],
    ['07-items.md', '物品设定'],
    ['08-chapters.md', '章节索引（标题 / 状态 / 字数 / 简介，不含正文）'],
    ['09-consistency.md', '当前一致性校验结果（悬空引用、别名冲突、因果时序等）'],
    ['novel-context.json', '全量结构化数据（已剔除 API 密钥，供脚本 / 工具管道使用）'],
  ];
  return [
    `# 《${project.name}》 · 小说设定上下文`,
    '',
    `> 本目录由 墨枢 NovelAtlas 自动导出，供 AI 写作 / 编程助手阅读。导出时间：${fmtDate(Date.now())}`,
    '',
    '## 作品概况',
    '',
    `- 书名：《${project.name}》`,
    `- 类型：${dim(project.genre)}`,
    `- 简介：${dim(project.description)}`,
    `- 规模：${project.characters.length} 人物 · ${project.relations.length} 关系 · ${project.events.length} 事件 · ${project.chapters.length} 章节 · 约 ${words.toLocaleString()} 字`,
    '- 数据更新于：' + fmtDate(project.updatedAt),
    '',
    '## 文件索引',
    '',
    '| 文件 | 内容 |',
    '|---|---|',
    ...files.map(([name, desc]) => `| ${name} | ${desc} |`),
    '',
    '## 给 AI 的阅读约定',
    '',
    '1. 写新章节前：先读 `01-characters.md` 与 `03-events.md`；涉及谁，就回到该人物档案核对性格、目标与口吻。',
    '2. 「重要度」与「关系强度」均为 1-5，5 为最高。',
    '3. 时间有两套表示：`timeLabel`（如「第三年·春」，给人看）与 `sortIndex`（全书唯一时间序，给排序用）。因果方向永远遵循 `03-events.md` 中的 前因 → 后果。',
    '4. 人物已死亡（状态标注）后不应再出场，除非是回忆/闪回场景。',
    '5. 实体间引用一律用「名字」；需要 ID 对齐时使用 `novel-context.json`。',
    '',
    `共 ${files.length} 个文件，均为全量覆盖式导出 —— 文件名稳定，外部引用不会失效。`,
    '',
  ].join('\n');
}

function buildCharacters(project: Project): string {
  const parts: string[] = [
    '# 人物档案',
    '',
    `> 共 ${project.characters.length} 人。五维数值范围 0-100。`,
    '',
  ];
  const roleOrder = ['主角', '配角', '反派', '路人'];
  const chars = [...project.characters].sort(
    (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) || a.name.localeCompare(b.name, 'zh'),
  );
  for (const c of chars) {
    const attr = c.attributes;
    parts.push(
      `## ${c.name}（${c.role} · ${factionName(project, c.factionId)} · ${c.status}）`,
      '',
      `- ID：\`${c.id}\``,
      `- 别名：${c.aliases.length ? c.aliases.join('、') : '—'}`,
      `- 性别 / 年龄：${dim(c.gender)} / ${dim(c.age)}`,
      `- 一句话：${dim(c.description)}`,
      `- 外貌：${dim(c.appearance)}`,
      `- 性格：${dim(c.personality)}`,
      `- 背景：${dim(c.background)}`,
      `- 目标动机：${dim(c.goals)}`,
      `- 五维：力量 ${attr.power} · 智谋 ${attr.wisdom} · 魅力 ${attr.charm} · 意志 ${attr.will} · 机缘 ${attr.fortune}`,
      `- 参与事件：${project.events.filter((e) => e.participantIds.includes(c.id)).length} 场`,
      '',
    );
  }
  return parts.join('\n');
}

function buildRelationships(project: Project): string {
  const parts: string[] = [
    '# 人物关系图谱',
    '',
    `> 共 ${project.relations.length} 条关系。强度 1-5，5 为命运级羁绊。`,
    '',
    '| 人物 | 关系 | 对象 | 强度 | 备注 |',
    '|---|---|---|---|---|',
  ];
  const rels = [...project.relations].sort((a, b) => a.strength - b.strength).reverse();
  for (const r of rels) {
    parts.push(`| ${characterName(project, r.fromId)} | ${r.type} → | ${characterName(project, r.toId)} | ${r.strength} | ${cell(r.note) || '—'} |`);
  }
  if (project.relations.length === 0) parts.push('| — | — | — | — | 暂无关系 |');
  parts.push('');
  return parts.join('\n');
}

function buildEvents(project: Project): string {
  const parts: string[] = [
    '# 事件因果网络',
    '',
    '> 按全书时间序（sortIndex）排列。因果方向：前因 → 本事件 → 后果。',
    '',
  ];
  const byIndex = new Map(project.events.map((e) => [e.sortIndex, e]));
  for (const e of sortedEvents(project)) {
    const cause = e.causeIds.map((id) => project.events.find((x) => x.id === id)).filter(Boolean);
    const effect = e.effectIds.map((id) => project.events.find((x) => x.id === id)).filter(Boolean);
    parts.push(
      `## ${e.sortIndex}. ${e.name} 〔${dim(e.timeLabel)}〕`,
      '',
      `- 重要度：${e.importance}/5 · 地点：${locationName(project, e.locationId)} · 参与：${e.participantIds.map((id) => characterName(project, id)).join('、') || '—'}`,
      `- 描述：${dim(e.description)}`,
      `- 别名：${e.aliases.length ? e.aliases.join('、') : '—'}`,
      `- 前因：${(cause as Array<{ name: string; sortIndex: number }>).map((x) => `${x.name}（${x.sortIndex}）`).join('、') || '—'}`,
      `- 后果：${(effect as Array<{ name: string; sortIndex: number }>).map((x) => `${x.name}（${x.sortIndex}）`).join('、') || '—'}`,
      `- ID：\`${e.id}\`${e.chapterId ? ` · 关联章节：${sortedChapters(project).find((c) => c.id === e.chapterId)?.title ?? '—'}` : ''}`,
      '',
    );
    void byIndex;
  }
  return parts.join('\n');
}

function buildTimeline(project: Project): string {
  const parts: string[] = [
    '# 编年大事记',
    '',
    '> 紧凑版因果链，适合作为写章节时的快速参照。',
    '',
  ];
  for (const e of sortedEvents(project)) {
    const who = e.participantIds.map((id) => characterName(project, id)).join('、');
    parts.push(`- ${e.sortIndex}. 〔${dim(e.timeLabel)}〕**${e.name}**（重要度 ${e.importance}/5${who ? `，参与：${who}` : ''}）：${cell(e.description) || '—'}`);
  }
  if (project.events.length === 0) parts.push('- （暂无事件）');
  parts.push('');
  return parts.join('\n');
}

function buildLocations(project: Project): string {
  const parts: string[] = ['# 地点设定', '', `> 共 ${project.locations.length} 处。`, ''];
  for (const l of project.locations) {
    parts.push(
      `## ${l.name}${l.region ? `（区域：${l.region}）` : ''}`,
      '',
      `- 别名：${l.aliases.length ? l.aliases.join('、') : '—'}`,
      `- 上级地点：${l.parentId ? locationName(project, l.parentId) : '—'}`,
      `- 描述：${dim(l.description)}`,
      `- 关联事件：${project.events.filter((e) => e.locationId === l.id).length} 场`,
      '',
    );
  }
  return parts.join('\n');
}

function buildFactions(project: Project): string {
  const parts: string[] = ['# 势力设定', '', `> 共 ${project.factions.length} 个。`, ''];
  for (const f of project.factions) {
    parts.push(
      `## ${f.name}（${f.type}）`,
      '',
      `- 别名：${f.aliases.length ? f.aliases.join('、') : '—'}`,
      `- 首领：${f.leaderId ? characterName(project, f.leaderId) : '—'}`,
      `- 立场：${dim(f.stance)}`,
      `- 描述：${dim(f.description)}`,
      `- 成员：${project.characters.filter((c) => c.factionId === f.id).map((c) => `${c.name}（${c.role}）`).join('、') || '—'}`,
      '',
    );
  }
  return parts.join('\n');
}

function buildItems(project: Project): string {
  const parts: string[] = ['# 物品设定', '', `> 共 ${project.items.length} 件。`, ''];
  for (const i of project.items) {
    parts.push(
      `## ${i.name}（${dim(i.type)} · ${dim(i.rarity)}）`,
      '',
      `- 别名：${i.aliases.length ? i.aliases.join('、') : '—'}`,
      `- 持有者：${i.ownerId ? characterName(project, i.ownerId) : '—'}`,
      `- 所在地：${i.locationId ? locationName(project, i.locationId) : '—'}`,
      `- 来历：${dim(i.origin)}`,
      `- 现状：${dim(i.status)}`,
      `- 描述：${dim(i.description)}`,
      '',
    );
  }
  return parts.join('\n');
}

function buildChaptersIndex(project: Project): string {
  const parts: string[] = [
    '# 章节索引',
    '',
    '> 仅含元信息，不含正文。正文请使用导出中心的 TXT / Markdown 全文导出。',
    '',
    '| 序 | 标题 | 状态 | 字数 | 简介 |',
    '|---|---|---|---|---|',
  ];
  for (const c of sortedChapters(project)) {
    const words = c.content.replace(/\s/g, '').length;
    parts.push(`| ${c.order} | ${cell(c.title)} | ${c.status} | ${words} | ${cell(c.synopsis) || '—'} |`);
  }
  if (project.chapters.length === 0) parts.push('| — | （暂无章节） | — | — | — |');
  parts.push('');
  return parts.join('\n');
}

function buildConsistency(project: Project): string {
  const issues = auditProject(project);
  const parts: string[] = [
    '# 一致性校验结果',
    '',
    `> 导出时间：${fmtDate(Date.now())} · 共 ${issues.length} 条提示。`,
    '',
  ];
  if (issues.length === 0) {
    parts.push('当前无一致性问题 —— 人物引用、别名、因果时序均通过校验。', '');
    return parts.join('\n');
  }
  parts.push('| 类型 | 说明 |', '|---|---|');
  for (const i of issues) parts.push(`| ${i.type} | ${cell(i.message)} |`);
  parts.push('');
  return parts.join('\n');
}

/** JSON 全量包：剔除 API 密钥等敏感字段。 */
function buildBundle(project: Project): string {
  const safe: Project = {
    ...project,
    settings: { ai: { ...project.settings.ai, apiKey: '' } },
  };
  return JSON.stringify({ exportedAt: new Date().toISOString(), generator: 'NovelAtlas v1.0', project: safe }, null, 2);
}

/** 构建全部 AI 上下文文件（纯函数，按稳定文件名排序）。 */
export function buildAiContextFiles(project: Project): AiContextFile[] {
  return [
    { name: '00-overview.md', content: buildOverview(project) },
    { name: '01-characters.md', content: buildCharacters(project) },
    { name: '02-relationships.md', content: buildRelationships(project) },
    { name: '03-events.md', content: buildEvents(project) },
    { name: '04-timeline.md', content: buildTimeline(project) },
    { name: '05-locations.md', content: buildLocations(project) },
    { name: '06-factions.md', content: buildFactions(project) },
    { name: '07-items.md', content: buildItems(project) },
    { name: '08-chapters.md', content: buildChaptersIndex(project) },
    { name: '09-consistency.md', content: buildConsistency(project) },
    { name: 'novel-context.json', content: buildBundle(project) },
  ];
}

/* ---------------- 落盘：File System Access API（Chromium） ---------------- */

type PermDescriptor = { mode: 'read' | 'readwrite' };
export type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (d: PermDescriptor) => Promise<PermissionState>;
  requestPermission?: (d: PermDescriptor) => Promise<PermissionState>;
};

const KV_DB = 'novel-atlas-kv';
const KV_STORE = 'kv';
const DIR_KEY = 'ai-context-dir';

function openKv(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KV_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(KV_STORE)) req.result.createObjectStore(KV_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'));
  });
}

async function kvGet<T>(key: string): Promise<T | null> {
  const db = await openKv();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(KV_STORE, 'readonly');
      const req = tx.objectStore(KV_STORE).get(key);
      req.onsuccess = () => resolve((req.result ?? null) as T | null);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB 读取失败'));
    });
  } finally {
    db.close();
  }
}

async function kvSet(key: string, val: unknown): Promise<void> {
  const db = await openKv();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KV_STORE, 'readwrite');
      const req = tx.objectStore(KV_STORE).put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('IndexedDB 写入失败'));
    });
  } finally {
    db.close();
  }
}

/** 当前浏览器是否支持「直接写入本地文件夹」。 */
export function supportsDirectoryExport(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

/** 弹出系统文件夹选择器（用户应选择仓库内的目标目录，如 ai-context/）。 */
export async function pickTargetDirectory(): Promise<DirHandle> {
  const picker = (window as unknown as { showDirectoryPicker?: (o?: { mode?: 'read' | 'readwrite' }) => Promise<DirHandle> }).showDirectoryPicker;
  if (!picker) throw new Error('当前浏览器不支持文件夹直写，请使用 ZIP 回退（Chrome / Edge 可用）');
  const handle = await picker({ mode: 'readwrite' });
  await kvSet(DIR_KEY, handle);
  return handle;
}

/** 上次选择的目标文件夹（跨会话持久化）。 */
export async function getSavedTarget(): Promise<DirHandle | null> {
  return kvGet<DirHandle>(DIR_KEY);
}

async function ensureReadWrite(handle: DirHandle): Promise<boolean> {
  const q = await handle.queryPermission?.({ mode: 'readwrite' });
  if (q === 'granted') return true;
  const r = await handle.requestPermission?.({ mode: 'readwrite' });
  return r === 'granted';
}

/** 把上下文文件集直接写入目标文件夹（全量覆盖同名文件）。返回写入文件数。 */
export async function writeAiContextToDirectory(project: Project, handle: DirHandle): Promise<number> {
  if (!(await ensureReadWrite(handle))) throw new Error('未获得文件夹写入权限，请重新选择文件夹');
  const files = buildAiContextFiles(project);
  for (const f of files) {
    const fh = await handle.getFileHandle(f.name, { create: true });
    const writable = await fh.createWritable();
    await writable.write(new Blob([f.content], { type: 'text/markdown;charset=utf-8' }));
    await writable.close();
  }
  return files.length;
}

/* ---------------- 落盘回退：ZIP 下载 ---------------- */

/** 打包为 ZIP 并触发浏览器下载（不支持直写的浏览器回退路径）。返回文件名。 */
export async function exportAiContextZip(project: Project): Promise<string> {
  const zip = new JSZip();
  const root = zip.folder(`${sanitize(project.name)}-ai-context`);
  if (!root) throw new Error('ZIP 打包失败');
  for (const f of buildAiContextFiles(project)) root.file(f.name, f.content);
  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = `${sanitize(project.name)}-ai-context.zip`;
  downloadBlob(filename, blob);
  return filename;
}
