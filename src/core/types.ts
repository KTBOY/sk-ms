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
}

export type FactionType = '宗门' | '王朝' | '组织' | '家族' | '其他';

export interface Faction extends BaseEntity {
  type: FactionType;
  leaderId: string | null;
  stance: string;
}

export type ChapterStatus = '草稿' | '写作中' | '已完成';

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

export interface ProjectSettings {
  ai: AISettings;
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
  ignoreWords: string[];
  settings: ProjectSettings;
}

export interface ProjectMeta {
  id: string;
  name: string;
  genre: string;
  updatedAt: number;
}
