import { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Button, Tag } from '../../components/ui/primitives';
import { EntityPickerSingle } from '../../components/ui/EntityPicker';
import { CharacterAvatar } from '../../components/ui/Avatar';
import { IconEvent } from '../../components/icons';

/** 时间线：编年体事件流，可按人物过滤；点击进事件编辑。 */

export function TimelinePage() {
  const project = useProjectStore((s) => s.project);
  const openDetail = useUIStore((s) => s.openDetail);
  const navigate = useUIStore((s) => s.navigate);
  const [charFilter, setCharFilter] = useState<string | null>(null);

  const events = useMemo(() => {
    if (!project) return [];
    return [...project.events]
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .filter((e) => !charFilter || e.participantIds.includes(charFilter));
  }, [project, charFilter]);

  if (!project) return null;
  const charOf = (id: string) => project.characters.find((c) => c.id === id);
  const locOf = (id: string | null) => (id ? project.locations.find((l) => l.id === id) : undefined);

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h2>时间线<span className="page__en">TIMELINE</span></h2>
          <p className="page__sub">全书大事编年 —— 按事件排序序号排列，防止时序错乱</p>
        </div>
        <div className="timeline__filter">
          <span className="dim">按人物过滤：</span>
          <EntityPickerSingle kind="character" value={charFilter} onChange={setCharFilter} placeholder="全部人物" />
          {charFilter && <Button size="sm" variant="ghost" onClick={() => setCharFilter(null)}>清除</Button>}
        </div>
      </header>

      {events.length === 0 ? (
        <div className="ui-empty">
          <div className="ui-empty__title">暂无事件</div>
          <Button variant="primary" icon={<IconEvent size={14} />} onClick={() => navigate('events')}>去事件设计器创建</Button>
        </div>
      ) : (
        <div className="tl">
          {events.map((e) => (
            <div key={e.id} className="tl__row">
              <div className="tl__time">{e.timeLabel || `序 ${e.sortIndex}`}</div>
              <div className="tl__axis"><span className="tl__dot" /></div>
              <button type="button" className="tl__card" onClick={() => openDetail('event', e.id)}>
                <div className="tl__head">
                  <span className="tl__name">{e.sortIndex}. {e.name}</span>
                  <span className="ui-stars"><span className="ui-stars__star is-on">{'★'.repeat(e.importance)}</span></span>
                </div>
                <div className="tl__desc">{e.description}</div>
                <div className="tl__meta">
                  {locOf(e.locationId) && <Tag color="#6FE3D0">{locOf(e.locationId)?.name}</Tag>}
                  {e.participantIds.slice(0, 6).map((pid) => {
                    const c = charOf(pid);
                    return c ? (
                      <span key={pid} className="tl__who" title={c.name} onClick={(ev) => { ev.stopPropagation(); openDetail('character', pid); }}>
                        <CharacterAvatar character={c} size={22} /> {c.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
