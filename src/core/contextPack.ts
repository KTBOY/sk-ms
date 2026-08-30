import type { BaseEntity, Chapter, Project } from './types';
import { collectMentions } from './consistency';
import { findEntity } from './collections';

/**
 * 上下文包生成器：把"本章恰好需要"的设定打包成结构化 Markdown，
 * 供作者复制给任意 AI，或通过预置 AI 接口直接发送。
 */

const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function buildContextPack(project: Project, chapter: Chapter): string {
  const mentions = collectMentions(project, chapter.content);
  const countByEntity = new Map<string, number>();
  for (const m of mentions) countByEntity.set(m.entityId, (countByEntity.get(m.entityId) ?? 0) + 1);
  const mentioned = (id: string) => countByEntity.has(id);

  const charById = new Map(project.characters.map((c) => [c.id, c]));
  const lines: string[] = [];

  lines.push(`# 《${project.name}》· ${chapter.title} · 写作上下文包`);
  if (project.genre || project.description) {
    lines.push(`> 题材：${project.genre || '未设置'}　${trim(project.description, 80)}`);
  }
  lines.push('');

  if (chapter.synopsis) {
    lines.push('## 本章大纲', chapter.synopsis, '');
  }

  // 出场人物卡（按提及次数排序）
  const chars = project.characters
    .filter((c) => mentioned(c.id))
    .sort((a, b) => (countByEntity.get(b.id) ?? 0) - (countByEntity.get(a.id) ?? 0));
  if (chars.length) {
    lines.push('## 出场人物（设定以此为准，不得更改）');
    for (const c of chars) {
      const faction = c.factionId ? findEntity(project, 'faction', c.factionId)?.name : '';
      const rels = project.relations
        .filter((r) => r.fromId === c.id || r.toId === c.id)
        .slice(0, 4)
        .map((r) => {
          const otherId = r.fromId === c.id ? r.toId : r.fromId;
          const arrow = r.fromId === c.id ? '→' : '←';
          return `${r.type}${arrow}${charById.get(otherId)?.name ?? '?'}`;
        })
        .join('；');
      const parts = [
        `- **${c.name}**（${c.role}${faction ? `·${faction}` : ''}·${c.status}）`,
        c.aliases.length ? `别名：${c.aliases.join('、')}` : '',
        c.personality ? `性格：${trim(c.personality, 60)}` : '',
        c.goals ? `目标：${trim(c.goals, 60)}` : '',
        rels ? `关系：${rels}` : '',
      ].filter(Boolean);
      lines.push(parts.join('，'));
    }
    lines.push('');
  }

  // 相关地点 / 物品 / 势力
  const sections: Array<[string, BaseEntity[]]> = [
    ['地点', project.locations],
    ['物品', project.items],
    ['势力', project.factions],
  ];
  for (const [label, list] of sections) {
    const hit = list.filter((e) => mentioned(e.id));
    if (!hit.length) continue;
    lines.push(`## 相关${label}`);
    hit.forEach((e) => lines.push(`- **${e.name}**：${trim(e.description, 70) || '（无描述）'}`));
    lines.push('');
  }

  // 本章相关事件时间线
  const relatedEvents = project.events
    .filter((e) => e.chapterId === chapter.id || mentioned(e.id))
    .sort((a, b) => a.sortIndex - b.sortIndex);
  if (relatedEvents.length) {
    lines.push('## 相关事件时间线（因果顺序不得颠倒）');
    for (const e of relatedEvents) {
      const loc = e.locationId ? `@${findEntity(project, 'location', e.locationId)?.name ?? '?'}` : '';
      const who = e.participantIds
        .map((id) => charById.get(id)?.name)
        .filter(Boolean)
        .join('、');
      lines.push(`- ${e.sortIndex}.〔${e.timeLabel}〕**${e.name}**${loc}${who ? `　人物：${who}` : ''}`);
    }
    lines.push('');
  }

  // 上一章梗概
  const prev = [...project.chapters]
    .filter((c) => c.order < chapter.order)
    .sort((a, b) => b.order - a.order)[0];
  if (prev) {
    const recap = prev.synopsis || trim(prev.content, 120);
    lines.push('## 前情（上一章）', `《${prev.title}》：${recap}`, '');
  }

  // 防崩条款
  lines.push(
    '## 写作要求',
    '1. 严格遵循以上设定：人物性格、关系、生死状态不得改变；',
    '2. 不得引入上方未列出的新专有名词（人物/地点/物品/势力）；',
    '3. 事件因果与时间顺序不得与时间线冲突；',
    '4. 延续上一章的叙事视角与文风，直接续写正文。',
  );
  return lines.join('\n');
}
