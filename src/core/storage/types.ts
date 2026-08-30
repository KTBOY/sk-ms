import type { Project, ProjectMeta } from '../types';

/**
 * 存储适配器契约（代码即契约）。
 * 默认 IndexedDB；预置 REST 实现，替换 Base URL 即可上云。
 */
export type AdapterId = 'indexeddb' | 'localstorage' | 'rest';

export interface RestConfig {
  baseUrl: string;
  token: string;
}

export interface StorageAdapter {
  readonly id: AdapterId;
  readonly label: string;
  listProjects(): Promise<ProjectMeta[]>;
  loadProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
}

export function toMeta(project: Project): ProjectMeta {
  return { id: project.id, name: project.name, genre: project.genre, updatedAt: project.updatedAt };
}
