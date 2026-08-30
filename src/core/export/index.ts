import type { Project } from '../types';

/** 导出公共工具：统一下载入口与文件名净化。 */

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, '_');
}

export function fullText(project: Project): string {
  return [...project.chapters]
    .sort((a, b) => a.order - b.order)
    .map((c) => c.content)
    .join('\n\n');
}

export interface ExportOptions {
  includeWorldbook: boolean;
}
