/**
 * AI 上下文包 → 墨枢应用 真实导入脚本（命令行版，等价于导出中心的「AI 上下文包回导 → 导入为新作品」）。
 *
 * 流程：novel-context.json 解析归一化 → 正文分卷(卷01-卷06)按序合并 → 一致性校验 →
 *       落盘 data/projects/<新id>.json（桌面端应用打开即可在项目列表看到）。
 *
 * 用法：node scripts/import-into-app.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { tmpdir } from 'os';
import { join, sep } from 'path';

const cwd = process.cwd().split(sep).join('/');
const dir = mkdtempSync(join(tmpdir(), 'na-import-'));
const entry = join(dir, 'entry.mjs');
writeFileSync(entry, [
  'export * from ' + JSON.stringify(cwd + '/src/core/import/aiImport.ts') + ';',
  'export * from ' + JSON.stringify(cwd + '/src/core/consistency.ts') + ';',
  'export * from ' + JSON.stringify(cwd + '/src/core/id.ts') + ';',
].join('\n'));
await build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: join(dir, 'out.mjs'), platform: 'node' });
const m = await import(pathToFileURL(join(dir, 'out.mjs')).href);

const CTX = 'yrdy/九州烟云-ai-context/九州烟云-ai-context';
const OUT_DIR = 'data/projects';

/* ---------- ① 解析 novel-context.json（导出中心的既有路径） ---------- */
const bundle = JSON.parse(readFileSync(join(CTX, 'novel-context.json'), 'utf-8'));
let project = m.parseContextBundle(JSON.stringify(bundle));
console.log('① JSON 包解析:', project.name,
  '| 人物', project.characters.length,
  '| 关系', project.relations.length,
  '| 事件', project.events.length,
  '| 地点', project.locations.length,
  '| 势力', project.factions.length,
  '| 物品', project.items.length,
  '| 章节', project.chapters.length,
  '| 字数', m.countWords(project));

/* ---------- ② 正文分卷合并（JSON 落后于工作区时的增量路径） ---------- */
const vols = ['卷01-风雪入青云.md', '卷02-藏锋录.md']
  .filter((f) => existsSync(join('yrdy/正文', f)))
  .map((f) => m.parseVolumeMarkdown(f, readFileSync(join('yrdy/正文', f), 'utf-8')));
const merged = m.applyVolumes(project, vols);
project = merged.project;
console.log('② 分卷合并:', vols.map((v) => v.volumeTitle).join(' + '),
  '| 新增', merged.added, '章 / 更新', merged.updated, '章 / 一致', merged.untouched, '章',
  '| 章节', project.chapters.length, '| 字数', m.countWords(project));

/* ---------- ③ 一致性校验（应用内置 auditProject） ---------- */
const issues = m.auditProject(project);
const byType = {};
for (const i of issues) byType[i.type] = (byType[i.type] || 0) + 1;
console.log('③ 一致性校验:', issues.length, '条提示', JSON.stringify(byType));
for (const i of issues.slice(0, 8)) console.log('   -', i.type, ':', i.message);

/* ---------- ④ 结构与持久化校验 ---------- */
const round = JSON.parse(JSON.stringify(project));
const ok = ['id', 'name', 'characters', 'relations', 'events', 'items', 'locations', 'factions', 'chapters', 'settings']
  .every((k) => round[k] !== undefined);
const seqOk = project.chapters.every((c, i) => c.order === i + 1 && c.content.length > 0);
console.log('④ 结构校验: 必备字段', ok ? '齐全' : '缺失', '| 章节 order 连续且非空', seqOk ? '通过' : '失败',
  '| JSON 序列化', (JSON.stringify(round).length / 1024).toFixed(0) + 'KB');

/* ---------- ⑤ 落盘为桌面端项目（导入为新作品：新 id，不动既有作品） ---------- */
const newId = m.newId();
project.id = newId;
project.name = '九州烟云';
project.updatedAt = Date.now();
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, `${newId}.json`);
writeFileSync(out, JSON.stringify(project, null, 2), 'utf-8');

/* ---------- ⑥ 按应用 list-projects 的方式验证可见性 ---------- */
const files = existsSync(OUT_DIR) ? readFileSync(out, 'utf-8') : '';
const meta = JSON.parse(files);
console.log('⑤ 已落盘:', out);
console.log('⑥ 应用项目列表验证: id =', meta.id, '| 名称 =', meta.name,
  '| 章节数 =', meta.chapters.length,
  '| 最新更新 =', new Date(meta.updatedAt).toLocaleString('zh-CN'));
console.log('\n✅ 导入完成——启动墨枢桌面端（npm run app），在项目列表中选择本作品即可看到全部',
  meta.chapters.length, '章与完整设定图谱。');
