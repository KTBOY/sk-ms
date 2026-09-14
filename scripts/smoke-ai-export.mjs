import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { tmpdir } from 'os';
import { join, sep } from 'path';

const cwd = process.cwd().split(sep).join('/');
const dir = mkdtempSync(join(tmpdir(), 'aiexport-'));
const entry = join(dir, 'entry.mjs');
writeFileSync(entry, [
  'export * from ' + JSON.stringify(cwd + '/src/core/export/aiExport.ts') + ';',
  'export * from ' + JSON.stringify(cwd + '/src/core/import/aiImport.ts') + ';',
  'export * from ' + JSON.stringify(cwd + '/src/core/id.ts') + ';',
].join('\n'));
await build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: join(dir, 'out.mjs'), platform: 'node' });
const m = await import(pathToFileURL(join(dir, 'out.mjs')).href);

/** 构造测试作品：60 章（标题带全局中文章号），卷一 1-33 / 卷二 34-66，另有 1 章未划卷、1 章无「第X章」前缀。 */
function makeProject() {
  const cn = (n) => {
    const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    if (n < 10) return d[n];
    const t = Math.floor(n / 10), o = n % 10;
    return (t > 1 ? d[t] : '') + '十' + (o ? d[o] : '');
  };
  const chapters = [];
  for (let i = 1; i <= 60; i++) {
    chapters.push({
      id: `ch${i}`, title: `第${cn(i)}章 章节${i}`, content: `第${i}章正文。\n\n山门雪落，问剑峰的灯亮到三更。`,
      synopsis: `第${i}章简介`, status: '已完成', order: i, updatedAt: 1, versions: [],
    });
  }
  chapters.push({ id: 'chX', title: '番外·落霞旧事', content: '番外正文。', synopsis: '', status: '草稿', order: 61, updatedAt: 1, versions: [] });
  return {
    id: 'p1', name: '九州烟云', genre: '东方玄幻', description: '守令与千年棋局',
    createdAt: 1, updatedAt: 1,
    characters: [], relations: [], events: [], items: [], locations: [], factions: [],
    chapters,
    volumes: [
      { id: 'v1', name: '风雪入青云', startOrder: 1, endOrder: 33 },
      { id: 'v2', name: '藏锋录', startOrder: 34, endOrder: 59 },
    ],
    ignoreWords: [],
    settings: { ai: { baseUrl: '', apiKey: 'SECRET', model: 'x' } },
  };
}

const project = m.normalizeProject(makeProject());
const agents = [
  { id: 'a1', name: '文风润色编辑', role: '风格纪律与语言精修', prompt: '你是文风润色编辑。\n\n【工作流程】\n1. 合规检查。', enabled: true },
  { id: 'a2', name: '逻辑审计员', role: '设定与因果一致性审计', prompt: '# 逻辑审计员\n\n负责设定与因果一致性审计。', enabled: true },
  { id: 'a3', name: '宣发文案策划', role: '宣发物料', prompt: '已停用的角色卡不应导出。', enabled: false },
];
const files = m.buildWorkspaceFiles(project, agents);
const paths = files.map((f) => f.path);

let failed = 0;
const check = (label, ok) => {
  console.log(ok ? '✅' : '❌', label);
  if (!ok) failed += 1;
};

check('ai-context 子目录齐全（11 个文件）', paths.filter((p) => p.startsWith('九州烟云-ai-context/')).length === 11);
check('卷一 卷首.md', paths.includes('正文/卷01-风雪入青云/卷首.md'));
check('卷二 卷首.md', paths.includes('正文/卷02-藏锋录/卷首.md'));
check('第001章-章节1.md 落卷一', paths.includes('正文/卷01-风雪入青云/第001章-章节1.md'));
check('第034章 落卷二', paths.includes('正文/卷02-藏锋录/第034章-章节34.md'));
check('第061章 未划卷 → 正文/未分卷/', paths.includes('正文/未分卷/第061章-番外·落霞旧事.md'));
check('敏感字段已剔除（apiKey）', !files.find((f) => f.path.endsWith('novel-context.json')).content.includes('SECRET'));

