import type {
  Chapter, ChapterStatus, ChapterVersion, Character, CharacterRole, CharacterStatus,
  Faction, FactionType, Item, LocationNode, Project, Relation, RelationType, StoryEvent,
} from '../types';
import { newId } from '../id';

/**
 * AI 上下文包回导 —— 导出（buildAiContextFiles）的逆过程。
 *
 * 数据源与优先级：
 * 1. `novel-context.json`（结构化全量，主要来源；兼容本应用 JSON 备份格式）
 * 2. 正文分卷 Markdown（可选合并源）：`卷01-xxx.md` 中 `## 第X章 标题` 分节，
 *    按选择顺序展开为章节序号，与既有章节按 order 对位合并。
 *
 * `00-09` 号 Markdown 是导出视图（可由 JSON 完整再生），不作为导入源；
 * `10-outline.md` / `11-writing-log.md` 属于 AI 工作区文件，不属于应用数据模型。
 *
 * 本模块全部为纯函数（零 DOM 依赖），便于独立验证。
 */

const ROLES: readonly CharacterRole[] = ['主角', '配角', '反派', '路人'];
const CHAR_STATUS: readonly CharacterStatus[] = ['在世', '死亡', '未知'];
const REL_TYPES: readonly RelationType[] = ['亲人', '师徒', '挚友', '恋人', '敌对', '同门', '上下级', '其他'];
const FAC_TYPES: readonly FactionType[] = ['宗门', '王朝', '组织', '家族', '其他'];
const CH_STATUS: readonly ChapterStatus[] = ['草稿', '写作中', '已完成'];

function pickEnum<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : fallback;
}

function clamp01_100(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 50;
  return Math.max(0, Math.min(100, n));
}

const asRec = (v: unknown): Record<string, unknown> => v as Record<string, unknown>;

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

/** 兼容三种外层包装：{project}（AI 上下文包）、{app, project}（备份）、裸 Project。 */
function extractProject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) throw new Error('文件内容不是有效的 JSON 对象');
  const obj = raw as Record<string, unknown>;
  const candidate = (obj.project ?? obj) as Record<string, unknown>;
  if (typeof candidate !== 'object' || candidate === null) throw new Error('文件里找不到作品数据');
  if (!Array.isArray(candidate.characters)) {
    throw new Error('文件格式不正确：缺少 characters 字段，不是墨枢导出的上下文包或备份');
  }
  return candidate;
}

function normalizeChapter(c: Record<string, unknown>, index: number): Chapter {
  const content = typeof c.content === 'string' ? c.content : '';
  return {
    id: typeof c.id === 'string' && c.id ? c.id : newId(),
    title: typeof c.title === 'string' && c.title.trim() ? c.title : `第 ${index + 1} 章`,
    content,
    synopsis: typeof c.synopsis === 'string' ? c.synopsis : '',
    status: pickEnum(CH_STATUS, c.status, '草稿'),
    order: typeof c.order === 'number' && Number.isFinite(c.order) ? c.order : index + 1,
    updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
    versions: Array.isArray(c.versions) ? (c.versions as ChapterVersion[]) : [],
  };
}

