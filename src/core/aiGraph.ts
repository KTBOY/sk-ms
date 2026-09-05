import type {
  Chapter, Character, CharacterRole, Faction, FactionType, Item, LocationNode,
  Project, Relation, StoryEvent,
} from './types';
import { RELATION_TYPES } from './types';
import { newId } from './id';

/**
 * AI 建谱：粘贴既有正文/大纲 → AI 抽取实体 → 人工确认 → 一批入库。
 * 解决图谱冷启动：手动录几十个实体不现实，让存量作品也能一键进图谱。
 */

export interface ExtractedCharacter {
  name: string; aliases?: string[]; role?: string; gender?: string; age?: string;
  faction?: string; appearance?: string; personality?: string; background?: string; goals?: string;
}
export interface ExtractedRelation { from: string; to: string; type?: string; strength?: number; note?: string }
export interface ExtractedEvent {
  name: string; timeLabel?: string; description?: string; location?: string;
  participants?: string[]; causes?: string[]; effects?: string[]; importance?: number;
}
export interface ExtractedItem {
  name: string; type?: string; rarity?: string; owner?: string; location?: string; description?: string;
}
export interface ExtractedLocation { name: string; region?: string; parent?: string; description?: string }
export interface ExtractedFaction { name: string; aliases?: string[]; type?: string; stance?: string; leader?: string; description?: string }

export interface ExtractionResult {
  characters: ExtractedCharacter[];
  relations: ExtractedRelation[];
  events: ExtractedEvent[];
  items: ExtractedItem[];
  locations: ExtractedLocation[];
  factions: ExtractedFaction[];
}

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const names = (v: unknown): string[] => asArray<unknown>(v).map(str).filter(Boolean);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** 构造抽取提示词：附上现有实体名让 AI 尽量复用，避免同实体两条记录。 */
export function buildExtractionPrompt(project: Project, text: string): string {
  const cap = (arr: string[]) => (arr.length ? arr.slice(0, 80).join('、') : '（无）');
  const existing = [
    `【已有人物】${cap(project.characters.map((c) => [c.name, ...c.aliases]).flat())}`,
    `【已有地点】${cap(project.locations.map((l) => l.name))}`,
    `【已有势力】${cap(project.factions.map((f) => f.name))}`,
    `【已有物品】${cap(project.items.map((i) => i.name))}`,
    `【已有事件】${cap(project.events.map((e) => e.name))}`,
  ].join('\n');

  return `你是小说设定图谱构建助手。从下面的正文中抽取设定实体，输出严格 JSON。

${existing}

【抽取规则】
1. 只抽正文明确出现的内容，不虚构补充；描述尽量引用原文语义，每条不超过 60 字。
2. 与【已有】名单同名的实体，直接复用其名字（不要换写法、不要拆分），没有新信息时其 description 留空字符串。
3. 人物的 role 只能是：主角/配角/反派/路人。势力的 type 只能是：宗门/王朝/组织/家族/其他。
4. 关系 type 只能是：${RELATION_TYPES.join('/')}，strength 为 1-5 整数。
5. 事件 importance 为 1-5 整数；causes/effects 填事件名。
6. 只输出 JSON，不要 markdown 代码块、不要解释。结构：
{"characters":[{"name":"","aliases":[],"role":"配角","gender":"","age":"","faction":"","appearance":"","personality":"","background":"","goals":""}],
"relations":[{"from":"人物名","to":"人物名","type":"挚友","strength":3,"note":""}],
"events":[{"name":"","timeLabel":"如 第三年·春","description":"","location":"","participants":["人物名"],"causes":["事件名"],"effects":["事件名"],"importance":3}],
"items":[{"name":"","type":"","rarity":"","owner":"人物名","location":"地点名","description":""}],
"locations":[{"name":"","region":"","parent":"上级地点名","description":""}],
"factions":[{"name":"","type":"宗门","stance":"正道","leader":"人物名","description":""}]}

【正文】
${text.slice(0, 12000)}`;
}

