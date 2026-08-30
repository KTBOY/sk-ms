import type { Project, ProjectMeta } from '../types';
import { toMeta, type StorageAdapter } from './types';

/** 本地 LocalStorage 适配器：简单可靠，但 5MB 容量有限，图片较多时建议 IndexedDB。 */

const PREFIX = 'novel-atlas:project:';

export const localStorageAdapter: StorageAdapter = {
  id: 'localstorage',
  label: '本地 LocalStorage',

  async listProjects(): Promise<ProjectMeta[]> {
    const metas: ProjectMeta[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      try {
        const project = JSON.parse(localStorage.getItem(key) ?? '') as Project;
        metas.push(toMeta(project));
      } catch {
        // 忽略损坏的数据行
      }
    }
    return metas.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async loadProject(id: string): Promise<Project | null> {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? (JSON.parse(raw) as Project) : null;
  },

  async saveProject(project: Project): Promise<void> {
    localStorage.setItem(PREFIX + project.id, JSON.stringify(project));
  },

  async deleteProject(id: string): Promise<void> {
    localStorage.removeItem(PREFIX + id);
  },
};
