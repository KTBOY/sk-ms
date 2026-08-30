import { SimpleDesignerPage } from './generic/SimpleDesignerPage';
import type { Faction, Item, LocationNode } from '../core/types';
import { newId } from '../core/id';
import { useProjectStore } from '../store/projectStore';

/** 物品 / 地点 / 势力三个设计器：基于通用设计器配置实例化。 */

const baseOf = (name = '') => ({
  id: newId(),
  name,
  aliases: [] as string[],
  description: '',
  tags: [] as string[],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export function ItemsPage() {
  const upsert = useProjectStore((s) => s.upsertItem);
  const remove = useProjectStore((s) => s.removeItem);
  const RARITY = ['普通', '稀有', '史诗', '传说'];
  return (
    <SimpleDesignerPage<Item>
      kind="item"
      title="物品设计器"
      en="ITEMS"
      subtitle="兵器、丹药、信物 —— 伏笔管理从这里开始"
      fields={[
        { key: 'name', label: '名称 *', type: 'text', placeholder: '如：青莲剑' },
        { key: 'aliases', label: '别名（逗号分隔）', type: 'text', placeholder: '如：青色令状' },
        { key: 'type', label: '类型', type: 'text', placeholder: '如：灵剑 / 丹药 / 信物' },
        { key: 'rarity', label: '稀有度', type: 'select', options: RARITY },
        { key: 'ownerId', label: '当前持有者', type: 'entity', entityKind: 'character' },
        { key: 'locationId', label: '所在位置', type: 'entity', entityKind: 'location' },
        { key: 'origin', label: '来历', type: 'text', full: true },
        { key: 'status', label: '当前状态', type: 'text', placeholder: '如：认主 / 封印中' },
      ]}
      emptyOf={() => ({ ...baseOf(), type: '', rarity: '普通', ownerId: null, locationId: null, origin: '', status: '' })}
      listOf={(p) => p.items}
      upsert={upsert}
      remove={remove}
      cardTagline={(p, e) => [
        e.type,
        p.characters.find((c) => c.id === e.ownerId)?.name && `持有：${p.characters.find((c) => c.id === e.ownerId)?.name}`,
        e.status,
      ].filter(Boolean).join(' · ')}
      cardTags={(_p, e) => {
        const tags: Array<{ text: string; color?: string }> = [{ text: e.rarity, color: e.rarity === '传说' ? '#FFD37A' : e.rarity === '史诗' ? '#C9A6FF' : e.rarity === '稀有' ? '#6FE3D0' : undefined }];
        if (e.tags[0]) tags.push({ text: e.tags[0] });
        return tags;
      }}
    />
  );
}

export function LocationsPage() {
  const upsert = useProjectStore((s) => s.upsertLocation);
  const remove = useProjectStore((s) => s.removeLocation);
  return (
    <SimpleDesignerPage<LocationNode>
      kind="location"
      title="地点设计器"
      en="LOCATIONS"
      subtitle="山门、城镇、禁地 —— 事件发生的舞台"
      fields={[
        { key: 'name', label: '名称 *', type: 'text', placeholder: '如：青云山' },
        { key: 'aliases', label: '别名（逗号分隔）', type: 'text' },
        { key: 'region', label: '所属区域', type: 'text', placeholder: '如：东洲' },
        { key: 'parentId', label: '上级地点', type: 'entity', entityKind: 'location' },
      ]}
      emptyOf={() => ({ ...baseOf(), region: '', parentId: null })}
      listOf={(p) => p.locations}
      upsert={upsert}
      remove={remove}
      cardTagline={(p, e) => {
        const parent = p.locations.find((l) => l.id === e.parentId)?.name;
        return [e.region, parent && `隶属：${parent}`].filter(Boolean).join(' · ') || '—';
      }}
      cardTags={(_p, e) => e.tags.map((t) => ({ text: t, color: '#6FE3D0' }))}
    />
  );
}

export function FactionsPage() {
  const upsert = useProjectStore((s) => s.upsertFaction);
  const remove = useProjectStore((s) => s.removeFaction);
  return (
    <SimpleDesignerPage<Faction>
      kind="faction"
      title="势力设计器"
      en="FACTIONS"
      subtitle="宗门、王朝、组织 —— 冲突与阵营的来源"
      fields={[
        { key: 'name', label: '名称 *', type: 'text', placeholder: '如：青云剑宗' },
        { key: 'aliases', label: '别名（逗号分隔）', type: 'text' },
        { key: 'type', label: '类型', type: 'select', options: ['宗门', '王朝', '组织', '家族', '其他'] },
        { key: 'leaderId', label: '首领', type: 'entity', entityKind: 'character' },
        { key: 'stance', label: '立场', type: 'text', placeholder: '如：正道 / 邪道 / 中立' },
      ]}
      emptyOf={() => ({ ...baseOf(), type: '宗门', leaderId: null, stance: '' })}
      listOf={(p) => p.factions}
      upsert={upsert}
      remove={remove}
      cardTagline={(p, e) => {
        const leader = p.characters.find((c) => c.id === e.leaderId)?.name;
        const members = p.characters.filter((c) => c.factionId === e.id).length;
        return [e.type, e.stance, leader && `首领：${leader}`, `${members} 名成员`].filter(Boolean).join(' · ');
      }}
      cardTags={(_p, e) => [{ text: e.type, color: '#7FB0FF' }]}
    />
  );
}
