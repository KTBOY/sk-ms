/** 领域数据模型 —— 全项目唯一事实源。所有引用一律存 ID。 */

export type EntityKind = 'character' | 'event' | 'item' | 'location' | 'faction';

export interface BaseEntity {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type CharacterRole = '主角' | '配角' | '反派' | '路人';
export type CharacterStatus = '在世' | '死亡' | '未知';

export interface CharacterAttributes {
  power: number;   // 力量
  wisdom: number;  // 智谋
  charm: number;   // 魅力
  will: number;    // 意志
  fortune: number; // 机缘
}

export interface Character extends BaseEntity {
  role: CharacterRole;
  gender: string;
  age: string;
  factionId: string | null;
  appearance: string;
  personality: string;
  background: string;
  goals: string;
  status: CharacterStatus;
  avatar: string | null; // dataURL（上传时压缩到 256px 内）
  avatarFull?: string | null; // 裁剪前原图（压缩到 512px 内），用于大屏背景展示
  attributes: CharacterAttributes;
}

export const RELATION_TYPES = ['亲人', '师徒', '挚友', '恋人', '敌对', '同门', '上下级', '其他'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export interface Relation {
  id: string;
  fromId: string;
  toId: string;
  type: RelationType;
  strength: number; // 1-5
  note: string;
}

export interface StoryEvent extends BaseEntity {
  timeLabel: string;   // 展示用时间，如「第三年·春」
  sortIndex: number;   // 排序序号，驱动时间线/轨迹/事件图谱横轴
  locationId: string | null;
  participantIds: string[];
  causeIds: string[];
  effectIds: string[];
  importance: number;  // 1-5
  chapterId: string | null;
}

export interface Item extends BaseEntity {
  type: string;
  rarity: string;
  ownerId: string | null;
  locationId: string | null;
  origin: string;
  status: string;
}

export interface LocationNode extends BaseEntity {
  region: string;
  parentId: string | null;
  factionId?: string | null; // 归属/控制势力（可选，势力地图着色与详情用）
}

/** 势力地图中地点的手动布局坐标（画布逻辑坐标，随 d3-zoom 缩放平移）。 */
export interface MapPos {
  x: number;
  y: number;
}

export type FactionType = '宗门' | '王朝' | '组织' | '家族' | '其他';

export interface Faction extends BaseEntity {
  type: FactionType;
  leaderId: string | null;
  stance: string;
}

export type ChapterStatus = '草稿' | '写作中' | '已完成';

/**
 * 分卷：按章节 order 的闭区间划定卷范围，是「AI 上下文包导出」落正文分卷
 * （正文/卷NN-卷名/卷首.md + 第NNN章-章题.md）与设定集分卷视图的依据。
 * name 只存纯卷名（如「风雪入青云」）；卷序号取数组序，「卷一」等称呼按序推导。
 */
export interface Volume {
  id: string;
  name: string;
  startOrder: number; // 起始章 order（含）
  endOrder: number;   // 结束章 order（含）
}

/** 章节快照：自动/手动留存的历史版本（每章上限 20 条，超出淘汰最旧）。 */
export interface ChapterVersion {
  id: string;
  at: number;              // 快照时间
  title: string;           // 快照时的章节标题
  content: string;         // 快照时的正文
  wordCount: number;       // 快照时字数
  label: 'auto' | 'manual' | 'replace'; // 自动保存 / 手动 / 替换前
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  synopsis: string;
  status: ChapterStatus;
  order: number;
  updatedAt: number;
  versions?: ChapterVersion[];
}

export interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * 智能体角色卡：跨作品共用的创作团队（与写作工作区 agents/ 目录同一套人马）。
 * prompt 即 SOUL.md 全文；导出 AI 上下文包时按序落盘为 agents/NN-名字/SOUL.md，
 * 写作台「发送给 AI」可将选中角色卡作为 system 提示词注入。
 */
export interface AgentCard {
  id: string;
  name: string;     // 角色名，如「文风润色编辑」
  role: string;     // 职责一句话，如「风格纪律与语言精修」
  prompt: string;   // SOUL.md 全文
  enabled: boolean; // 关闭后不参与发送与导出
}

export interface ProjectSettings {
  ai: AISettings;
}

/**
 * 项目文档归类：由文档相对路径的顶层目录推导（见 core/docs/classify.ts categoryOf）。
 * setting/ledger/reports/promo 对应工作区同名目录；guide 收根级写作规则文档
 * （AGENTS.md / GOAL.md / README.md / 日更流水线.md 等）；tool 收 tools/ 脚本；其余归 other。
 */
export type DocCategory = 'setting' | 'ledger' | 'reports' | 'promo' | 'guide' | 'tool' | 'other';

/**
 * 项目文档：挂在作品下的任意文本文件（md / txt / py / json …），
 * 是「整个写作工作区无损往返」的承载层——导入按原相对路径收编、应用内可编辑、
 * 导出时按 path 原样回写到工作区目录。content 存原文，是唯一事实源；
 * 语义化视图只是对 content 的只读投影，编辑始终改 content 本身。
 */
export interface ProjectDoc {
  id: string;
  path: string;        // 相对工作区根目录，一律用「/」分隔，如 'setting/worldview.md'、'AGENTS.md'
  category: DocCategory;
  content: string;     // 原文全文
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  genre: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  characters: Character[];
  relations: Relation[];
  events: StoryEvent[];
  items: Item[];
  locations: LocationNode[];
  factions: Faction[];
  chapters: Chapter[];
  volumes?: Volume[];
  /** 工作区文档层：setting/ledger/reports/promo/tools 及根级 md 等全部非结构化文件。 */
  docs?: ProjectDoc[];
  /** 势力地图手动布局：locationId → 坐标；缺位的地点按区域自动布点。 */
  mapLayout?: Record<string, MapPos>;
  ignoreWords: string[];
  settings: ProjectSettings;
}

export interface ProjectMeta {
  id: string;
  name: string;
  genre: string;
  updatedAt: number;
}
