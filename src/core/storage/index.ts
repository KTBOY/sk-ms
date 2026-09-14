import type { AgentCard } from '../types';
import type { AdapterId, RestConfig, StorageAdapter } from './types';
import { indexedDbAdapter } from './indexeddbAdapter';
import { localStorageAdapter } from './localStorageAdapter';
import { desktopAdapter } from './desktopAdapter';
import { RestStorageAdapter } from './restAdapter';
import { isDesktop } from '../desktop';

/** 应用级设置（存储适配器选择、当前作品等），独立于作品数据。 */

export interface AppSettings {
  adapterId: AdapterId;
  rest: RestConfig;
  currentProjectId: string | null;
  /** 桌面端是否已完成 IndexedDB → 本机文件 的一次性迁移（true 后用户显式选择不再被改写）。 */
  fileStorageMigrated?: boolean;
  /** 智能体角色卡（创作团队，跨作品共用，数组顺序即展示/导出顺序）。 */
  agents?: AgentCard[];
}

const APP_KEY = 'novel-atlas:app';

export const defaultAppSettings: AppSettings = {
  adapterId: 'indexeddb',
  rest: { baseUrl: '', token: '' },
  currentProjectId: null,
};

export function loadAppSettings(): AppSettings {
  const desktopDefault = isDesktop();
  try {
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return { ...defaultAppSettings, adapterId: desktopDefault ? 'desktop' : 'indexeddb' };
    const parsed = { ...defaultAppSettings, ...(JSON.parse(raw) as Partial<AppSettings>) };
    // 桌面端升级到文件存储：旧默认（未显式迁移标记的 IndexedDB）切到本机文件；
    // 浏览器里读到 desktop（如配置被复制）则回退 IndexedDB
    if (desktopDefault && parsed.adapterId === 'indexeddb' && !parsed.fileStorageMigrated) parsed.adapterId = 'desktop';
    if (!desktopDefault && parsed.adapterId === 'desktop') parsed.adapterId = 'indexeddb';
    return parsed;
  } catch {
    return { ...defaultAppSettings, adapterId: desktopDefault ? 'desktop' : 'indexeddb' };
  }
}

export function saveAppSettings(settings: AppSettings): void {
  localStorage.setItem(APP_KEY, JSON.stringify(settings));
}

export function createAdapter(settings: AppSettings): StorageAdapter {
  switch (settings.adapterId) {
    case 'desktop': return isDesktop() ? desktopAdapter : indexedDbAdapter;
    case 'localstorage': return localStorageAdapter;
    case 'rest': return new RestStorageAdapter(settings.rest);
    case 'indexeddb':
    default: return indexedDbAdapter;
  }
}

export type { AdapterId, RestConfig, StorageAdapter };
export { indexedDbAdapter, desktopAdapter };
