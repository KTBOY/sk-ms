import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { tmpdir } from 'os';
import { join, sep } from 'path';

const cwd = process.cwd().split(sep).join('/');
const dir = mkdtempSync(join(tmpdir(), 'aiimport-'));
const entry = join(dir, 'entry.mjs');
writeFileSync(entry, 'export * from ' + JSON.stringify(cwd + '/src/core/import/aiImport.ts') + ';\n');
await build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: join(dir, 'out.mjs'), platform: 'node' });
const mod = await import(pathToFileURL(join(dir, 'out.mjs')).href);

const bundle = JSON.parse(readFileSync('yrdy/九州烟云-ai-context/九州烟云-ai-context/novel-context.json', 'utf-8'));
const project = mod.parseContextBundle(JSON.stringify(bundle));
console.log('解析作品:', project.name, '| 人物', project.characters.length, '| 关系', project.relations.length,
  '| 事件', project.events.length, '| 地点', project.locations.length, '| 势力', project.factions.length,
  '| 物品', project.items.length, '| 章节', project.chapters.length, '| 字数', mod.countWords(project));

const again = mod.parseContextBundle(JSON.stringify({ app: 'novel-atlas', version: 1, project }));
console.log('备份格式兼容+幂等:', again.characters.length === project.characters.length && again.chapters.length === project.chapters.length);

const volText = readFileSync('yrdy/正文/卷01-风雪入青云.md', 'utf-8');
const vol = mod.parseVolumeMarkdown('卷01-风雪入青云.md', volText);
console.log('分卷解析:', vol.volumeTitle, '→', vol.chapters.length, '章 | 首章:', vol.chapters[0].title, '| 末章:', vol.chapters[vol.chapters.length - 1].title);

const same = mod.applyVolumes(project, [vol]);
console.log('对位合并(同内容): updated', same.updated, '/ added', same.added, '/ untouched', same.untouched);

const empty = mod.parseContextBundle(JSON.stringify({ project: { ...bundle.project, chapters: [] } }));
const fresh = mod.applyVolumes(empty, [vol]);
console.log('空章节合并: updated', fresh.updated, '/ added', fresh.added, '/ 最终章节数', fresh.project.chapters.length, '/ 字数', mod.countWords(fresh.project));

const c31 = fresh.project.chapters.find((c) => c.order === 31);
console.log('第31章:', c31.title, '| 含青莲认主:', c31.content.includes('青莲剑，破土而出'), '| 卷末标记已剔除:', !c31.content.includes('卷一 · 风雪入青云 · 完'));

// 枚举兜底抽查：自造脏数据
const dirty = mod.parseContextBundle(JSON.stringify({ project: {
  name: '脏数据测试',
  characters: [{ name: '甲', role: '龙套', attributes: { power: 999 } }],
  relations: [{ fromId: 'a', toId: 'b', type: '宿敌' }],
  events: [{ name: '事件一', importance: 9 }],
} }));
console.log('脏数据兜底:', dirty.characters[0].role, dirty.characters[0].attributes.power,
  dirty.relations[0].type, dirty.events[0].importance, 'id补齐:', Boolean(dirty.characters[0].id && dirty.events[0].id));
