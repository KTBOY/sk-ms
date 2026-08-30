import type { Project, ProjectMeta } from '../types';
import { toMeta, type RestConfig, type StorageAdapter } from './types';

/**
 * REST 适配器（预置）：替换 Base URL 后数据即可上云。
 * 接口契约：
 *   GET    {base}/projects          → { projects: ProjectMeta[] }
 *   GET    {base}/projects/:id      → { project: Project }
 *   PUT    {base}/projects/:id      body { project } → { ok: true }
 *   DELETE {base}/projects/:id      → { ok: true }
 * 鉴权（可选）：Authorization: Bearer {token}。注意服务端需开启 CORS。
 */
export class RestStorageAdapter implements StorageAdapter {
  readonly id = 'rest' as const;
  readonly label = 'REST API（远程）';

  constructor(private config: RestConfig) {}

  private url(path: string): string {
    const base = this.config.baseUrl.replace(/\/+$/, '');
    return `${base}${path}`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.token) headers.Authorization = `Bearer ${this.config.token}`;
    let res: Response;
    try {
      res = await fetch(this.url(path), { ...init, headers });
    } catch {
      throw new Error('无法连接到服务器，请检查 Base URL 与 CORS 配置');
    }
    if (!res.ok) throw new Error(`请求失败：HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  async listProjects(): Promise<ProjectMeta[]> {
    const data = await this.request<{ projects: ProjectMeta[] }>('/projects');
    return data.projects;
  }

  async loadProject(id: string): Promise<Project | null> {
    const data = await this.request<{ project: Project | null }>(`/projects/${encodeURIComponent(id)}`);
    return data.project;
  }

  async saveProject(project: Project): Promise<void> {
    await this.request(`/projects/${encodeURIComponent(project.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ project }),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

export function toMetaOf(project: Project): ProjectMeta {
  return toMeta(project);
}
