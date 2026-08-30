import { useEffect, useMemo, useState } from 'react';
import type { Character, CharacterRole } from '../../core/types';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Button, Input, Select, Tag } from '../../components/ui/primitives';
import { CharacterAvatar } from '../../components/ui/Avatar';
import { IconPlus, IconSearch } from '../../components/icons';
import { CharacterFormModal } from './CharacterFormModal';
import { CharacterDetailModal } from './CharacterDetailModal';

const ROLES: Array<CharacterRole | '全部'> = ['全部', '主角', '配角', '反派', '路人'];

export function CharactersPage() {
  const project = useProjectStore((s) => s.project);
  const focus = useUIStore((s) => s.focus);
  const consumeFocus = useUIStore((s) => s.consumeFocus);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<(typeof ROLES)[number]>('全部');
  const [factionFilter, setFactionFilter] = useState('全部');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Character | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (focus?.kind === 'character') {
      setDetailId(focus.id);
      consumeFocus();
    }
  }, [focus, consumeFocus]);

  const chars = useMemo(() => {
    if (!project) return [];
    const q = query.trim();
    return project.characters
      .filter((c) => (roleFilter === '全部' ? true : c.role === roleFilter))
      .filter((c) => (factionFilter === '全部' ? true : c.factionId === factionFilter))
      .filter((c) => !q || c.name.includes(q) || c.aliases.some((a) => a.includes(q)))
      .sort((a, b) => roleRank(a) - roleRank(b) || b.updatedAt - a.updatedAt);
  }, [project, query, roleFilter, factionFilter]);

  if (!project) return null;

  const factionName = (id: string | null) => project.factions.find((f) => f.id === id)?.name;
  const relCount = (id: string) => project.relations.filter((r) => r.fromId === id || r.toId === id).length;

  const openEdit = (id: string) => {
    setDetailId(null);
    setEditing(project.characters.find((c) => c.id === id) ?? null);
    setFormOpen(true);
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h2>人物设计器<span className="page__en">CHARACTERS</span></h2>
          <p className="page__sub">沉淀人物设定与关系网 —— AI 出场全靠它，共 {project.characters.length} 人</p>
        </div>
        <Button variant="primary" icon={<IconPlus size={14} />}
          onClick={() => { setEditing(null); setFormOpen(true); }}>新建人物</Button>
      </header>

      <div className="toolbar">
        <div className="toolbar__search">
          <IconSearch size={14} />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索姓名或别名" />
        </div>
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as (typeof ROLES)[number])}>
          {ROLES.map((r) => <option key={r} value={r}>{r === '全部' ? '全部定位' : r}</option>)}
        </Select>
        <Select value={factionFilter} onChange={(e) => setFactionFilter(e.target.value)}>
          <option value="全部">全部势力</option>
          {project.factions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </Select>
      </div>

      {chars.length === 0 ? (
        <div className="ui-empty">
          <div className="ui-empty__title">还没有人物</div>
          <div className="ui-empty__hint">先建主角，再逐步补充配角与反派</div>
          <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => { setEditing(null); setFormOpen(true); }}>新建人物</Button>
        </div>
      ) : (
        <div className="card-grid">
          {chars.map((c) => (
            <button key={c.id} type="button" className="char-card" onClick={() => setDetailId(c.id)}>
              <CharacterAvatar character={c} size={72} />
              <div className="char-card__body">
                <div className="char-card__name">{c.name}</div>
                <div className="char-card__tags">
                  <Tag color="#C9A6FF">{c.role}</Tag>
                  {factionName(c.factionId) && <Tag color="#7FB0FF">{factionName(c.factionId)}</Tag>}
                </div>
                <div className="char-card__desc">{c.aliases.length > 0 ? `别名：${c.aliases.join('、')}` : c.description}</div>
                <div className="char-card__meta">{relCount(c.id)} 条关系</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <CharacterFormModal open={formOpen} initial={editing} onClose={() => setFormOpen(false)} />
      <CharacterDetailModal characterId={detailId} onClose={() => setDetailId(null)} onEdit={openEdit} />
    </div>
  );
}

function roleRank(c: Character): number {
  return c.role === '主角' ? 0 : c.role === '配角' ? 1 : c.role === '反派' ? 2 : 3;
}
