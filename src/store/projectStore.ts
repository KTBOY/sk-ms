import { create } from 'zustand';
import type {
  AgentCard, Chapter, ChapterVersion, Character, Faction, Item, LocationNode, Project, ProjectMeta,
  Relation, StoryEvent,
} from '../core/types';
import { createAdapter, loadAppSettings, saveAppSettings, indexedDbAdapter, desktopAdapter, type AppSettings } from '../core/storage';
import { createSeedProject } from '../core/seed';
import { newId } from '../core/id';

/**
 * 项目数据 Store：全部变更经 update()（结构化克隆 + 时间戳 + 防抖持久化）。
 * 删除操作带级联清理，防止悬空引用；体检引擎兜底。
 */

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface ProjectStore {
  project: Project | null;
  projects: ProjectMeta[];
  appSettings: AppSettings;
  saveState: SaveState;
  initialized: boolean;

  init: () => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  createProject: (name: string, genre: string, description: string) => Promise<void>;
  renameProject: (name: string, genre: string, description: string) => void;
  importProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  resetToSeed: () => Promise<void>;
  clearProject: () => void;
  setAdapter: (adapterId: AppSettings['adapterId'], rest?: AppSettings['rest']) => Promise<void>;
  refreshProjects: () => Promise<void>;

  /** 智能体角色卡（跨作品共用，存 appSettings.agents）。 */
  upsertAgent: (a: AgentCard) => void;
  removeAgent: (id: string) => void;
  moveAgent: (id: string, dir: -1 | 1) => void;

  update: (mutator: (p: Project) => void) => void;

  upsertCharacter: (c: Character) => void;
  removeCharacter: (id: string) => void;
  upsertEvent: (e: StoryEvent) => void;
  removeEvent: (id: string) => void;
  upsertItem: (i: Item) => void;
  removeItem: (id: string) => void;
  upsertLocation: (l: LocationNode) => void;
  removeLocation: (id: string) => void;
  upsertFaction: (f: Faction) => void;
  removeFaction: (id: string) => void;
  upsertRelation: (r: Relation) => void;
  removeRelation: (id: string) => void;
  addAliasTo: (kind: 'character' | 'item' | 'location' | 'faction' | 'event', id: string, alias: string) => void;
  removeAliasFrom: (kind: 'character' | 'item' | 'location' | 'faction' | 'event', id: string, alias: string) => void;
  addIgnoreWord: (word: string) => void;

  upsertChapter: (c: Chapter) => void;
  removeChapter: (id: string) => void;
  moveChapter: (id: string, dir: -1 | 1) => void;
  snapshotChapter: (id: string, label: ChapterVersion['label']) => boolean;
  restoreChapterVersion: (chapterId: string, versionId: string) => boolean;

  /** AI 建谱：一批实体/关系/事件经确认后一次性入库（单次持久化）。 */
  importGraph: (batch: {
    characters: Character[]; relations: Relation[]; events: StoryEvent[];
    items: Item[]; locations: LocationNode[]; factions: Faction[];
  }) => void;
}

