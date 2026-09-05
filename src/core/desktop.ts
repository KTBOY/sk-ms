/** 桌面桥（electron/preload.cjs 暴露）：浏览器环境不存在，据此区分桌面端 / Web 端。 */
import type { Project, ProjectMeta } from './types';

/** 数据目录解析结果：source 标明目录来源（default = 软件安装目录）。 */
export interface DataDirInfo {
  dir: string;
  source: 'custom' | 'default' | 'fallback';
  error?: string;
}

/** 本机数据存储（作品 JSON 落盘，目录可选）。仅桌面端可用。 */
export interface DesktopDataStorage {
  getInfo: () => Promise<DataDirInfo>;
  chooseDirectory: () => Promise<DataDirInfo | null>;
  resetToDefault: () => Promise<DataDirInfo>;
  openFolder: () => Promise<boolean>;
  listProjects: () => Promise<ProjectMeta[]>;
  loadProject: (id: string) => Promise<Project | null>;
  saveProject: (project: Project) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
}

export interface DesktopBridge {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
  dataStorage?: DesktopDataStorage;
}

declare global {
  interface Window {
    moshuDesktop?: DesktopBridge;
  }
}

export function getDesktopBridge(): DesktopBridge | null {
  return typeof window !== 'undefined' ? window.moshuDesktop ?? null : null;
}

/** 是否运行在桌面端（Electron）：有 preload 桥即为真。 */
export function isDesktop(): boolean {
  return getDesktopBridge() != null;
}
