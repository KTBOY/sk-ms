import { useCallback, useEffect, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Button, Segmented, Select, Tag } from '../../components/ui/primitives';
import { EntityPickerSingle } from '../../components/ui/EntityPicker';
import { CharacterAvatar } from '../../components/ui/Avatar';
import { IconSparkles } from '../../components/icons';
import { RelationshipGraph, factionColor } from './RelationshipGraph';
import { EventGraph, IMPORTANCE_COLORS } from './EventGraph';
import { TrajectoryChart } from './TrajectoryChart';
import { FactionMap } from './FactionMap';
import { BuildFromTextModal } from './BuildFromTextModal';

type GraphTab = 'relations' | 'events' | 'trajectory' | 'map';

/** 图谱中心：关系图谱 / 事件图谱 / 人物轨迹 / 势力地图 四视图。 */
export function GraphPage() {
  const project = useProjectStore((s) => s.project);
  const update = useProjectStore((s) => s.update);
  const openDetail = useUIStore((s) => s.openDetail);
  const [tab, setTab] = useState<GraphTab>('relations');
  const [selChar, setSelChar] = useState<string | null>(null);
  const [selEvent, setSelEvent] = useState<string | null>(null);
  const [selLoc, setSelLoc] = useState<string | null>(null);
  const [showShared, setShowShared] = useState(false);
  const [trajChar, setTrajChar] = useState<string | null>(null);
  const [buildOpen, setBuildOpen] = useState(false);

  useEffect(() => {
    if (!project) return;
    if (!trajChar) {
      const hero = project.characters.find((c) => c.role === '主角') ?? project.characters[0];
      if (hero) setTrajChar(hero.id);
    }
  }, [project, trajChar]);

  const onPickEvent = useCallback((id: string) => openDetail('event', id), [openDetail]);

  if (!project) return null;
  const char = selChar ? project.characters.find((c) => c.id === selChar) : undefined;
  const event = selEvent ? project.events.find((e) => e.id === selEvent) : undefined;
  const loc = selLoc ? project.locations.find((l) => l.id === selLoc) : undefined;

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h2>图谱中心<span className="page__en">ATLAS</span></h2>
          <p className="page__sub">关系网络 · 因果时序 · 人物轨迹 · 势力版图 —— 拖拽节点、滚轮或右上角按钮缩放、点击查看详情</p>
        </div>
        <div className="page__head-ops">
          <Button size="sm" icon={<IconSparkles size={12} />} onClick={() => setBuildOpen(true)}
            title="粘贴既有正文，AI 抽取实体批量入库">AI 建谱</Button>
          <Segmented<GraphTab>
            value={tab}
            onChange={(v) => { setTab(v); setSelChar(null); setSelEvent(null); setSelLoc(null); }}
            options={[
              { value: 'relations', label: '关系图谱' },
              { value: 'events', label: '事件图谱' },
              { value: 'trajectory', label: '人物轨迹' },
              { value: 'map', label: '势力地图' },
            ]}
          />
        </div>
      </header>

      <div className="graph-layout">
        <div className="graph-main">
          {tab === 'relations' && (
            <RelationshipGraph project={project} selectedId={selChar} onSelect={setSelChar} />
          )}
          {tab === 'events' && (
            <EventGraph project={project} selectedId={selEvent} onSelect={setSelEvent} showShared={showShared} />
          )}
          {tab === 'trajectory' && (
            <>
              <div className="graph-toolbar">
                <span className="dim">查看人物：</span>
                <EntityPickerSingle kind="character" value={trajChar} onChange={setTrajChar} placeholder="选择人物" />
              </div>
              <TrajectoryChart project={project} characterId={trajChar} onPickEvent={onPickEvent} />
            </>
          )}
          {tab === 'map' && (
            <>
              <div className="graph-toolbar">
                <span className="dim">拖拽地点可固定位置（布局随作品保存）；点击节点查看详情。</span>
                <Button size="sm" onClick={() => update((p) => { p.mapLayout = {}; })}>重置布局</Button>
              </div>
              <FactionMap project={project} selectedId={selLoc} onSelect={setSelLoc} />
            </>
          )}
          <div className="graph-legend">
            {tab === 'relations' && (<>
              <span><i className="dot" style={{ background: '#FFC24B' }} /> 金环 = 主角</span>
              <span><i className="dot" style={{ background: 'rgba(255,255,255,.3)' }} /> 灰环 = 已故</span>
              {project.factions.map((f) => (
                <span key={f.id}><i className="dot" style={{ background: factionColor(project, f.id) }} /> {f.name}</span>
              ))}
              <span className="dim">节点大小 = 关系数</span>
            </>)}
            {tab === 'events' && (<>
              <span className="dim">横轴 = 时间序 · 纵轴 = 因果泳道</span>
              <span><i className="dot" style={{ background: '#FFC24B' }} /> 重要事件（≥4）</span>
              <span><i className="dot" style={{ background: 'rgba(250,250,233,.4)' }} /> 普通事件</span>
              <span className="dim">红虚线 = 时序倒置警示</span>
              <label className="graph-legend__toggle">
                <input type="checkbox" checked={showShared} onChange={(e) => setShowShared(e.target.checked)} />
                共享连线（选中事件）
              </label>
            </>)}
            {tab === 'trajectory' && <span className="dim">按时间序展示该人物的全部事件路径</span>}
            {tab === 'map' && (<>
              {project.factions.map((f) => (
                <span key={f.id}><i className="dot" style={{ background: factionColor(project, f.id) }} /> {f.name}</span>
              ))}
              <span><i className="dot" style={{ background: 'rgba(250,250,233,.4)' }} /> 未归属</span>
              <span className="dim">节点大小 = 关联事件数 · 虚线 = 从属地点</span>
            </>)}
          </div>
        </div>

        <aside className="graph-side">
          {tab === 'relations' && (char ? (
            <div className="graph-detail">
              <CharacterAvatar character={char} size={72} />
              <h3>{char.name}</h3>
              <div className="graph-detail__tags">
                <Tag color="#C9A6FF">{char.role}</Tag>
                {project.factions.find((f) => f.id === char.factionId) && (
                  <Tag color={factionColor(project, char.factionId)}>{project.factions.find((f) => f.id === char.factionId)?.name}</Tag>
                )}
              </div>
              <p className="dim">{char.description}</p>
              <h4>关系</h4>
              <ul>
                {project.relations.filter((r) => r.fromId === char.id || r.toId === char.id).map((r) => {
                  const otherId = r.fromId === char.id ? r.toId : r.fromId;
                  const other = project.characters.find((c) => c.id === otherId);
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => setSelChar(otherId)}>{other?.name ?? '?'}</button>
                      <span className="dim">{r.type}</span>
                    </li>
                  );
                })}
              </ul>
              <Button size="sm" onClick={() => openDetail('character', char.id)}>查看完整档案</Button>
            </div>
          ) : (
            <div className="graph-detail graph-detail--empty">
              <p className="dim">点击图谱节点查看人物详情；拖拽可整理布局。</p>
            </div>
          ))}
          {tab === 'events' && (event ? (
            <div className="graph-detail">
              <h3>{event.name}</h3>
              <div className="graph-detail__tags">
                {event.timeLabel && <Tag color="rgba(255,255,255,.6)">{event.timeLabel}</Tag>}
                <Tag color={IMPORTANCE_COLORS[event.importance - 1]}>重要度 {event.importance}</Tag>
                {event.locationId && (
                  <Tag color="#6FE3D0">{project.locations.find((l) => l.id === event.locationId)?.name}</Tag>
                )}
              </div>
              <p className="dim">{event.description}</p>
              <h4>参与人物</h4>
              <div className="event-chips">
                {event.participantIds.map((pid) => (
                  <Tag key={pid} color="#C9A6FF" onClick={() => openDetail('character', pid)}>
                    {project.characters.find((c) => c.id === pid)?.name ?? '?'}
                  </Tag>
                ))}
              </div>
              <h4>因果</h4>
              <div className="event-chips">
                {event.causeIds.map((id) => (
                  <Tag key={id} color="#FF9E7A" onClick={() => setSelEvent(id)}>← {project.events.find((e) => e.id === id)?.name}</Tag>
                ))}
                {event.effectIds.map((id) => (
                  <Tag key={id} color="#FF9E7A" onClick={() => setSelEvent(id)}>{project.events.find((e) => e.id === id)?.name} →</Tag>
                ))}
                {event.causeIds.length + event.effectIds.length === 0 && <span className="dim">暂无</span>}
              </div>
              <Button size="sm" onClick={() => openDetail('event', event.id)}>编辑事件</Button>
            </div>
          ) : (
            <div className="graph-detail graph-detail--empty">
              <p className="dim">点击事件节点查看因果链与参与人物；开启上方「共享连线」开关后，会显示该事件与其他事件的共同人物。</p>
            </div>
          ))}
          {tab === 'map' && (loc ? (() => {
            const faction = loc.factionId ? project.factions.find((f) => f.id === loc.factionId) : undefined;
            const locEvents = project.events.filter((e) => e.locationId === loc.id);
            return (
              <div className="graph-detail">
                <h3>{loc.name}</h3>
                <div className="graph-detail__tags">
                  {loc.region && <Tag color="#6FE3D0">{loc.region}</Tag>}
                  {loc.parentId && <Tag color="rgba(255,255,255,.5)">属 {project.locations.find((l) => l.id === loc.parentId)?.name ?? '?'}</Tag>}
                  {faction && <Tag color={factionColor(project, faction.id)}>{faction.name}</Tag>}
                </div>
                {loc.description && <p className="dim">{loc.description}</p>}
                <h4>归属势力</h4>
                <Select value={loc.factionId ?? ''} onChange={(e) => {
                  const fid = e.target.value || null;
                  update((p) => {
                    const target = p.locations.find((l) => l.id === loc.id);
                    if (target) target.factionId = fid;
                  });
                }}>
                  <option value="">未归属</option>
                  {project.factions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
                {faction && (
                  <p className="dim" style={{ margin: '8px 0 0' }}>
                    首领：{project.characters.find((c) => c.id === faction.leaderId)?.name ?? '—'}
                    {' · '}立场：{faction.stance || '—'}
                    {' · '}成员 {project.characters.filter((c) => c.factionId === faction.id).length} 人
                  </p>
                )}
                <h4>关联事件（{locEvents.length}）</h4>
                <ul>
                  {locEvents.map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => openDetail('event', e.id)}>{e.name}</button>
                      <span className="dim">{e.timeLabel}</span>
                    </li>
                  ))}
                  {locEvents.length === 0 && <li className="dim">暂无</li>}
                </ul>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button size="sm" onClick={() => openDetail('location', loc.id)}>查看完整档案</Button>
                  {faction && <Button size="sm" onClick={() => { setTab('relations'); setSelChar(project.characters.find((c) => c.id === faction.leaderId)?.id ?? null); }}>看首领关系网</Button>}
                </div>
              </div>
            );
          })() : (
            <div className="graph-detail graph-detail--empty">
              <p className="dim">点击地点节点查看与设置归属势力；拖拽节点布置你的世界版图，布局会随作品保存。</p>
            </div>
          ))}
          {tab === 'trajectory' && (
            <div className="graph-detail">
              <p className="dim">
                轨迹图按时间序连接该人物参与的全部事件，上下交替布点避免重叠。
                点击节点可跳转事件编辑。
              </p>
            </div>
          )}
        </aside>
      </div>

      <BuildFromTextModal open={buildOpen} onClose={() => setBuildOpen(false)} />
    </div>
  );
}
