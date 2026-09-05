import type { Paragraph } from 'docx';
import type { Project } from '../types';
import { downloadBlob, sanitize, type ExportOptions } from './index';

/** DOCX 导出：标题样式 + 章节正文 + 可选设定集附录。
    docx 库体积大 —— 运行时动态加载，不进启动包。 */

export async function exportDocx(project: Project, options: ExportOptions): Promise<void> {
  const { Document, HeadingLevel, Packer, Paragraph: ParagraphCtor, TextRun } = await import('docx');
  const p = (text: string): Paragraph => new ParagraphCtor({ children: [new TextRun(text)] });

  const children: Paragraph[] = [
    new ParagraphCtor({ text: project.name, heading: HeadingLevel.TITLE }),
    new ParagraphCtor({ children: [new TextRun({ text: `${project.genre} · 共 ${project.chapters.length} 章`, italics: true })] }),
  ];
  if (project.description) children.push(p(`简介：${project.description}`));

  for (const c of [...project.chapters].sort((a, b) => a.order - b.order)) {
    children.push(new ParagraphCtor({ text: c.title, heading: HeadingLevel.HEADING_1 }));
    c.content.split(/\n+/).forEach((line) => { if (line.trim()) children.push(p(line.trim())); });
  }

  if (options.includeWorldbook) {
    children.push(new ParagraphCtor({ text: '附录 · 设定集', heading: HeadingLevel.HEADING_1 }));
    const section = (title: string, rows: string[]) => {
      if (!rows.length) return;
      children.push(new ParagraphCtor({ text: title, heading: HeadingLevel.HEADING_2 }));
      rows.forEach((r) => children.push(p(r)));
    };
    section('人物', project.characters.map((c) => `【${c.name}】${c.role}${c.aliases.length ? `（别名：${c.aliases.join('/')}）` : ''} ${c.description}`));
    section('势力', project.factions.map((f) => `【${f.name}】${f.type} ${f.description}`));
    section('地点', project.locations.map((l) => `【${l.name}】${l.description}`));
    section('物品', project.items.map((i) => `【${i.name}】${i.rarity} ${i.description}`));
    section('大事记', [...project.events].sort((a, b) => a.sortIndex - b.sortIndex).map((e) => `${e.sortIndex}.〔${e.timeLabel}〕${e.name}：${e.description}`));
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(`${sanitize(project.name)}.docx`, blob);
}