/** 解析 AI 返回：容忍 ```json 围栏与前后杂文，取首尾大括号之间的内容。 */
export function parseExtraction(raw: string): ExtractionResult {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI 返回中没有找到 JSON，请重试或更换模型');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error('AI 返回的 JSON 无法解析，请重试或更换模型');
  }
  const result: ExtractionResult = {
    characters: asArray<ExtractedCharacter>(data.characters).filter((c) => str(c.name)),
    relations: asArray<ExtractedRelation>(data.relations).filter((r) => str(r.from) && str(r.to)),
    events: asArray<ExtractedEvent>(data.events).filter((e) => str(e.name)),
    items: asArray<ExtractedItem>(data.items).filter((i) => str(i.name)),
    locations: asArray<ExtractedLocation>(data.locations).filter((l) => str(l.name)),
    factions: asArray<ExtractedFaction>(data.factions).filter((f) => str(f.name)),
  };
  if (
    result.characters.length + result.relations.length + result.events.length +
    result.items.length + result.locations.length + result.factions.length === 0
  ) {
    throw new Error('AI 没有抽取到任何实体，试试换一段设定更密集的正文');
  }
  return result;
}

const normalizeRole = (v: unknown): CharacterRole => {
  const s = str(v);
  if (s === '主角' || s === '反派' || s === '路人') return s;
  if (s.includes('主') || s.includes('protagonist')) return '主角';
  if (s.includes('反') || s.includes('villain')) return '反派';
  return '配角';
};

const normalizeFactionType = (v: unknown): FactionType => {
  const s = str(v);
  if (s === '王朝' || s === '组织' || s === '家族') return s;
  if (s === '宗门' || s.includes('门') || s.includes('派') || s.includes('sect')) return '宗门';
  return '其他';
};

const normalizeRelType = (v: unknown): Relation['type'] => {
  const s = str(v);
  return (RELATION_TYPES as readonly string[]).includes(s) ? (s as Relation['type']) : '其他';
};

/** 名称 → 已有实体 id（含别名）。 */
function nameIndex<T extends { id: string; name: string; aliases: string[] }>(list: T[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of list) {
    map.set(e.name, e.id);
    for (const a of e.aliases) if (!map.has(a)) map.set(a, e.id);
  }
  return map;
}

export interface ImportBatch {
  characters: Character[]; relations: Relation[]; events: StoryEvent[];
  items: Item[]; locations: LocationNode[]; factions: Faction[];
}

export interface ImportPlan {
  batch: ImportBatch;
  /** 每类实际新增数（跳过已存在的同名实体后）。 */
  counts: { characters: number; relations: number; events: number; items: number; locations: number; factions: number };
  /** 与图谱重名而跳过的实体名。 */
  skipped: string[];
}

/**
 * 把抽取结果规划为入库批次：名字解析为 id（复用已有或批内新建），
 * 同名/同别名实体跳过不重复建。
 */
