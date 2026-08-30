import type { AdapterId, RestConfig, StorageAdapter } from './types';
import { indexedDbAdapter } from './indexeddbAdapter';
import { localStorageAdapter } from './localStorageAdapter';
import { RestStorageAdapter } from './restAdapter';

/** 应用级设置（存储适配器选择、当前作品等），独立于作品数据。 */

export interface AppSettings {
  adapterId: AdapterId;
  rest: RestConfig;
  currentProjectId: string | null;
}

const APP_KEY = 'novel-atlas:app';

export const defaultAppSettings: AppSettings = {
  adapterId: 'indexeddb',
  rest: { baseUrl: '', token: '' },
  currentProjectId: null,
};

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return { ...defaultAppSettings };
    return { ...defaultAppSettings, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...defaultAppSettings };
  }
}

export function saveAppSettings(settings: AppSettings): void {
  localStorage.setItem(APP_KEY, JSON.stringify(settings));
}

export function createAdapter(settings: AppSettings): StorageAdapter {
  switch (settings.adapterId) {
    case 'localstorage': return localStorageAdapter;
    case 'rest': return new RestStorageAdapter(settings.rest);
    case 'indexeddb':
    default: return indexedDbAdapter;
  }
}

export type { AdapterId, RestConfig, StorageAdapter };