/** 归一化：补齐缺省字段、回填缺失 ID、收敛枚举取值。导入失败大多源于版本漂移，这里统一兜底。 */
export function normalizeProject(input: Record<string, unknown>): Project {
  const now = Date.now();
  const base = input as unknown as Partial<Project> & Record<string, unknown>;

  const characters: Character[] = (Array.isArray(base.characters) ? base.characters : []).map((raw, i) => {
    const c = asRec(raw);
    const a = (c.attributes ?? {}) as Record<string, unknown>;
    return {
      id: typeof c.id === 'string' && c.id ? c.id : newId(),
      name: typeof c.name === 'string' && c.name ? c.name : `未命名人物${i + 1}`,
      aliases: strArr(c.aliases),
      description: typeof c.description === 'string' ? c.description : '',
      tags: strArr(c.tags),
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : now,
      updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : now,
      role: pickEnum(ROLES, c.role, '配角'),
      gender: typeof c.gender === 'string' ? c.gender : '',
      age: typeof c.age === 'string' ? c.age : '',
      factionId: strOrNull(c.factionId),
      appearance: typeof c.appearance === 'string' ? c.appearance : '',
      personality: typeof c.personality === 'string' ? c.personality : '',
      background: typeof c.background === 'string' ? c.background : '',
      goals: typeof c.goals === 'string' ? c.goals : '',
      status: pickEnum(CHAR_STATUS, c.status, '未知'),
      avatar: strOrNull(c.avatar),
      attributes: {
        power: clamp01_100(a.power),
        wisdom: clamp01_100(a.wisdom),
        charm: clamp01_100(a.charm),
        will: clamp01_100(a.will),
        fortune: clamp01_100(a.fortune),
      },
    };
  });

  const relations: Relation[] = (Array.isArray(base.relations) ? base.relations : []).map((raw) => {
    const r = asRec(raw);
    return {
      id: typeof r.id === 'string' && r.id ? r.id : newId(),
      fromId: typeof r.fromId === 'string' ? r.fromId : '',
      toId: typeof r.toId === 'string' ? r.toId : '',
      type: pickEnum(REL_TYPES, r.type, '其他'),
      strength: Math.max(1, Math.min(5, typeof r.strength === 'number' ? Math.round(r.strength) : 3)),
      note: typeof r.note === 'string' ? r.note : '',
    };
  }).filter((r) => r.fromId && r.toId);

  const events: StoryEvent[] = (Array.isArray(base.events) ? base.events : []).map((raw) => {
    const e = asRec(raw);
    return {
      id: typeof e.id === 'string' && e.id ? e.id : newId(),
      name: typeof e.name === 'string' && e.name ? e.name : '未命名事件',
      aliases: strArr(e.aliases),
      description: typeof e.description === 'string' ? e.description : '',
      tags: strArr(e.tags),
      createdAt: typeof e.createdAt === 'number' ? e.createdAt : now,
      updatedAt: typeof e.updatedAt === 'number' ? e.updatedAt : now,
      timeLabel: typeof e.timeLabel === 'string' ? e.timeLabel : '',
      sortIndex: typeof e.sortIndex === 'number' && Number.isFinite(e.sortIndex) ? e.sortIndex : 0,
      locationId: strOrNull(e.locationId),
      participantIds: strArr(e.participantIds),
      causeIds: strArr(e.causeIds),
      effectIds: strArr(e.effectIds),
      importance: Math.max(1, Math.min(5, typeof e.importance === 'number' ? Math.round(e.importance) : 3)),
      chapterId: strOrNull(e.chapterId),
    };
  }).sort((a, b) => a.sortIndex - b.sortIndex)
    .map((e, i) => ({ ...e, sortIndex: e.sortIndex || i + 1 }));

  const items: Item[] = (Array.isArray(base.items) ? base.items : []).map((raw) => {
    const it = asRec(raw);
    return {
      id: typeof it.id === 'string' && it.id ? it.id : newId(),
      name: typeof it.name === 'string' && it.name ? it.name : '未命名物品',
      aliases: strArr(it.aliases),
      description: typeof it.description === 'string' ? it.description : '',
      tags: strArr(it.tags),
      createdAt: typeof it.createdAt === 'number' ? it.createdAt : now,
      updatedAt: typeof it.updatedAt === 'number' ? it.updatedAt : now,
      type: typeof it.type === 'string' ? it.type : '其他',
      rarity: typeof it.rarity === 'string' ? it.rarity : '普通',
      ownerId: strOrNull(it.ownerId),
      locationId: strOrNull(it.locationId),
      origin: typeof it.origin === 'string' ? it.origin : '',
      status: typeof it.status === 'string' ? it.status : '',
    };
  });

  const locations: LocationNode[] = (Array.isArray(base.locations) ? base.locations : []).map((raw) => {
    const l = asRec(raw);
    return {
      id: typeof l.id === 'string' && l.id ? l.id : newId(),
      name: typeof l.name === 'string' && l.name ? l.name : '未命名地点',
      aliases: strArr(l.aliases),
      description: typeof l.description === 'string' ? l.description : '',
      tags: strArr(l.tags),
      createdAt: typeof l.createdAt === 'number' ? l.createdAt : now,
      updatedAt: typeof l.updatedAt === 'number' ? l.updatedAt : now,
      region: typeof l.region === 'string' ? l.region : '',
      parentId: strOrNull(l.parentId),
    };
  });

  const factions: Faction[] = (Array.isArray(base.factions) ? base.factions : []).map((raw) => {
    const f = asRec(raw);
    return {
      id: typeof f.id === 'string' && f.id ? f.id : newId(),
      name: typeof f.name === 'string' && f.name ? f.name : '未命名势力',
      aliases: strArr(f.aliases),
      description: typeof f.description === 'string' ? f.description : '',
      tags: strArr(f.tags),
      createdAt: typeof f.createdAt === 'number' ? f.createdAt : now,
      updatedAt: typeof f.updatedAt === 'number' ? f.updatedAt : now,
      type: pickEnum(FAC_TYPES, f.type, '其他'),
      leaderId: strOrNull(f.leaderId),
      stance: typeof f.stance === 'string' ? f.stance : '',
    };
  });

  const chapters: Chapter[] = (Array.isArray(base.chapters) ? base.chapters : [])
    .map((raw, i) => normalizeChapter(asRec(raw), i))
    .sort((a, b) => a.order - b.order)
    .map((c, i) => ({ ...c, order: i + 1 }));

  const settings = (base.settings ?? {}) as { ai?: { baseUrl?: unknown; apiKey?: unknown; model?: unknown } };
  const ai = settings.ai ?? {};

  return {
    id: typeof base.id === 'string' && base.id ? base.id : newId(),
    name: typeof base.name === 'string' && base.name ? base.name : '导入的作品',
    genre: typeof base.genre === 'string' ? base.genre : '',
    description: typeof base.description === 'string' ? base.description : '',
    createdAt: typeof base.createdAt === 'number' ? base.createdAt : now,
    updatedAt: now,
    characters,
    relations,
    events,
    items,
    locations,
    factions,
    chapters,
    ignoreWords: strArr(base.ignoreWords),
    // 导出包不含密钥（导出时已剔除），这里同样不接受外部注入的密钥
    settings: { ai: { baseUrl: typeof ai.baseUrl === 'string' ? ai.baseUrl : '', apiKey: '', model: typeof ai.model === 'string' ? ai.model : '' } },
  };
}

