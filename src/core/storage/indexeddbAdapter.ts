import type { Project, ProjectMeta } from '../types';
import { toMeta, type StorageAdapter } from './types';

/** 本地 IndexedDB 适配器（默认）：容量大，适合存放人物形象图等大字段。 */

const DB_NAME = 'novel-atlas';
const STORE = 'projects';
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB 操作失败'));
    });
  } finally {
    db.close();
  }
}

export const indexedDbAdapter: StorageAdapter = {
  id: 'indexeddb',
  label: '本地 IndexedDB（推荐）',

  async listProjects(): Promise<ProjectMeta[]> {
    const all = await withStore<Project[]>('readonly', (s) => s.getAll() as IDBRequest<Project[]>);
    return all.map(toMeta).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async loadProject(id: string): Promise<Project | null> {
    const hit = await withStore<Project | undefined>('readonly', (s) => s.get(id) as IDBRequest<Project | undefined>);
    return hit ?? null;
  },

  async saveProject(project: Project): Promise<void> {
    await withStore('readwrite', (s) => s.put(project) as IDBRequest<IDBValidKey>);
  },

  async deleteProject(id: string): Promise<void> {
    await withStore('readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>);
  },
};
