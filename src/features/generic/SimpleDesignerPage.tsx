import { useEffect, useMemo, useState } from 'react';
import type { BaseEntity, EntityKind, Project } from '../../core/types';
import { entitiesOfKind, KIND_LABELS } from '../../core/collections';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Button, Field, Input, Select, Tag, Textarea } from '../../components/ui/primitives';
import { EntityPicker, EntityPickerSingle } from '../../components/ui/EntityPicker';
import { Modal } from '../../components/ui/Modal';
import { IconPlus, IconSearch, IconTrash } from '../../components/icons';

/**
 * 通用设计器（schema 驱动）：物品 / 地点 / 势力共用。
 * 字段全部走图谱联想选择器 —— 引用必须是实体，杜绝自由文本。
 */

export type FieldDef<E> = {
  key: keyof E & string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'entity' | 'entityMulti';
  options?: string[];
  entityKind?: EntityKind;
  placeholder?: string;
  hint?: string;
  full?: boolean;
};

interface Props<E extends BaseEntity> {
  kind: EntityKind;
  title: string;
  en?: string;
  subtitle: string;
  fields: FieldDef<E>[];
  emptyOf: () => E;
  listOf: (p: Project) => E[];
  upsert: (e: E) => void;
  remove: (id: string) => void;
  cardTagline: (p: Project, e: E) => string;
  cardColor?: string;
  cardTags?: (p: Project, e: E) => Array<{ text: string; color?: string }>;
}

export function SimpleDesignerPage<E extends BaseEntity>(props: Props<E>) {
  const project = useProjectStore((s) => s.project);
  const focus = useUIStore((s) => s.focus);
  const consumeFocus = useUIStore((s) => s.consumeFocus);
  const confirm = useUIStore((s) => s.confirm);
  const pushToast = useUIStore((s) => s.pushToast);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<E | null>(null);

  useEffect(() => {
    if (focus?.kind === props.kind) {
      const hit = project ? entitiesOfKind(project, props.kind).find((e) => e.id === focus.id) : undefined;
      if (hit) setEditing(structuredClone(hit) as E);
      consumeFocus();
    }
  }, [focus, consumeFocus, project, props.kind]);

  const list = useMemo(() => {
    if (!project) return [];
    const q = query.trim();
    return props.listOf(project).filter((e) => !q || e.name.includes(q) || e.aliases.some((a) => a.includes(q)));
  }, [project, query, props.listOf]);

  if (!project) return null;

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h2>{props.title}{props.en && <span className="page__en">{props.en}</span>}</h2>
          <p className="page__sub">{props.subtitle}</p>
        </div>
        <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setEditing(props.emptyOf())}>
          新建{KIND_LABELS[props.kind]}
        </Button>
      </header>

      <div className="toolbar">
        <div className="toolbar__search">
          <IconSearch size={14} />
          <Input value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="搜索名称或别名" />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="ui-empty">
          <div className="ui-empty__title">暂无{KIND_LABELS[props.kind]}</div>
          <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setEditing(props.emptyOf())}>
            新建{KIND_LABELS[props.kind]}
          </Button>
        </div>
      ) : (
        <div className="card-grid">
          {list.map((e) => (
            <button key={e.id} type="button" className="simple-card" onClick={() => setEditing(structuredClone(e))}>
              <div className="simple-card__head">
                <span className="simple-card__name">{e.name}</span>
                {e.aliases.length > 0 && <span className="simple-card__alias">{e.aliases[0]}</span>}
              </div>
              {props.cardTags && (
                <div className="simple-card__tags">
                  {props.cardTags(project, e).map((t) => <Tag key={t.text} color={t.color}>{t.text}</Tag>)}
                </div>
              )}
              <div className="simple-card__line">{props.cardTagline(project, e)}</div>
              <div className="simple-card__desc">{e.description}</div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <Modal open width={600}
          title={`${project && listOfContains(project, props, editing) ? '编辑' : '新建'}${KIND_LABELS[props.kind]} · ${editing.name || ''}`}
          onClose={() => setEditing(null)}
          footer={<>
            <Button variant="danger" icon={<IconTrash size={13} />} onClick={async () => {
              const ok = await confirm(`删除${KIND_LABELS[props.kind]}`, `确定删除「${editing.name}」？`);
              if (!ok) return;
              props.remove(editing.id);
              pushToast('已删除', 'warning');
              setEditing(null);
            }}>删除</Button>
            <span style={{ flex: 1 }} />
            <Button onClick={() => setEditing(null)}>取消</Button>
            <Button variant="primary" onClick={() => {
              if (!editing.name.trim()) { pushToast('名称不能为空', 'error'); return; }
              props.upsert({ ...editing, name: editing.name.trim() });
              pushToast(`「${editing.name}」已保存`, 'success');
              setEditing(null);
            }}>保存</Button>
          </>}>
          <div className="grid2">
            {props.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                {renderField(editing, f, (v) => setEditing({ ...editing, [f.key]: v } as E))}
              </Field>
            ))}
          </div>
          <Field label="一句话描述" hint="会进入上下文包，喂给 AI">
            <Textarea rows={2} value={editing.description}
              onChange={(ev) => setEditing({ ...editing, description: ev.target.value })} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

function listOfContains<E extends BaseEntity>(p: Project, props: Props<E>, e: E): boolean {
  return props.listOf(p).some((x) => x.id === e.id);
}

function renderField<E extends BaseEntity>(entity: E, f: FieldDef<E>, set: (v: unknown) => void) {
  const value = entity[f.key as keyof E];
  switch (f.type) {
    case 'text':
      return <Input value={String(value ?? '')} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} />;
    case 'textarea':
      return <Textarea rows={2} value={String(value ?? '')} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} />;
    case 'select':
      return (
        <Select value={String(value ?? '')} onChange={(e) => set(e.target.value)}>
          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      );
    case 'entity':
      return (
        <EntityPickerSingle
          kind={f.entityKind ?? 'character'}
          value={(value as string | null) ?? null}
          onChange={(id) => set(id)}
          placeholder={f.placeholder} />
      );
    case 'entityMulti':
      return (
        <EntityPicker
          kind={f.entityKind ?? 'character'}
          multiple
          value={(value as string[]) ?? []}
          onChange={(ids) => set(ids)}
          placeholder={f.placeholder} />
      );
  }
}

export { entitiesOfKind };