export function buildImportPlan(project: Project, result: ExtractionResult): ImportPlan {
  const now = Date.now();
  const charIdx = nameIndex(project.characters);
  const locIdx = nameIndex(project.locations);
  const facIdx = nameIndex(project.factions);
  const itemIdx = nameIndex(project.items);
  const eventIdx = nameIndex(project.events);

  const batch: ImportBatch = { characters: [], relations: [], events: [], items: [], locations: [], factions: [] };
  const skipped: string[] = [];

  const ensureChar = (name: string, patch?: Partial<Character>): string | null => {
    if (!name) return null;
    const known = charIdx.get(name);
    if (known) return known;
    const c: Character = {
      id: newId(), name, aliases: [], description: '', tags: [],
      role: '配角', gender: '', age: '', factionId: null, status: '在世',
      appearance: '', personality: '', background: '', goals: '', avatar: null,
      attributes: { power: 50, wisdom: 50, charm: 50, will: 50, fortune: 50 },
      createdAt: now, updatedAt: now, ...patch,
    };
    batch.characters.push(c);
    charIdx.set(name, c.id);
    return c.id;
  };
  const ensureFaction = (name: string, patch?: Partial<Faction>): string | null => {
    if (!name) return null;
    const known = facIdx.get(name);
    if (known) return known;
    const f: Faction = {
      id: newId(), name, aliases: [], description: '', tags: [],
      type: '其他', stance: '中立', leaderId: null,
      createdAt: now, updatedAt: now, ...patch,
    };
    batch.factions.push(f);
    facIdx.set(name, f.id);
    return f.id;
  };
  const ensureLocation = (name: string, patch?: Partial<LocationNode>): string | null => {
    if (!name) return null;
    const known = locIdx.get(name);
    if (known) return known;
    const l: LocationNode = {
      id: newId(), name, aliases: [], description: '', tags: [],
      region: '', parentId: null,
      createdAt: now, updatedAt: now, ...patch,
    };
    batch.locations.push(l);
    locIdx.set(name, l.id);
    return l.id;
  };
  const ensureItem = (name: string, patch?: Partial<Item>): string | null => {
    if (!name) return null;
    const known = itemIdx.get(name);
    if (known) return known;
    const i: Item = {
      id: newId(), name, aliases: [], description: '', tags: [],
      type: '', rarity: '', ownerId: null, locationId: null, origin: '', status: '',
      createdAt: now, updatedAt: now, ...patch,
    };
    batch.items.push(i);
    itemIdx.set(name, i.id);
    return i.id;
  };

  // 势力（人物可能引用，先建）
  for (const f of result.factions) {
    if (facIdx.has(f.name)) { skipped.push(f.name); continue; }
    ensureFaction(f.name, {
      type: normalizeFactionType(f.type),
      stance: str(f.stance) || '中立',
      description: str(f.description),
      aliases: names(f.aliases).filter((a) => a !== f.name),
    });
  }
  // 地点（parent 可能引用批内地点）
  for (const l of result.locations) {
    if (locIdx.has(l.name)) { skipped.push(l.name); continue; }
    ensureLocation(l.name, {
      region: str(l.region),
      parentId: ensureLocation(str(l.parent)),
      description: str(l.description),
    });
  }
  // 人物（faction 引用势力）
  for (const c of result.characters) {
    if (charIdx.has(c.name)) { skipped.push(c.name); continue; }
    ensureChar(c.name, {
      role: normalizeRole(c.role),
      gender: str(c.gender),
      age: str(c.age),
      factionId: ensureFaction(str(c.faction)),
      appearance: str(c.appearance),
      personality: str(c.personality),
      background: str(c.background),
      goals: str(c.goals),
      aliases: names(c.aliases).filter((a) => a !== c.name),
    });
  }
  // 物品（owner → 人物，location → 地点）
  for (const i of result.items) {
    if (itemIdx.has(i.name)) { skipped.push(i.name); continue; }
    ensureItem(i.name, {
      type: str(i.type),
      rarity: str(i.rarity),
      ownerId: ensureChar(str(i.owner)),
      locationId: ensureLocation(str(i.location)),
      description: str(i.description),
    });
  }
  // 事件（参与者/因果名字 → id；批内新建事件按名字互相引用）
  let sortBase = project.events.reduce((max, e) => Math.max(max, e.sortIndex), 0);
  for (const e of result.events) {
    if (eventIdx.has(e.name)) { skipped.push(e.name); continue; }
    sortBase += 1;
    const ev: StoryEvent = {
      id: newId(), name: e.name, aliases: [], description: str(e.description), tags: [],
      timeLabel: str(e.timeLabel) || '未标时间',
      sortIndex: sortBase,
      locationId: ensureLocation(str(e.location)),
      participantIds: names(e.participants).map((n) => ensureChar(n)).filter((x): x is string => x !== null),
      causeIds: [], effectIds: [],
      importance: Math.min(5, Math.max(1, Math.round(num(e.importance, 3)))),
      chapterId: null,
      createdAt: now, updatedAt: now,
    };
    batch.events.push(ev);
    eventIdx.set(e.name, ev.id);
  }
  // 因果回填（事件已全部建好）
  for (const e of result.events) {
    const id = eventIdx.get(e.name);
    if (!id) continue;
    const ev = batch.events.find((x) => x.id === id);
    const resolveEvents = (list?: string[]) =>
      names(list).map((n) => eventIdx.get(n)).filter((x): x is string => x !== undefined && x !== id);
    if (ev) {
      ev.causeIds = [...new Set(resolveEvents(e.causes))];
      ev.effectIds = [...new Set(resolveEvents(e.effects))];
    }
  }
  // 关系
  for (const r of result.relations) {
    const fromId = charIdx.get(str(r.from));
    const toId = charIdx.get(str(r.to));
    if (!fromId || !toId || fromId === toId) continue;
    if (project.relations.some((x) => x.fromId === fromId && x.toId === toId)) continue;
    if (batch.relations.some((x) => x.fromId === fromId && x.toId === toId)) continue;
    batch.relations.push({
      id: newId(), fromId, toId,
      type: normalizeRelType(r.type),
      strength: Math.min(5, Math.max(1, Math.round(num(r.strength, 3)))),
      note: str(r.note),
    });
  }

  return {
    batch,
    skipped: [...new Set(skipped)],
    counts: {
      characters: batch.characters.length,
      relations: batch.relations.length,
      events: batch.events.length,
      items: batch.items.length,
      locations: batch.locations.length,
      factions: batch.factions.length,
    },
  };
}

