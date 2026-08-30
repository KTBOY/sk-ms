import { useMemo, useRef, useState } from 'react';
import type { BaseEntity, EntityKind } from '../../core/types';
import { entitiesOfKind, KIND_LABELS } from '../../core/collections';
import { bestMatches } from '../../core/fuzzy';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { newId } from '../../core/id';
import { IconAlert, IconPlus, IconSearch, IconX } from '../icons';

/**
 * 实体联想选择器（一致性引擎第二层：表单引用兜底）。
 * - 输入即过滤（支持别名与模糊匹配）
 * - 无匹配时给出琥珀色兜底提示：图谱中没有「xx」→ 建议相近项 / 立即登记
 * - 明确禁止自由文本引用：自由文本 = AI 拿不到设定 = 写崩源头
 */

interface EntityLike extends BaseEntity { avatar?: string | null }

function quickCreate(kind: EntityKind, name: string): BaseEntity {
  const now = Date.now();
  const base = { id: newId(), name, aliases: [] as string[], description: '', tags: [] as string[], createdAt: now, updatedAt: now };
  switch (kind) {
    case 'character': {
      const c: import('../../core/types').Character = { ...base, role: '配角', gender: '', age: '', factionId: null, appearance: '', personality: '', background: '', goals: '', status: '在世', avatar: null, attributes: { power: 50, wisdom: 50, charm: 50, will: 50, fortune: 50 } };
      return c;
    }
    case 'event': {
      const e: import('../../core/types').StoryEvent = { ...base, timeLabel: '', sortIndex: 999, locationId: null, participantIds: [], causeIds: [], effectIds: [], importance: 3, chapterId: null };
      return e;
    }
    case 'item': {
      const i: import('../../core/types').Item = { ...base, type: '', rarity: '普通', ownerId: null, locationId: null, origin: '', status: '' };
      return i;
    }
    case 'location': {
      const l: import('../../core/types').LocationNode = { ...base, region: '', parentId: null };
      return l;
    }
    case 'faction': {
      const f: import('../../core/types').Faction = { ...base, type: '其他', leaderId: null, stance: '' };
      return f;
    }
  }
}

export function EntityPicker({ kind, value, onChange, multiple = false, placeholder, excludeIds = [] }: {
  kind: EntityKind;
  value: string[];                     // 统一用数组；单选时取 [0]
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  excludeIds?: string[];
}) {
  const project = useProjectStore((s) => s.project);
  const upsert = useProjectStore((s) => {
    switch (kind) {
      case 'character': return s.upsertCharacter;
      case 'event': return s.upsertEvent;
      case 'item': return s.upsertItem;
      case 'location': return s.upsertLocation;
      case 'faction': return s.upsertFaction;
    }
  });
  const openDetail = useUIStore((s) => s.openDetail);
  const pushToast = useUIStore((s) => s.pushToast);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const all = useMemo(() => (project ? (entitiesOfKind(project, kind) as EntityLike[]) : []), [project, kind]);
  const byId = useMemo(() => new Map(all.map((e) => [e.id, e])), [all]);
  const selected = value.map((id) => byId.get(id)).filter(Boolean) as EntityLike[];

  const q = text.trim();
  const exact = q ? all.find((e) => e.name === q) : undefined;
  const options = q
    ? all.filter((e) => !excludeIds.includes(e.id) && (e.name.includes(q) || e.aliases.some((a) => a.includes(q)) || bestMatches(q, [e], 1, 0.5).length > 0))
    : all.filter((e) => !excludeIds.includes(e.id));
  const fuzzySuggests = q && !exact ? bestMatches(q, all.filter((e) => !excludeIds.includes(e.id)), 3, 0.55) : [];
  const mismatch = q.length >= 1 && !exact && options.length === 0;

  const commit = (id: string) => {
    if (multiple) {
      if (!value.includes(id)) onChange([...value, id]);
      setText('');
    } else {
      onChange([id]);
      setText('');
      setOpen(false);
    }
  };

  const createEntity = () => {
    if (!q) return;
    const entity = quickCreate(kind, q);
    upsert?.(entity as never);
    pushToast(`已快速登记${KIND_LABELS[kind]}「${q}」，可点击完善详情`, 'success');
    commit(entity.id);
  };

  return (
    <div className="epl" ref={rootRef} onBlur={(e) => { if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      {selected.length > 0 && (
        <div className="epl__chips">
          {selected.map((e) => (
            <span key={e.id} className="ui-tag epl__chip" title={e.description || e.name}>
              {e.name}
              <button type="button" aria-label="移除" onClick={() => onChange(value.filter((v) => v !== e.id))}><IconX size={11} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="epl__box">
        <IconSearch size={14} />
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? `搜索${KIND_LABELS[kind]}（支持别名）`}
        />
      </div>
      {open && (
        <div className="epl__pop">
          {options.length > 0 && (
            <ul className="epl__list">
              {options.slice(0, 8).map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => commit(e.id)}>
                    <span className="epl__name">{e.name}</span>
                    {e.aliases.length > 0 && <span className="epl__alias">别名：{e.aliases.join('、')}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {mismatch && (
            <div className="epl__mismatch">
              <div className="epl__mismatch-title"><IconAlert size={13} /> 图谱中没有「{q}」</div>
              {fuzzySuggests.length > 0 && (
                <div className="epl__mismatch-suggest">
                  你可能想选：
                  {fuzzySuggests.map((m) => (
                    <button key={m.item.id} type="button" onClick={() => commit(m.item.id)}>
                      {m.label}（{Math.round(m.score * 100)}%）
                    </button>
                  ))}
                </div>
              )}
              <div className="epl__mismatch-hint">自由填写的名字 AI 拿不到设定，容易写崩。</div>
              <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={createEntity}>
                <IconPlus size={13} /> 登记为新{KIND_LABELS[kind]}
              </button>
            </div>
          )}
          {!q && options.length === 0 && <div className="epl__empty">暂无{KIND_LABELS[kind]}，输入名称立即登记</div>}
        </div>
      )}
      {!multiple && selected.length > 0 && (
        <button type="button" className="epl__viewlink" onClick={() => openDetail(kind, selected[0].id)}>查看详情</button>
      )}
    </div>
  );
}

/** 单选便捷封装：null 语义。 */
export function EntityPickerSingle({ kind, value, onChange, placeholder, excludeIds }: Omit<Parameters<typeof EntityPicker>[0], 'value' | 'onChange' | 'multiple'> & {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <EntityPicker
      kind={kind}
      value={value ? [value] : []}
      onChange={(ids) => onChange(ids[0] ?? null)}
      placeholder={placeholder}
      excludeIds={excludeIds}
    />
  );
}
