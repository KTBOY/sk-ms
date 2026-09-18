import type { DocCategory } from '../types';
import type { RawSoulFile } from '../import/agentImport';

/**
 * 工作区文件归类器 —— 把一个写作工作区目录下的全部扁平文件按用途分桶，
 * 供「整个文件夹一键导入」消费。纯函数、零 DOM 依赖：文件读取（目录句柄 / File[] →
 * {path,text}[]）由调用方（导出页）负责，这里只做路径判定与分类。
 */

export interface RawWorkspaceFile {
  path: string;  // 相对工作区根，正斜杠分隔
  text: string;
}

export interface WorkspaceBuckets {
  bundle?: RawWorkspaceFile;              // novel-context.json（结构化全量，主数据源）
  chapterFiles: RawWorkspaceFile[];       // 正文/**/第NNN章-*.md（逐章）
  mergedVolumes: RawWorkspaceFile[];      // 导出合并稿/卷XX-*.md（整卷合并）
  soulFiles: RawSoulFile[];               // agents/**/SOUL.md + agents/README.md
  docs: Array<{ path: string; category: DocCategory; content: string }>; // 其余文本文件
  skipped: string[];                      // 被忽略的二进制 / 缓存路径
}

/** 目录段 → 分类；命中前缀即归类。 */
const DIR_CATEGORY: Array<[RegExp, DocCategory]> = [
  [/^setting\//i, 'setting'],
  [/^ledger\//i, 'ledger'],
  [/^reports\//i, 'reports'],
  [/^promo\//i, 'promo'],
  [/^tools?\//i, 'tool'],
];

/** 按相对路径推导文档分类。agents/ 与正文/、ai-context/ 不进 docs 通道（另有归属）。 */
export function categoryOf(path: string): DocCategory {
  for (const [re, cat] of DIR_CATEGORY) if (re.test(path)) return cat;
  // 根级 md（AGENTS/GOAL/README/书名主稿/日更流水线 等）一律视为 guide
  if (!path.includes('/') && /\.md$/i.test(path)) return 'guide';
  return 'other';
}

/** 文本扩展名白名单：仅这些进 docs / 参与解析；其余（图片、字体等）判为二进制跳过。 */
const TEXT_EXT = /\.(md|markdown|txt|text|json|jsonl|ya?ml|toml|py|js|ts|cjs|mjs|css|csv|ini|log)$/i;

/** 该路径是否为可读取的文本文件（供目录递归读取跳过二进制）。 */
export const isTextPath = (p: string): boolean => TEXT_EXT.test(p);

const isBundle = (p: string) => /(^|\/)novel-context\.json$/i.test(p);
const isSoul = (p: string) => /(^|\/)(SOUL|README)\.md$/i.test(p) && /(^|\/)agents\//i.test(p);
const isMergedVolume = (p: string) => /^导出合并稿\/[^/]+\.md$/i.test(p);
const isChapterFile = (p: string) => /^正文\/.+\.md$/i.test(p) && /第.{1,8}章/.test(p.split('/').pop() || '');

/** 缓存 / 依赖 / 元目录：整体忽略。 */
const isIgnoredDir = (p: string) =>
  /(^|\/)(\.writing|node_modules|\.git|\.cache|dist|build)\//i.test(p) || /^(\.writing|node_modules)\//i.test(p);

/** 把工作区扁平文件列表分为各桶。 */
export function classifyWorkspace(files: ReadonlyArray<RawWorkspaceFile>): WorkspaceBuckets {
  const buckets: WorkspaceBuckets = {
    chapterFiles: [], mergedVolumes: [], soulFiles: [], docs: [], skipped: [],
  };
  for (const f of files) {
    const path = f.path.replace(/\\/g, '/').replace(/^\.\//, '');
    if (isIgnoredDir(path)) { buckets.skipped.push(path); continue; }

    if (isBundle(path)) {
      // 多处 novel-context.json 时，优先取位于 *-ai-context/ 目录内者，其次取路径最深者
      if (!buckets.bundle || /ai-context\//i.test(path)) buckets.bundle = { path, text: f.text };
      continue;
    }
    if (isSoul(path)) { buckets.soulFiles.push({ path, text: f.text }); continue; }
    if (isMergedVolume(path)) { buckets.mergedVolumes.push({ path, text: f.text }); continue; }
    if (isChapterFile(path)) { buckets.chapterFiles.push({ path, text: f.text }); continue; }

    // ai-context/ 下 00-11 号视图与 json 已由 bundle 覆盖，不重复收进 docs
    if (/-ai-context\//i.test(path) || /^ai-context\//i.test(path)) { buckets.skipped.push(path); continue; }

    if (TEXT_EXT.test(path)) {
      buckets.docs.push({ path, category: categoryOf(path), content: f.text });
    } else {
      buckets.skipped.push(path);
    }
  }
  return buckets;
}

/** 各分类的中文显示名（文档页分组、导入汇总共用）。 */
export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  setting: '设定',
  ledger: '台账',
  reports: '巡检报告',
  promo: '宣发文案',
  guide: '工作区规则',
  tool: '脚本工具',
  other: '其它文件',
};

/** 分组展示顺序。 */
export const DOC_CATEGORY_ORDER: DocCategory[] = [
  'guide', 'setting', 'ledger', 'reports', 'promo', 'tool', 'other',
];