const juanShou = files.find((f) => f.path === '正文/卷01-风雪入青云/卷首.md').content;
check('卷首.md 内容「# 卷一 · 风雪入青云」', juanShou === '# 卷一 · 风雪入青云\n');

const ch34 = files.find((f) => f.path === '正文/卷02-藏锋录/第034章-章节34.md');
check('章文件首行「## 第三十四章 章节34」', ch34.content.startsWith('## 第三十四章 章节34\n\n'));

// 标题无「第X章」前缀的章：标题应自动补全局章号前缀，保证回导可解析
const fanwai = files.find((f) => f.path === '正文/未分卷/第061章-番外·落霞旧事.md');
check('无前缀章标题自动补「第X章」', fanwai.content.startsWith('## 第六十一章 番外·落霞旧事'));

// 智能体角色卡导出
const soul1 = files.find((f) => f.path === 'agents/01-文风润色编辑/SOUL.md');
check('agents/01 SOUL.md 落盘且自动补角色名标题',
  Boolean(soul1) && soul1.content.startsWith('# 文风润色编辑'));
const soul2 = files.find((f) => f.path === 'agents/02-逻辑审计员/SOUL.md');
check('agents/02 SOUL.md 保留既有 H1（不重复加标题）',
  Boolean(soul2) && soul2.content.startsWith('# 逻辑审计员') && !soul2.content.startsWith('# # 逻辑审计员'));
const agentsReadme = files.find((f) => f.path === 'agents/README.md');
check('agents/README.md 索引含启用角色、不含停用角色',
  Boolean(agentsReadme) && agentsReadme.content.includes('文风润色编辑') && !agentsReadme.content.includes('宣发文案策划'));
check('停用角色卡不导出', !paths.some((p) => p.includes('宣发文案策划')));

/* ---------------- 回导幂等：导出树 → 分卷解析 → 对位合并 ---------------- */

function readVolumeFromTree(prefix) {
  const parts = [];
  const head = files.find((f) => f.path === `${prefix}/卷首.md`);
  if (head) parts.push(head.content);
  for (const f of files) {
    if (f.path.startsWith(`${prefix}/第`) && f.path.endsWith('.md')) parts.push(f.content);
  }
  return parts.join('');
}

const vols = [
  m.parseVolumeMarkdown('卷01-风雪入青云.md', readVolumeFromTree('正文/卷01-风雪入青云')),
  m.parseVolumeMarkdown('卷02-藏锋录.md', readVolumeFromTree('正文/卷02-藏锋录')),
];
check('回导解析卷章数（33 + 26）', vols[0].chapters.length === 33 && vols[1].chapters.length === 26);

const merged = m.applyVolumes(project, vols);
check('回导对位：一致 59 章 / 新增 0 / 更新 0', merged.untouched === 59 && merged.added === 0 && merged.updated === 0);

// 无分卷作品回导后自动建卷
const bare = { ...project, volumes: [] };
const auto = m.applyVolumes(bare, vols);
check('自动建卷（2 卷，区间正确）',
  auto.project.volumes?.length === 2
  && auto.project.volumes[0].name === '风雪入青云' && auto.project.volumes[0].startOrder === 1 && auto.project.volumes[0].endOrder === 33
  && auto.project.volumes[1].name === '藏锋录' && auto.project.volumes[1].startOrder === 34 && auto.project.volumes[1].endOrder === 59);

// 08-chapters.md 含卷列
const idx = files.find((f) => f.path === '九州烟云-ai-context/08-chapters.md').content;
check('章节索引含「卷」列与卷二归属', idx.includes('| 序 | 卷 | 标题 |') && idx.includes('卷二'));

// 目录树打印（前 20 条）
console.log('\n—— 导出文件树（节选）——');
for (const p of paths.slice(0, 8)) console.log('  ', p);
console.log('   …… 共', paths.length, '个文件');

process.exit(failed ? 1 : 0);
