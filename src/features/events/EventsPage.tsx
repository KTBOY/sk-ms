import { useEffect, useMemo, useState } from 'react';
import type { StoryEvent } from '../../core/types';
import { newId } from '../../core/id';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Button, Field, Input, Select, Stars, Tag, Textarea } from '../../components/ui/primitives';
import { EntityPicker, EntityPickerSingle } from '../../components/ui/EntityPicker';
import { Modal } from '../../components/ui/Modal';
import { CharacterAvatar } from '../../components/ui/Avatar';
import { IconPlus, IconTrash } from '../../components/icons';

/** 事件设计器：编年列表 + 详情弹窗（参与者/因果均走图谱联想）。 */

export function emptyEvent(sortIndex: number): StoryEvent {
  const now = Date.now();
  return {
    id: newId(), name: '', aliases: [], description: '', tags: [],
    timeLabel: '', sortIndex, locationId: null,
    participantIds: [], causeIds: [], effectIds: [],
    importance: 3, chapterId: null, createdAt: now, updatedAt: now,
  };
}

export function EventsPage() {
  const project = useProjectStore((s) => s.project);
  const upsertEvent = useProjectStore((s) => s.upsertEvent);
  const removeEvent = useProjectStore((s) => s.removeEvent);
  const focus = useUIStore((s) => s.focus);
  const consumeFocus = useUIStore((s) => s.consumeFocus);
  const confirm = useUIStore((s) => s.confirm);
  const pushToast = useUIStore((s) => s.pushToast);

  const [editing, setEditing] = useState<StoryEvent | null>(null);

  useEffect(() => {
    if (focus?.kind === 'event') {
      const ev = project?.events.find((e) => e.id === focus.id);
      if (ev) setEditing(structuredClone(ev));
      consumeFocus();
    }
  }, [focus, consumeFocus, project]);

  const events = useMemo(
    () => [...(project?.events ?? [])].sort((a, b) => a.sortIndex - b.sortIndex),
    [project],
  );

  if (!project) return null;
  const charName = (id: string) => project.characters.find((c) => c.id === id);
  const locName = (id: string | null) => (id ? project.locations.find((l) => l.id === id)?.name : undefined);
  const nextIndex = events.length ? Math.max(...events.map((e) => e.sortIndex)) + 1 : 1;

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h2>事件设计器<span className="page__en">EVENTS</span></h2>
          <p className="page__sub">按时间序沉淀因果链 —— 图谱与时间线的数据源，共 {events.length} 件</p>
        </div>
        <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setEditing(emptyEvent(nextIndex))}>新建事件</Button>
      </header>

      {events.length === 0 ? (
        <div className="ui-empty">
          <div className="ui-empty__title">还没有事件</div>
          <div className="ui-empty__hint">把关键剧情节点登记为事件，AI 就不会再把时间线写乱</div>
        </div>
      ) : (
        <div className="ev-list">
          {events.map((e) => (
            <button key={e.id} type="button" className="ev-row" onClick={() => setEditing(structuredClone(e))}>
              <span className="ev-row__idx">{e.sortIndex}</span>
              <span className="ev-row__main">
                <span className="ev-row__name">{e.name || '（未命名事件）'}</span>
                <span className="ev-row__desc">{e.description}</span>
              </span>
              {e.timeLabel && <Tag color="rgba(255,255,255,.6)">{e.timeLabel}</Tag>}
              {locName(e.locationId) && <Tag color="#6FE3D0">{locName(e.locationId)}</Tag>}
              <span className="ev-row__avatars">
                {e.participantIds.slice(0, 4).map((pid) => {
                  const c = charName(pid);
                  return c ? <CharacterAvatar key={pid} character={c} size={26} /> : null;
                })}
                {e.participantIds.length > 4 && <span className="dim">+{e.participantIds.length - 4}</span>}
              </span>
              <Stars value={e.importance} />
            </button>
          ))}
        </div>
      )}

      {editing && (
        <EventFormModal
          draft={editing}
          onClose={() => setEditing(null)}
          onDelete={async () => {
            const ok = await confirm('删除事件', `确定删除「${editing.name}」？相关因果关系将同步清理。`);
            if (!ok) return;
            removeEvent(editing.id);
            pushToast('事件已删除', 'warning');
            setEditing(null);
          }}
          onSave={(e) => {
            if (!e.name.trim()) { pushToast('事件必须有名称', 'error'); return; }
            upsertEvent({ ...e, name: e.name.trim() });
            pushToast(`事件「${e.name}」已保存`, 'success');
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EventFormModal({ draft, onSave, onClose, onDelete }: {
  draft: StoryEvent;
  onSave: (e: StoryEvent) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const project = useProjectStore((s) => s.project);
  const [e, setE] = useState<StoryEvent>(draft);
  if (!project) return null;
  const patch = (p: Partial<StoryEvent>) => setE((prev) => ({ ...prev, ...p }));
  const isNew = !project.events.some((x) => x.id === draft.id);

  return (
    <Modal open width={680} title={isNew ? '新建事件' : `编辑事件 · ${draft.name}`} onClose={onClose}
      footer={<>
        {!isNew && <Button variant="danger" icon={<IconTrash size={13} />} onClick={onDelete}>删除</Button>}
        <span style={{ flex: 1 }} />
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={() => onSave(e)}>保存事件</Button>
      </>}>
      <div className="grid2">
        <Field label="事件名 *">
          <Input value={e.name} onChange={(ev) => patch({ name: ev.target.value })} placeholder="如：幽冥教夜袭落霞镇" />
        </Field>
        <Field label="时间标签" hint="展示用，如「第三年·春」">
          <Input value={e.timeLabel} onChange={(ev) => patch({ timeLabel: ev.target.value })} />
        </Field>
        <Field label="排序序号 *" hint="驱动时间线 / 轨迹 / 事件图谱横轴">
          <Input type="number" value={e.sortIndex} onChange={(ev) => patch({ sortIndex: Number(ev.target.value) || 0 })} />
        </Field>
        <Field label="重要度"><Stars value={e.importance} onChange={(v) => patch({ importance: v })} /></Field>
        <Field label="发生地点">
          <EntityPickerSingle kind="location" value={e.locationId} onChange={(id) => patch({ locationId: id })} placeholder="选择地点" />
        </Field>
        <Field label="所属章节">
          <Select value={e.chapterId ?? ''} onChange={(ev) => patch({ chapterId: ev.target.value || null })}>
            <option value="">（未绑定章节）</option>
            {[...project.chapters].sort((a, b) => a.order - b.order).map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="参与人物" hint="必须从图谱选择，防止 AI 张冠李戴">
        <EntityPicker kind="character" multiple value={e.participantIds} onChange={(ids) => patch({ participantIds: ids })} placeholder="搜索人物添加…" />
      </Field>
      <div className="grid2">
        <Field label="前因事件" hint="驱动事件图谱因果箭头">
          <EntityPicker kind="event" multiple value={e.causeIds} onChange={(ids) => patch({ causeIds: ids })} excludeIds={[e.id]} placeholder="选择前置事件…" />
        </Field>
        <Field label="后果事件">
          <EntityPicker kind="event" multiple value={e.effectIds} onChange={(ids) => patch({ effectIds: ids })} excludeIds={[e.id]} placeholder="选择后续事件…" />
        </Field>
      </div>
      <Field label="事件描述"><Textarea rows={3} value={e.description} onChange={(ev) => patch({ description: ev.target.value })} /></Field>
    </Modal>
  );
}
