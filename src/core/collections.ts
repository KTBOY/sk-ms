import type { BaseEntity, EntityKind, Project } from './types';

/** 实体种类 → 项目集合键 的映射与统一访问工具。 */

export const KIND_LABELS: Record<EntityKind, string> = {
  character: '人物',
  event: '事件',
  item: '物品',
  location: '地点',
  faction: '势力',
};

export function entitiesOfKind(project: Project, kind: EntityKind): BaseEntity[] {
  switch (kind) {
    case 'character': return project.characters;
    case 'event': return project.events;
    case 'item': return project.items;
    case 'location': return project.locations;
    case 'faction': return project.factions;
  }
}

export function findEntity(project: Project, kind: EntityKind, id: string | null): BaseEntity | undefined {
  if (!id) return undefined;
  return entitiesOfKind(project, kind).find((e) => e.id === id);
}

export function entityName(project: Project, kind: EntityKind, id: string | null): string {
  return findEntity(project, kind, id)?.name ?? '（已删除）';
}

/** 在全项目五个集合中查找实体（用于全局搜索/详情跳转）。 */
export function locateEntity(project: Project, id: string): { kind: EntityKind; entity: BaseEntity } | null {
  for (const kind of Object.keys(KIND_LABELS) as EntityKind[]) {
    const entity = findEntity(project, kind, id);
    if (entity) return { kind, entity };
  }
  return null;
}