/** 建谱用上下文：优先取粘贴文本，可附带全部章节正文（截断防超长）。 */
export function gatherProjectText(chapters: Chapter[], includeChapters: boolean, pasted: string): string {
  if (!includeChapters) return pasted;
  const body = chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => `【${c.title}】\n${c.content}`)
    .join('\n\n')
    .slice(0, 12000);
  return [pasted, body].filter(Boolean).join('\n\n').slice(0, 16000);
}

/**
 * 确认页勾选后生成最终批次：剔除未勾选实体，并清掉指向它们的引用
 *（势力/归属/参与者/因果/关系）。指向已有图谱实体或保留批内实体的引用原样保留——
 * 因此用「被排除的批内 id」判断，而不是「保留的批内 id」。
 */
export function finalizeBatch(plan: ImportPlan, excluded: ReadonlySet<string>): ImportBatch {
  const b = plan.batch;
  const drop = (kind: string, name: string | undefined) => (name ? excluded.has(`${kind}:${name}`) : false);
  const removed = {
    character: new Set(b.characters.filter((x) => drop('character', x.name)).map((x) => x.id)),
    faction: new Set(b.factions.filter((x) => drop('faction', x.name)).map((x) => x.id)),
    location: new Set(b.locations.filter((x) => drop('location', x.name)).map((x) => x.id)),
    item: new Set(b.items.filter((x) => drop('item', x.name)).map((x) => x.id)),
    event: new Set(b.events.filter((x) => drop('event', x.name)).map((x) => x.id)),
  };
  const aliveFaction = (id: string | null) => (id && !removed.faction.has(id) ? id : null);
  const aliveLocation = (id: string | null) => (id && !removed.location.has(id) ? id : null);
  const aliveCharacter = (id: string | null) => (id && !removed.character.has(id) ? id : null);
  return {
    characters: b.characters
      .filter((x) => !removed.character.has(x.id))
      .map((x) => ({ ...x, factionId: aliveFaction(x.factionId) })),
    factions: b.factions
      .filter((x) => !removed.faction.has(x.id))
      .map((x) => ({ ...x, leaderId: aliveCharacter(x.leaderId) })),
    locations: b.locations
      .filter((x) => !removed.location.has(x.id))
      .map((x) => ({ ...x, parentId: aliveLocation(x.parentId) })),
    items: b.items
      .filter((x) => !removed.item.has(x.id))
      .map((x) => ({ ...x, ownerId: aliveCharacter(x.ownerId), locationId: aliveLocation(x.locationId) })),
    events: b.events
      .filter((x) => !removed.event.has(x.id))
      .map((x) => ({
        ...x,
        locationId: aliveLocation(x.locationId),
        participantIds: x.participantIds.filter((id) => !removed.character.has(id)),
        causeIds: x.causeIds.filter((id) => !removed.event.has(id)),
        effectIds: x.effectIds.filter((id) => !removed.event.has(id)),
      })),
    relations: b.relations.filter((r) =>
      !removed.character.has(r.fromId) &&
      !removed.character.has(r.toId) &&
      !excluded.has(`relation:${r.fromId}-${r.toId}`),
    ),
  };
}