/** 解析 novel-context.json / JSON 备份文本为归一化作品。 */
export function parseContextBundle(text: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('JSON 解析失败：文件不是合法的 JSON');
  }
  return normalizeProject(extractProject(raw));
}

/* ---------------- 正文分卷 Markdown 合并 ---------------- */

export interface VolumeChapter {
  label: string;   // 「第一章」
  title: string;   // 「山门雪」
  content: string;
}

export interface ParsedVolume {
  fileName: string;
  volumeTitle: string;
  chapters: VolumeChapter[];
}

const VOLUME_HEAD = /^#\s+(.+)$/;

/** 解析单个分卷文件：`## 第X章 标题` 分节；卷标题取一级标题；自动剔除卷末「（卷…完）」行。 */
export function parseVolumeMarkdown(fileName: string, text: string): ParsedVolume {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const result: VolumeChapter[] = [];
  let volumeTitle = fileName.replace(/\.md$/i, '');
  let current: { label: string; title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const h1 = line.match(VOLUME_HEAD);
    if (h1) {
      volumeTitle = h1[1].trim();
      continue;
    }
    const h2 = line.match(/^##\s*(.+)$/);
    if (h2) {
      const head = h2[1].trim();
      const m = head.match(/^(第[^\s]{1,8}章)\s*(.*)$/);
      if (m) {
        if (current) result.push(finishChapter(current));
        current = { label: m[1], title: m[2].trim(), lines: [] };
        continue;
      }
    }
    if (current) current.lines.push(line);
  }
  if (current) result.push(finishChapter(current));

  if (result.length === 0) throw new Error(`「${fileName}」里没有找到「## 第X章 标题」格式的章节，请确认选择的是正文分卷文件`);
  return { fileName, volumeTitle, chapters: result };
}

function finishChapter(cur: { label: string; title: string; lines: string[] }): VolumeChapter {
  const content = cur.lines
    .join('\n')
    .replace(/（卷[^）]*·?\s*(完|待续|未完)[^）]*）/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { label: cur.label, title: cur.title || cur.label, content };
}

export interface VolumeMergeResult {
  project: Project;
  added: number;   // 新增章节数
  updated: number; // 更新章节数
  untouched: number;
}

const AUTO_SYNOPSIS_LEN = 60;

/** 统一换行为 LF 后再比较/落库，避免 CRLF 差异把「同内容」误判成「更新」。 */
const normText = (s: string) => s.replace(/\r\n/g, '\n');

/** 把分卷章节按 order 对位合并进作品：同序号覆盖正文（旧正文留 replace 快照），缺位追加。 */
export function applyVolumes(project: Project, volumes: ParsedVolume[]): VolumeMergeResult {
  const draft: Project = structuredClone(project);
  draft.chapters.sort((a, b) => a.order - b.order);
  const byOrder = new Map(draft.chapters.map((c) => [c.order, c]));
  let order = 0;
  let added = 0;
  let updated = 0;
  let untouched = 0;

  for (const vol of volumes) {
    for (const ch of vol.chapters) {
      order += 1;
      const incomingTitle = `${ch.label} ${ch.title}`.trim();
      const incomingContent = normText(ch.content);
      const existing = byOrder.get(order);
      if (existing) {
        if (normText(existing.content) !== incomingContent || existing.title !== incomingTitle) {
          if (existing.content) {
            const snap: ChapterVersion = {
              id: newId(),
              at: Date.now(),
              title: existing.title,
              content: existing.content,
              wordCount: existing.content.replace(/\s/g, '').length,
              label: 'replace',
            };
            existing.versions = [...(existing.versions ?? []), snap].slice(-20);
          }
          existing.title = incomingTitle;
          existing.content = incomingContent;
          existing.updatedAt = Date.now();
          updated += 1;
        } else {
          untouched += 1;
        }
        if (!existing.synopsis) existing.synopsis = autoSynopsis(ch.content);
      } else {
        const chapter: Chapter = {
          id: newId(),
          title: incomingTitle,
          content: incomingContent,
          synopsis: autoSynopsis(ch.content),
          status: '已完成',
          order,
          updatedAt: Date.now(),
          versions: [],
        };
        draft.chapters.push(chapter);
        byOrder.set(order, chapter);
        added += 1;
      }
    }
  }

  draft.chapters.sort((a, b) => a.order - b.order).forEach((c, i) => { c.order = i + 1; });
  draft.updatedAt = Date.now();
  return { project: draft, added, updated, untouched };
}

function autoSynopsis(content: string): string {
  const clean = content.replace(/\s/g, '');
  return clean.length > AUTO_SYNOPSIS_LEN ? clean.slice(0, AUTO_SYNOPSIS_LEN) + '……' : clean;
}

/* ---------------- 汇总信息（导入确认弹窗用） ---------------- */

export function countWords(project: Project): number {
  return project.chapters.reduce((acc, c) => acc + c.content.replace(/\s/g, '').length, 0);
}
