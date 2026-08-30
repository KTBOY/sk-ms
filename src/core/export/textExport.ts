import type { Project } from '../types';
import { downloadBlob, fullText, sanitize, type ExportOptions } from './index';

/** TXT / Markdown 导出。 */

export function exportTxt(project: Project): void {
  const header = `《${project.name}》\n${project.genre}\n\n`;
  downloadBlob(`${sanitize(project.name)}.txt`, new Blob([header + fullText(project)], { type: 'text/plain;charset=utf-8' }));
}

export function exportMarkdown(project: Project, options: ExportOptions): void {
  const lines: string[] = [`# ${project.name}`, '', `> ${project.genre} · 共 ${project.chapters.length} 章`, ''];
  const chapters = [...project.chapters].sort((a, b) => a.order - b.order);
  for (const c of chapters) {
    lines.push(`## ${c.title}`, '', c.content, '');
  }
  if (options.includeWorldbook) {
    lines.push('---', '', '# 附录 · 设定集', '');
    const section = (title: string, rows: string[]) => {
      if (!rows.length) return;
      lines.push(`## ${title}`, ...rows, '');
    };
    const factionName = (id: string | null) => project.factions.find((f) => f.id === id)?.name ?? '无';
    section('人物', project.characters.map((c) => `- **${c.name}**（${c.role}${c.aliases.length ? `，别名：${c.aliases.join('/')}` : ''}）：${c.description || c.background}`));
    section('势力', project.factions.map((f) => `- **${f.name}**（${f.type}，首领：${project.characters.find((c) => c.id === f.leaderId)?.name ?? '无'}）：${f.description}`));
    section('地点', project.locations.map((l) => `- **${l.name}**：${l.description}`));
    section('物品', project.items.map((i) => `- **${i.name}**（${i.rarity}）：${i.description}`));
    section('大事记', [...project.events].sort((a, b) => a.sortIndex - b.sortIndex).map((e) => `- ${e.sortIndex}.〔${e.timeLabel}〕**${e.name}**：${e.description}`));
    void factionName;
  }
  downloadBlob(`${sanitize(project.name)}.md`, new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
}
