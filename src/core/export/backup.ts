import type { Project } from '../types';
import { downloadBlob, sanitize } from './index';

/** 全项目 JSON 备份 / 恢复（数据主权兜底 + 上云前的数据契约）。 */

export function exportBackup(project: Project): void {
  const payload = JSON.stringify({ app: 'novel-atlas', version: 1, project }, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(`${sanitize(project.name)}_备份_${date}.json`, new Blob([payload], { type: 'application/json;charset=utf-8' }));
}

export async function importBackup(file: File): Promise<Project> {
  const raw = await file.text();
  const data = JSON.parse(raw) as { app?: string; version?: number; project?: Project };
  const project = data.project ?? (data as unknown as Project);
  if (!project || typeof project.id !== 'string' || !Array.isArray(project.characters)) {
    throw new Error('文件格式不正确：不是有效的墨枢备份文件');
  }
  return project;
}
