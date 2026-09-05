import { getDesktopBridge } from '../desktop';
import type { Project, ProjectMeta } from '../types';
import type { StorageAdapter } from './types';

/**
 * 桌面端本机文件适配器：经 IPC 把作品 JSON 落盘到可选数据目录
 * （目录解析与读写都在 electron/main.cjs）。浏览器环境调用即抛错。
 */

function storage() {
  const ds = getDesktopBridge()?.dataStorage;
  if (!ds) throw new Error('本机文件存储仅在桌面端可用');
  return ds;
}

export const desktopAdapter: StorageAdapter = {
  id: 'desktop',
  label: '本机文件（桌面端·推荐）',

  async listProjects(): Promise<ProjectMeta[]> {
    return (await storage().listProjects()).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async loadProject(id: string): Promise<Project | null> {
    return (await storage().loadProject(id)) ?? null;
  },

  async saveProject(project: Project): Promise<void> {
    await storage().saveProject(project);
  },

  async deleteProject(id: string): Promise<void> {
    await storage().deleteProject(id);
  },
};
