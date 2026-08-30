import { useEffect, useState } from 'react';
import { RELATION_TYPES } from '../../core/types';
import type { Relation } from '../../core/types';
import { newId } from '../../core/id';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Modal } from '../../components/ui/Modal';
import { Button, Select, Stars, Tag } from '../../components/ui/primitives';
import { EntityPickerSingle } from '../../components/ui/EntityPicker';
import { RadarChart } from '../../components/ui/RadarChart';
import { CharacterAvatar } from '../../components/ui/Avatar';
import { IconEdit, IconPlus, IconTrash } from '../../components/icons';

/** 人物详情抽屉：资料 + 关系编辑 + 别名 + 参与事件。 */

export function CharacterDetailModal({ characterId, onClose, onEdit }: {
  characterId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
}) {
  const project = useProjectStore((s) => s.project);
  const upsertRelation = useProjectStore((s) => s.upsertRelation);
  const removeRelation = useProjectStore((s) => s.removeRelation);
  const removeCharacter = useProjectStore((s) => s.removeCharacter);
  const addAliasTo = useProjectStore((s) => s.addAliasTo);
  const removeAliasFrom = useProjectStore((s) => s.removeAliasFrom);
  const confirm = useUIStore((s) => s.confirm);
  const pushToast = useUIStore((s) => s.pushToast);
  const openDetail = useUIStore((s) => s.openDetail);

  const [relTarget, setRelTarget] = useState<string | null>(null);
  const [relType, setRelType] = useState<Relation['type']>('挚友');
  const [relStrength, setRelStrength] = useState(3);
  const [aliasText, setAliasText] = useState('');

  useEffect(() => {
    setRelTarget(null);
    setAliasText('');
  }, [characterId]);

  if (!characterId || !project) return null;
  const c = project.characters.find((x) => x.id === characterId);
  if (!c) return null;

  const faction = project.factions.find((f) => f.id === c.factionId);
  const relations = project.relations.filter((r) => r.fromId === c.id || r.toId === c.id);
  const nameOf = (id: string) => project.characters.find((x) => x.id === id)?.name ?? '（已删除）';
  const events = project.events.filter((e) => e.participantIds.includes(c.id)).sort((a, b) => a.sortIndex - b.sortIndex);

  const addRelation = () => {
    if (!relTarget || relTarget === c.id) return;
    upsertRelation({ id: newId(), fromId: c.id, toId: relTarget, type: relType, strength: relStrength, note: '' });
    setRelTarget(null);
    pushToast('关系已添加，可在关系图谱中查看', 'success');
  };

  const del = async () => {
    const ok = await confirm('删除人物', `确定删除「${c.name}」？其关系与事件参与记录将同步清理。`);
    if (!ok) return;
    removeCharacter(c.id);
    pushToast(`人物「${c.name}」已删除`, 'warning');
    onClose();
  };

  const addAlias = () => {
    const parts = aliasText.split(/[，,、\s]+/).map((s) => s.trim()).filter(Boolean);
    parts.forEach((a) => addAliasTo('character', c.id, a));
    setAliasText('');
  };

  return (
    <Modal open width={640} title="人物详情" onClose={onClose} footer={<>
      <Button variant="danger" icon={<IconTrash size={13} />} onClick={del}>删除</Button>
      <span style={{ flex: 1 }} />
      <Button icon={<IconEdit size={13} />} onClick={() => onEdit(c.id)}>编辑</Button>
    </>}>
      <div className="chardetail">
        <div className="chardetail__head">
          <CharacterAvatar character={c} size={104} />
          <div>
            <div className="chardetail__name">
              {c.name}
              <Tag color="#C9A6FF">{c.role}</Tag>
              {faction && <Tag color="#7FB0FF">{faction.name}</Tag>}
              <Tag color={c.status === '在世' ? '#4ADE80' : c.status === '死亡' ? '#FF6B6B' : 'rgba(255,255,255,.5)'}>{c.status}</Tag>
            </div>
            <div className="chardetail__meta">
              {c.gender && `${c.gender} · `}{c.age && `${c.age} · `}参与 {events.length} 个事件 · {relations.length} 条关系
            </div>
            {c.aliases.length > 0 && (
              <div className="alias-chips">
                {c.aliases.map((a) => (
                  <span key={a} className="ui-tag" title="点击移除别名" onClick={() => removeAliasFrom('character', c.id, a)}>
                    {a}<button type="button" aria-label="移除">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {c.description && <p className="chardetail__desc">{c.description}</p>}

        <div className="chardetail__cols">
          <div>
            <Section title="外观" text={c.appearance} />
            <Section title="性格" text={c.personality} />
            <Section title="背景" text={c.background} />
            <Section title="目标" text={c.goals} />
          </div>
          <div className="chardetail__radar">
            <RadarChart values={c.attributes} size={180} accent="gold" />
          </div>
        </div>

        <div className="chardetail__section">
          <h4>关系（{relations.length}）</h4>
          <ul className="rel-list">
            {relations.map((r) => {
              const otherId = r.fromId === c.id ? r.toId : r.fromId;
              return (
                <li key={r.id}>
                  <button type="button" className="rel-list__name" onClick={() => openDetail('character', otherId)}>{nameOf(otherId)}</button>
                  <Tag color="#C9A6FF">{r.type}{r.fromId === c.id ? ' →' : ' ←'}</Tag>
                  <Stars value={r.strength} />
                  {r.note && <span className="rel-list__note">{r.note}</span>}
                  <button type="button" className="rel-list__del" aria-label="删除关系" onClick={() => removeRelation(r.id)}><IconTrash size={13} /></button>
                </li>
              );
            })}
            {relations.length === 0 && <li className="rel-list__none">暂无关系，在下方添加第一条</li>}
          </ul>
          <div className="rel-add">
            <div className="rel-add__picker">
              <EntityPickerSingle kind="character" value={relTarget} onChange={setRelTarget}
                placeholder="选择关联人物" excludeIds={[c.id]} />
            </div>
            <Select value={relType} onChange={(e) => setRelType(e.target.value as Relation['type'])}>
              {RELATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Stars value={relStrength} onChange={setRelStrength} />
            <Button size="sm" variant="primary" icon={<IconPlus size={13} />} onClick={addRelation} disabled={!relTarget}>添加关系</Button>
          </div>
        </div>

        <div className="chardetail__section">
          <h4>别名管理</h4>
          <div className="alias-row">
            <input className="ui-input" value={aliasText} onChange={(e) => setAliasText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAlias(); } }}
              placeholder="添加别名（正文识别与联想都会使用）" />
            <Button size="sm" onClick={addAlias}>添加</Button>
          </div>
        </div>

        <div className="chardetail__section">
          <h4>参与事件</h4>
          <div className="event-chips">
            {events.map((e) => (
              <Tag key={e.id} color="#FF9E7A" onClick={() => openDetail('event', e.id)}>
                {e.sortIndex}. {e.name}
              </Tag>
            ))}
            {events.length === 0 && <span className="dim">暂无参与事件</span>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="chardetail__kv">
      <h4>{title}</h4>
      <p>{text}</p>
    </div>
  );
}
