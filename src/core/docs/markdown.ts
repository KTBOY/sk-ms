/**
 * 零依赖 Markdown 分块解析器 —— 把任意工作区文档（md/txt）拆成有序 block 树，
 * 供「文档」页的语义化视图与只读渲染共用。
 *
 * 设计取向：这些文档都是同一骨架（`# 标题` + `> 用途/事实源` 引用块 + `## 中文序号` 段 +
 * GFM 管道表格 / 列表 / 段落）。这里只做「够用且确定」的行级解析，不追求完整 CommonMark：
 * 不处理行内加粗/链接/代码等富文本（交给 CSS 或后续），只识别结构块。
 * 表格单元格按 aiExport 的转义口径还原：导出时 `|`→`｜`、换行→空格，这里反向 `｜`→`|`。
 */

export type MdBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'quote'; lines: string[] }
  | { type: 'table'; header: string[]; align: Array<'left' | 'center' | 'right' | undefined>; rows: string[][] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; lang: string; lines: string[] }
  | { type: 'para'; text: string }
  | { type: 'rule' };

const isTableDivider = (line: string): boolean =>
  /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(line);

/** 拆分管道表格的一行为单元格数组（去掉首尾空管）。 */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim().replace(/｜/g, '|'));
}

function parseAlign(cell: string): 'left' | 'center' | 'right' | undefined {
  const c = cell.trim();
  if (c.startsWith(':') && c.endsWith(':')) return 'center';
  if (c.endsWith(':')) return 'right';
  if (c.startsWith(':')) return 'left';
  return undefined;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;
const RULE = /^\s*([-*_])\s*(\1\s*){2,}$/;

/** 解析 Markdown 文本为有序 block 列表（纯函数，CRLF 归一为 LF）。 */
export function parseMarkdown(text: string): MdBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;

  const flushPara = (buf: string[]) => {
    if (buf.length) blocks.push({ type: 'para', text: buf.join('\n').trim() });
  };

  let para: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // 代码围栏（tools/*.py 之类以原文为主，md 内的 ``` 块按原样收集）
    const fence = line.match(/^```\s*([\w-]*)\s*$/);
    if (fence) {
      flushPara(para); para = [];
      const lang = fence[1] || '';
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { body.push(lines[i]); i += 1; }
      i += 1; // 跳过结尾 ```
      blocks.push({ type: 'code', lang, lines: body });
      continue;
    }

    if (!line.trim()) {
      flushPara(para); para = [];
      i += 1;
      continue;
    }

    const h = line.match(HEADING);
    if (h) {
      flushPara(para); para = [];
      blocks.push({ type: 'heading', level: h[1].length, text: h[2].trim() });
      i += 1;
      continue;
    }

    if (RULE.test(line) && !line.includes('|')) {
      flushPara(para); para = [];
      blocks.push({ type: 'rule' });
      i += 1;
      continue;
    }

    // 引用块：连续以 > 开头的行
    if (/^\s*>/.test(line)) {
      flushPara(para); para = [];
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', lines: quote });
      continue;
    }

    // 表格：当前行含 |，且下一行是分隔行
    if (line.includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      flushPara(para); para = [];
      const header = splitRow(line);
      const align = splitRow(lines[i + 1]).map(parseAlign);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        const cells = splitRow(lines[i]);
        // 补齐/裁剪到表头列数，容忍尾随空管
        while (cells.length < header.length) cells.push('');
        rows.push(cells.slice(0, header.length));
        i += 1;
      }
      blocks.push({ type: 'table', header, align, rows });
      continue;
    }

    // 列表：连续的无序 / 有序项（二者不混排为同一 list）
    const ul = line.match(UL);
    const ol = line.match(OL);
    if (ul || ol) {
      flushPara(para); para = [];
      const ordered = !!ol;
      const items: string[] = [];
      while (i < lines.length) {
        const m = ordered ? lines[i].match(OL) : lines[i].match(UL);
        if (!m) break;
        items.push(m[1].trim());
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    para.push(line.trim());
    i += 1;
  }
  flushPara(para);
  return blocks;
}

/** 取一级标题作为文档标题；无则回退文件名主干。 */
export function docTitle(text: string, fallback: string): string {
  const m = text.replace(/\r\n/g, '\n').match(/^#\s+(.+)$/m);
  if (m) return m[1].replace(/^《|》$/g, '').trim() || fallback;
  return fallback;
}

/** 收集全部表格行（跨 block），供语义适配器扫表用。 */
export function allTables(blocks: MdBlock[]): Array<{ header: string[]; rows: string[][] }> {
  return blocks.filter((b): b is Extract<MdBlock, { type: 'table' }> => b.type === 'table')
    .map((b) => ({ header: b.header, rows: b.rows }));
}
