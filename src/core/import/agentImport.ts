import type { AgentCard } from '../types';

/**
 * agents/{dir}/SOUL.md → AgentCard 回导 —— 导出（buildWorkspaceFiles 落 agents/NN-名字/SOUL.md）的逆过程。
 *
 * 兼容两种工作区目录命名：
 * - 导出格式 `agents/NN-名字/SOUL.md`（含 `agents/README.md` 索引时还能还原职责 role）；
 * - AI 手撰格式 `agents/<id>/SOUL.md`（目录名无语义，角色名从正文一级标题或「你是一名……」首句推断）。
 *
 * prompt 存 SOUL.md 全文（与导出口径一致，可稳定往返）。全部为纯函数（零 DOM 依赖），便于独立验证；
 * 文件读取（FileList → RawSoulFile[]）由调用方（设置页）负责。
 */

/** 一个 SOUL.md 文件：path 为相对路径（如「agents/01-文风润色编辑/SOUL.md」或「<id>/SOUL.md」）。 */
export interface RawSoulFile {
  path: string;
  text: string;
}

/** 从 SOUL.md 解析出的角色卡雏形（未分配 id / enabled）。 */
export interface AgentSeed {
  name: string;
  role: string;
  prompt: string;
}

const isSoul = (p: string) => /(^|\/)SOUL\.md$/i.test(p);
const isReadme = (p: string) => /(^|\/)README\.md$/i.test(p);

/** 目录段是否形如导出用的「NN-名字」；是则返回剥掉序号前缀后的名字，否则 null。 */
function nameFromFolder(segment: string): string | null {
  const m = segment.match(/^\d+[-_.·\s]+(.+)$/);
  return m && m[1].trim() ? m[1].trim() : null;
}

/**
 * 从 SOUL.md 正文猜角色名：一级标题 > 「你是一名<描述>的<角色>」首句（取末个「的」之后的核心名词）> 回退。
 * 用于目录名无语义（AI 手撰的 id 目录）或纯文件多选导入的场景；导入后仍可在设置页改名。
 */
export function inferNameFromText(text: string, fallback: string): string {
  const heading = text.match(/^\s*#{1,3}\s+(.+?)\s*$/m);
  if (heading) return heading[1].trim();
  const clause = text.match(/你是(?:一[名位个支])?([^，。！!？?（(：:\n]{2,40})/);
  if (clause) {
    let name = clause[1].trim();
    const di = name.lastIndexOf('的');
    if (di >= 0 && name.length - di - 1 >= 2) name = name.slice(di + 1).trim();
    if (name.length > 20) name = name.slice(0, 20);
    if (name) return name;
  }
  return fallback;
}

/** 解析导出侧 agents/README.md 的「| 序 | 角色 | 职责 |」表，得到 name → role 映射。 */
export function parseReadmeRoles(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length >= 2 && cells[0] === '') cells.shift();
    if (cells.length && cells[cells.length - 1] === '') cells.pop();
    if (cells.length !== 3) continue;
    const [ordinal, name, role] = cells;
    if (!/^\d+$/.test(ordinal)) continue; // 跳过表头与分隔行
    if (name && role && role !== '—') map.set(name, role);
  }
  return map;
}

/** 把一批 SOUL.md（+ 可选 README.md）解析为角色卡雏形，按路径顺序稳定输出。 */
export function parseAgentSoulFiles(files: ReadonlyArray<RawSoulFile>): AgentSeed[] {
  const roleMap = new Map<string, string>();
  for (const f of files) if (isReadme(f.path)) for (const [k, v] of parseReadmeRoles(f.text)) roleMap.set(k, v);

  const seeds: AgentSeed[] = [];
  for (const f of files) {
    if (!isSoul(f.path)) continue;
    const text = f.text.replace(/\r\n/g, '\n').trim();
    if (!text) continue;
    const segs = f.path.split('/').filter(Boolean);
    const folder = segs.length >= 2 ? segs[segs.length - 2] : '';
    const name = nameFromFolder(folder) ?? inferNameFromText(text, folder || '未命名智能体');
    seeds.push({ name, role: roleMap.get(name) ?? '', prompt: text });
  }
  return seeds;
}

/**
 * 合并种子进现有角色卡列表：同名同内容跳过、同名异正文更新（保 id / 顺序）、无名则追加（新卡 id 留空，由 store 补）。
 */
export function mergeAgentSeeds(
  existing: AgentCard[],
  seeds: AgentSeed[],
): { next: AgentCard[]; added: number; updated: number; skipped: number } {
  const next = existing.map((a) => ({ ...a }));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const s of seeds) {
    const name = s.name.trim() || '未命名智能体';
    const idx = next.findIndex((a) => a.name === name);
    if (idx >= 0) {
      const cur = next[idx];
      if (cur.prompt === s.prompt && (s.role === '' || cur.role === s.role)) {
        skipped += 1;
        continue;
      }
      next[idx] = { ...cur, role: s.role || cur.role, prompt: s.prompt };
      updated += 1;
    } else {
      next.push({ id: '', name, role: s.role, prompt: s.prompt, enabled: true });
      added += 1;
    }
  }
  return { next, added, updated, skipped };
}