/** 每章快照上限：超出淘汰最旧。 */
export const CHAPTER_VERSION_LIMIT = 20;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useProjectStore = create<ProjectStore>()((set, get) => {
  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer);
    set({ saveState: 'saving' });
    saveTimer = setTimeout(async () => {
      const { project, appSettings } = get();
      if (!project) return;
      try {
        await createAdapter(appSettings).saveProject(project);
        set({ saveState: 'saved' });
      } catch {
        set({ saveState: 'error' });
      }
    }, 800);
  };

  const apply = (mutator: (p: Project) => void) => {
    const { project } = get();
    if (!project) return;
    const draft = structuredClone(project);
    mutator(draft);
    draft.updatedAt = Date.now();
    set({ project: draft });
    persist();
  };

  /** 立即落盘防抖中的待存修改（切书/删除作品前调用，避免最后一瞬编辑丢进下一本书的保存窗口）。 */
  const flushPendingSave = async () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    const { project, appSettings } = get();
    if (!project) return;
    try {
      await createAdapter(appSettings).saveProject(project);
      set({ saveState: 'saved' });
    } catch {
      set({ saveState: 'error' });
    }
  };

  const loadInto = async (id: string, settings: AppSettings) => {
    await flushPendingSave();
    const adapter = createAdapter(settings);
    let project = await adapter.loadProject(id);
    if (!project) {
      project = createSeedProject();
      await adapter.saveProject(project);
    }
    settings.currentProjectId = id;
    saveAppSettings(settings);
    set({ project, appSettings: { ...settings } });
  };

  return {
    project: null,
    projects: [],
    appSettings: loadAppSettings(),
    saveState: 'idle',
    initialized: false,

    init: async () => {
      const settings = get().appSettings;
      const adapter = createAdapter(settings);
      let projects: ProjectMeta[] = [];
      try {
        projects = await adapter.listProjects();
      } catch {
        projects = [];
      }
      // 桌面端首次启用本机文件存储：把旧 IndexedDB 里的作品迁移进数据目录（非破坏性，IndexedDB 原样保留）
      if (adapter.id === 'desktop' && projects.length === 0 && !settings.fileStorageMigrated) {
        settings.fileStorageMigrated = true;
        saveAppSettings(settings);
        try {
          const legacy = await indexedDbAdapter.listProjects();
          for (const meta of legacy) {
            const project = await indexedDbAdapter.loadProject(meta.id);
            if (project) await desktopAdapter.saveProject(project);
          }
          projects = await adapter.listProjects();
        } catch {
          // 迁移失败不阻塞启动，IndexedDB 原数据仍在
        }
      }
      if (projects.length === 0) {
        const seed = createSeedProject();
        await adapter.saveProject(seed);
        projects = [{ id: seed.id, name: seed.name, genre: seed.genre, updatedAt: seed.updatedAt }];
        await loadInto(seed.id, settings);
      } else {
        const current = settings.currentProjectId && projects.some((p) => p.id === settings.currentProjectId)
          ? settings.currentProjectId
          : projects[0].id;
        await loadInto(current, settings);
      }
      set({ projects, initialized: true });
    },

    switchProject: async (id) => {
      await loadInto(id, { ...get().appSettings });
      await get().refreshProjects();
    },

    createProject: async (name, genre, description) => {
      const settings = get().appSettings;
      const base = createSeedProject();
      const project: Project = {
        ...base,
        id: newId(),
        name,
        genre,
        description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        characters: [], relations: [], events: [], items: [], locations: [], factions: [],
        chapters: [], ignoreWords: [],
        settings: { ai: { baseUrl: '', apiKey: '', model: '' } },
      };
      await createAdapter(settings).saveProject(project);
      await loadInto(project.id, settings);
      await get().refreshProjects();
    },

    renameProject: (name, genre, description) => {
      apply((p) => { p.name = name; p.genre = genre; p.description = description; });
    },

    importProject: async (project) => {
      const settings = get().appSettings;
      await createAdapter(settings).saveProject(project);
      await loadInto(project.id, settings);
      await get().refreshProjects();
    },

    deleteProject: async (id) => {
      const settings = get().appSettings;
      await createAdapter(settings).deleteProject(id);
      const projects = await createAdapter(settings).listProjects();
      set({ projects });
      if (get().project?.id === id) {
        if (projects.length) await loadInto(projects[0].id, { ...settings });
        else await get().createProject('未命名作品', '', '');
      }
    },

    resetToSeed: async () => {
      const settings = get().appSettings;
      const current = get().project;
      if (!current) return;
      const seed = createSeedProject();
      seed.id = current.id;
      seed.name = current.name;
      seed.updatedAt = Date.now();
      await createAdapter(settings).saveProject(seed);
      set({ project: seed });
      persist();
    },

    clearProject: () => {
      apply((p) => {
        p.characters = []; p.relations = []; p.events = []; p.items = [];
        p.locations = []; p.factions = []; p.chapters = []; p.ignoreWords = [];
      });
    },

    setAdapter: async (adapterId, rest) => {
      const settings = { ...get().appSettings };
      settings.adapterId = adapterId;
      if (rest) settings.rest = rest;
      saveAppSettings(settings);
      set({ appSettings: settings });
      await get().refreshProjects();
    },

    // ------------------------------------------------ 智能体角色卡（app 级，立即持久化，无防抖必要）
    upsertAgent: (a) => {
      const list = [...(get().appSettings.agents ?? [])];
      const idx = list.findIndex((x) => x.id === a.id);
      if (idx >= 0) list[idx] = a; else list.push(a);
      const settings = { ...get().appSettings, agents: list };
      saveAppSettings(settings);
      set({ appSettings: settings });
    },
    removeAgent: (id) => {
      const settings = { ...get().appSettings, agents: (get().appSettings.agents ?? []).filter((x) => x.id !== id) };
      saveAppSettings(settings);
      set({ appSettings: settings });
    },
    moveAgent: (id, dir) => {
      const list = [...(get().appSettings.agents ?? [])];
      const i = list.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      const settings = { ...get().appSettings, agents: list };
      saveAppSettings(settings);
      set({ appSettings: settings });
    },

    refreshProjects: async () => {
      try {
        const projects = await createAdapter(get().appSettings).listProjects();
        set({ projects });
      } catch {
        set({ projects: [] });
      }
    },

    update: apply,

    // ------------------------------------------------ 人物（含级联清理）
    upsertCharacter: (c) => apply((p) => {
      c.updatedAt = Date.now();
      const idx = p.characters.findIndex((x) => x.id === c.id);
      if (idx >= 0) p.characters[idx] = c; else p.characters.push(c);
    }),
    removeCharacter: (id) => apply((p) => {
      p.characters = p.characters.filter((c) => c.id !== id);
      p.relations = p.relations.filter((r) => r.fromId !== id && r.toId !== id);
      p.events.forEach((e) => { e.participantIds = e.participantIds.filter((x) => x !== id); });
      p.items.forEach((i) => { if (i.ownerId === id) i.ownerId = null; });
      p.factions.forEach((f) => { if (f.leaderId === id) f.leaderId = null; });
    }),

    // ------------------------------------------------ 事件
    upsertEvent: (e) => apply((p) => {
      e.updatedAt = Date.now();
      const idx = p.events.findIndex((x) => x.id === e.id);
      if (idx >= 0) p.events[idx] = e; else p.events.push(e);
    }),
    removeEvent: (id) => apply((p) => {
      p.events = p.events.filter((e) => e.id !== id);
      p.events.forEach((e) => {
        e.causeIds = e.causeIds.filter((x) => x !== id);
        e.effectIds = e.effectIds.filter((x) => x !== id);
      });
    }),

    // ------------------------------------------------ 物品 / 地点 / 势力
    upsertItem: (i) => apply((p) => {
      i.updatedAt = Date.now();
      const idx = p.items.findIndex((x) => x.id === i.id);
      if (idx >= 0) p.items[idx] = i; else p.items.push(i);
    }),
    removeItem: (id) => apply((p) => { p.items = p.items.filter((i) => i.id !== id); }),
    upsertLocation: (l) => apply((p) => {
      l.updatedAt = Date.now();
      const idx = p.locations.findIndex((x) => x.id === l.id);
      if (idx >= 0) p.locations[idx] = l; else p.locations.push(l);
    }),
    removeLocation: (id) => apply((p) => {
      p.locations = p.locations.filter((l) => l.id !== id);
      p.events.forEach((e) => { if (e.locationId === id) e.locationId = null; });
      p.items.forEach((i) => { if (i.locationId === id) i.locationId = null; });
      p.locations.forEach((l) => { if (l.parentId === id) l.parentId = null; });
    }),
    upsertFaction: (f) => apply((p) => {
      f.updatedAt = Date.now();
      const idx = p.factions.findIndex((x) => x.id === f.id);
      if (idx >= 0) p.factions[idx] = f; else p.factions.push(f);
    }),
    removeFaction: (id) => apply((p) => {
      p.factions = p.factions.filter((f) => f.id !== id);
      p.characters.forEach((c) => { if (c.factionId === id) c.factionId = null; });
    }),

    // ------------------------------------------------ 关系 / 别名 / 忽略词
    upsertRelation: (r) => apply((p) => {
      const idx = p.relations.findIndex((x) => x.id === r.id);
      if (idx >= 0) p.relations[idx] = r; else p.relations.push(r);
    }),
    removeRelation: (id) => apply((p) => { p.relations = p.relations.filter((r) => r.id !== id); }),
    addAliasTo: (kind, id, alias) => apply((p) => {
      const clean = alias.trim();
      if (!clean) return;
      const map: Record<string, Array<{ id: string; aliases: string[]; updatedAt: number }>> = {
        character: p.characters, event: p.events, item: p.items, location: p.locations, faction: p.factions,
      };
      const entity = map[kind]?.find((e) => e.id === id);
      if (entity && !entity.aliases.includes(clean)) {
        entity.aliases.push(clean);
        entity.updatedAt = Date.now();
      }
    }),
    removeAliasFrom: (kind, id, alias) => apply((p) => {
      const map: Record<string, Array<{ id: string; aliases: string[] }>> = {
        character: p.characters, event: p.events, item: p.items, location: p.locations, faction: p.factions,
      };
      const entity = map[kind]?.find((e) => e.id === id);
      if (entity) entity.aliases = entity.aliases.filter((a) => a !== alias);
    }),
    addIgnoreWord: (word) => apply((p) => {
      const clean = word.trim();
      if (clean && !p.ignoreWords.includes(clean)) p.ignoreWords.push(clean);
    }),

    // ------------------------------------------------ 章节
    upsertChapter: (c) => apply((p) => {
      c.updatedAt = Date.now();
      const idx = p.chapters.findIndex((x) => x.id === c.id);
      if (idx >= 0) p.chapters[idx] = c; else p.chapters.push(c);
    }),
    removeChapter: (id) => apply((p) => {
      p.chapters = p.chapters.filter((c) => c.id !== id);
      p.chapters.sort((a, b) => a.order - b.order).forEach((c, i) => { c.order = i + 1; });
      p.events.forEach((e) => { if (e.chapterId === id) e.chapterId = null; });
    }),
    moveChapter: (id, dir) => apply((p) => {
      const list = p.chapters.sort((a, b) => a.order - b.order);
      const idx = list.findIndex((c) => c.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= list.length) return;
      [list[idx], list[target]] = [list[target], list[idx]];
      list.forEach((c, i) => { c.order = i + 1; });
    }),

    // ------------------------------------------------ 版本历史（快照留存当前内容，回滚前自动再留一份）
    snapshotChapter: (id, label) => {
      const ch = get().project?.chapters.find((c) => c.id === id);
      if (!ch) return false;
      const snap: ChapterVersion = {
        id: newId(), at: Date.now(), title: ch.title,
        content: ch.content, wordCount: ch.content.replace(/\s/g, '').length, label,
      };
      apply((p) => {
        const target = p.chapters.find((c) => c.id === id);
        if (!target) return;
        target.versions = [...(target.versions ?? []), snap].slice(-CHAPTER_VERSION_LIMIT);
      });
      return true;
    },
    restoreChapterVersion: (chapterId, versionId) => {
      const project = get().project;
      const ch = project?.chapters.find((c) => c.id === chapterId);
      const ver = ch?.versions?.find((v) => v.id === versionId);
      if (!ch || !ver) return false;
      const rollbackSnap: ChapterVersion = {
        id: newId(), at: Date.now(), title: ch.title,
        content: ch.content, wordCount: ch.content.replace(/\s/g, '').length,
        label: 'manual',
      };
      apply((p) => {
        const target = p.chapters.find((c) => c.id === chapterId);
        if (!target) return;
        target.title = ver.title;
        target.content = ver.content;
        target.updatedAt = Date.now();
        // 回滚不可逆，先把当前内容留档，再挂上历史
        target.versions = [
          ...(target.versions ?? []).filter((v) => v.id !== versionId),
          rollbackSnap,
        ].slice(-CHAPTER_VERSION_LIMIT);
      });
      return true;
    },

    importGraph: (batch) => apply((p) => {
      const push = <T extends { id: string }>(list: T[], arr: T[]) => {
        const known = new Set(list.map((x) => x.id));
        for (const x of arr) if (!known.has(x.id)) { list.push(x); known.add(x.id); }
      };
      push(p.characters, batch.characters);
      push(p.relations, batch.relations);
      push(p.events, batch.events);
      push(p.items, batch.items);
      push(p.locations, batch.locations);
      push(p.factions, batch.factions);
    }),
  };
});
