import { useEffect, useMemo, useRef, useState } from 'react';
import type { Character, CharacterRole, StoryEvent } from '../../core/types';
import { auditProject } from '../../core/consistency';
import { volumeHeading, volumeList } from '../../core/export/aiExport';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { CharacterAvatar } from '../../components/ui/Avatar';
import { Tag } from '../../components/ui/primitives';
import { IconAlert } from '../../components/icons';
import { RelationshipGraph } from '../graph/RelationshipGraph';
import { CompareRadar, RADAR_COLORS } from './CompareRadar';

/**
 * 设定集 —— 单页式「大纲与世界观总览」（原静态《设定集.html》的功能融合版）。
 * 与静态页的根本差别：一切区块均由作品数据实时渲染（以应用数据为准），作品切换即换书。
 * 区块：壹总览 · 贰地理格局 · 叁战力体系 · 肆人物谱 · 伍关系图谱 · 陆势力版图 · 柒情节脉络 · 捌一致性体检。
 */

const SECTIONS = [
  { id: 'ov', num: '壹', zh: '总览', en: 'OVERVIEW' },
  { id: 'geo', num: '贰', zh: '地理格局', en: 'GEOGRAPHY' },
  { id: 'power', num: '叁', zh: '战力体系', en: 'POWER' },
  { id: 'chars', num: '肆', zh: '人物谱', en: 'CHARACTERS' },
  { id: 'rel', num: '伍', zh: '关系图谱', en: 'RELATIONS' },
  { id: 'fac', num: '陆', zh: '势力版图', en: 'FACTIONS' },
  { id: 'plot', num: '柒', zh: '情节脉络', en: 'PLOT' },
  { id: 'audit', num: '捌', zh: '一致性体检', en: 'AUDIT' },
] as const;

const ROLES: CharacterRole[] = ['主角', '配角', '反派', '路人'];

const wordCount = (s: string) => s.replace(/\s/g, '').length;

function SecHead({ num, zh, en }: { num: string; zh: string; en: string }) {
  return (
    <header className="glass-panel__head">
      <h3><span className="atlas-sec-num">{num}</span>{zh}<span className="head-en">{en}</span></h3>
    </header>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="dim" style={{ margin: '6px 0 0' }}>{text}</p>;
}

export function AtlasPage() {
  const project = useProjectStore((s) => s.project);
  const openDetail = useUIStore((s) => s.openDetail);
  const pushToast = useUIStore((s) => s.pushToast);

  const [active, setActive] = useState<string>('ov');
  const [roleFilter, setRoleFilter] = useState<'全部' | CharacterRole>('全部');
  const [factionFilter, setFactionFilter] = useState<string>('全部');
  const [radarIds, setRadarIds] = useState<string[]>([]);
  const [relSelected, setRelSelected] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  /* ---------------- 派生数据 ---------------- */

  const stats = useMemo(() => {
    if (!project) return null;
    const done = project.chapters.filter((c) => c.status === '已完成').length;
    const doing = project.chapters.filter((c) => c.status === '写作中').length;
    const draft = project.chapters.filter((c) => c.status === '草稿').length;
    const words = project.chapters.reduce((acc, c) => acc + wordCount(c.content), 0);
    return { done, doing, draft, words, total: project.chapters.length };
  }, [project]);

  const vols = useMemo(() => (project ? volumeList(project) : []), [project]);

  const regions = useMemo(() => {
    if (!project) return [];
    const map = new Map<string, typeof project.locations>();
    for (const l of project.locations) {
      const key = l.region.trim() || '未划区域';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return [...map.entries()];
  }, [project]);

  const radarPool = useMemo(() => {
    if (!project) return [];
    const order = (c: Character) => ROLES.indexOf(c.role);
    return [...project.characters].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, 'zh'));
  }, [project]);

  // 默认锁定前 4 位（主角优先）；作品变化时只做一次初始化
  useEffect(() => {
    setRadarIds(radarPool.slice(0, 4).map((c) => c.id));
  }, [radarPool]);

  const powerRank = useMemo(() => {
    if (!project) return [];
    return [...project.characters].sort((a, b) => b.attributes.power - a.attributes.power).slice(0, 12);
  }, [project]);

  const chars = useMemo(() => {
    if (!project) return [];
    return project.characters
      .filter((c) => (roleFilter === '全部' || c.role === roleFilter)
        && (factionFilter === '全部' || c.factionId === factionFilter))
      .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name, 'zh'));
  }, [project, roleFilter, factionFilter]);

  const events = useMemo(() => {
    if (!project) return [] as StoryEvent[];
    return [...project.events].sort((a, b) => a.sortIndex - b.sortIndex);
  }, [project]);

  const issues = useMemo(() => (project ? auditProject(project) : []), [project]);

  /* ---------------- 滚动联动 ---------------- */

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const ob = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { threshold: [0.15, 0.4], rootMargin: '-8% 0px -55% 0px' },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(`atlas-${s.id}`);
      if (el) ob.observe(el);
    }
    return () => ob.disconnect();
  }, [project]);

  if (!project || !stats) return null;

  const factionName = (id: string | null) => project.factions.find((f) => f.id === id)?.name ?? '';
  const eventName = (id: string) => project.events.find((e) => e.id === id)?.name ?? '？';
  const locName = (id: string | null) => project.locations.find((l) => l.id === id)?.name ?? '';

  const jumpTo = (id: string) => {
    document.getElementById(`atlas-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleRadar = (id: string) => {
    setRadarIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) {
        pushToast('雷达对比最多同时叠加 4 人，已替换最早一位', 'info');
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const radarSeries = radarIds
    .map((id, i) => {
      const c = project.characters.find((x) => x.id === id);
      return c ? { name: c.name, values: c.attributes, color: RADAR_COLORS[i % RADAR_COLORS.length], active: true } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h2>设定集<span className="page__en">ATLAS</span></h2>
          <p className="page__sub">《{project.name}》· 大纲与世界观总览 · 全部区块随作品数据实时渲染</p>
        </div>
      </header>

      <div className="atlas-body">
        <nav className="atlas-nav" aria-label="设定集分区">
          {SECTIONS.map((s) => (
            <button key={s.id} type="button"
              className={`atlas-nav__btn ${active === s.id ? 'is-active' : ''}`}
              onClick={() => jumpTo(s.id)}>
              <span className="atlas-nav__num">{s.num}</span>
              {s.zh}
              <i>{s.en}</i>
            </button>
          ))}
        </nav>

        <div className="atlas-main" ref={mainRef}>
          {/* 壹 总览 */}
          <section className="glass-panel atlas-sec" id="atlas-ov">
            <SecHead num="壹" zh="总览" en="OVERVIEW" />
            <div className="atlas-sec-body">
              <div className="atlas-kv">
                <div className="atlas-card"><h4>作品</h4>
                  <div className="atlas-card__big">{project.name}</div>
                  <p>{project.genre || '未设类型'}</p>
                </div>
                <div className="atlas-card"><h4>核心立意</h4>
                  <div className="atlas-card__big">{project.description ? '见简介' : '—'}</div>
                  <p>{project.description || '在「设置」中补充作品简介'}</p>
                </div>
                <div className="atlas-card"><h4>体量规模</h4>
                  <div className="atlas-card__big">{stats.total} 章 · {stats.words.toLocaleString()} 字</div>
                  <p>{project.characters.length} 人物 · {project.relations.length} 关系 · {project.events.length} 事件 · {project.locations.length} 地点 · {project.factions.length} 势力 · {project.items.length} 物品</p>
                </div>
                <div className="atlas-card"><h4>写作进度</h4>
                  <div className="atlas-card__big">{stats.done} / {stats.total}</div>
                  <p>已完成 {stats.done} · 写作中 {stats.doing} · 草稿 {stats.draft}（数据更新于 {new Date(project.updatedAt).toLocaleDateString('zh-CN')}）</p>
                </div>
              </div>
              {vols.length > 0 ? (
                <div className="atlas-card" style={{ marginTop: 12 }}>
                  <h4>分卷进度<span className="atlas-tag">共 {vols.length} 卷</span></h4>
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    {vols.map((v, i) => {
                      const inVol = project.chapters.filter((c) => c.order >= v.startOrder && c.order <= v.endOrder);
                      const done = inVol.filter((c) => c.status === '已完成').length;
                      const pct = inVol.length ? Math.round((done / inVol.length) * 100) : 0;
                      return (
                        <div key={v.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span>{volumeHeading(v, i)}</span>
                            <span className="dim">第 {v.startOrder}–{v.endOrder} 章 · {done}/{inVol.length} 完稿</span>
                          </div>
                          <div className="atlas-bar"><i style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyHint text="尚未定义分卷：可到「导出中心 → 分卷管理」按章号区间划卷，正文分卷导出与这里的进度条都会使用它。" />
              )}
            </div>
          </section>

          {/* 贰 地理格局 */}
          <section className="glass-panel atlas-sec" id="atlas-geo">
            <SecHead num="贰" zh="地理格局" en="GEOGRAPHY" />
            <div className="atlas-sec-body">
              {regions.length === 0 && <EmptyHint text="还没有地点数据。" />}
              <div className="atlas-grid3">
                {regions.map(([region, locs]) => (
                  <div className="atlas-card" key={region}>
                    <h4>{region}<span className="atlas-tag">{locs.length} 处</span></h4>
                    <ul className="atlas-loc">
                      {locs.map((l) => (
                        <li key={l.id}>
                          <button type="button" className="atlas-link" onClick={() => openDetail('location', l.id)}>
                            <b>{l.name}</b>
                            {l.parentId && <span className="dim">（属 {locName(l.parentId)}）</span>}
                          </button>
                          {l.description && <p>{l.description}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 叁 战力体系 */}
          <section className="glass-panel atlas-sec" id="atlas-power">
            <SecHead num="叁" zh="战力体系" en="POWER" />
            <div className="atlas-sec-body">
              <p className="dim" style={{ margin: '0 0 10px' }}>
                五维数值（0–100）为团队内控标尺：力量 / 智谋 / 魅力 / 意志 / 机缘；数值不落正文，战斗只写「势」与「巧」。
              </p>
              <div className="atlas-power">
                <div className="atlas-card">
                  <h4>五维雷达 · 叠加对比<span className="atlas-tag">至多 4 人</span></h4>
                  {radarSeries.length > 0
                    ? <CompareRadar series={radarSeries} />
                    : <EmptyHint text="在下方人物谱中先录入人物。" />}
                  <div className="atlas-chips" style={{ marginTop: 8 }}>
                    {radarPool.map((c) => (
                      <button key={c.id} type="button"
                        className={`atlas-chip ${radarIds.includes(c.id) ? 'is-on' : ''}`}
                        onClick={() => toggleRadar(c.id)}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="atlas-card">
                  <h4>力量维参照系<span className="atlas-tag">前 12 位（升序展示）</span></h4>
                  <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                    {[...powerRank].reverse().map((c) => (
                      <div key={c.id} className="atlas-hbar">
                        <span className="atlas-hbar__label">
                          {c.name}{c.status === '死亡' && <em title="已故">†</em>}
                        </span>
                        <span className="atlas-hbar__track"><i style={{ width: `${c.attributes.power}%` }} /></span>
                        <span className="atlas-hbar__val">{c.attributes.power}</span>
                      </div>
                    ))}
                    {powerRank.length === 0 && <EmptyHint text="还没有人物数值。" />}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 肆 人物谱 */}
          <section className="glass-panel atlas-sec" id="atlas-chars">
            <SecHead num="肆" zh="人物谱" en="CHARACTERS" />
            <div className="atlas-sec-body">
              <div className="atlas-chips" style={{ marginBottom: 8 }}>
                {(['全部', ...ROLES] as const).map((r) => (
                  <button key={r} type="button"
                    className={`atlas-chip ${roleFilter === r ? 'is-on' : ''}`}
                    onClick={() => setRoleFilter(r)}>
                    {r === '全部' ? `全部 ${project.characters.length}` : r}
                  </button>
                ))}
                {project.factions.map((f) => (
                  <button key={f.id} type="button"
                    className={`atlas-chip ${factionFilter === f.id ? 'is-on' : ''}`}
                    onClick={() => setFactionFilter(factionFilter === f.id ? '全部' : f.id)}>
                    {f.name}
                  </button>
                ))}
              </div>
              {chars.length === 0 ? (
                <EmptyHint text="当前筛选下没有人物。" />
              ) : (
                <div className="card-grid">
                  {chars.map((c) => (
                    <button key={c.id} type="button" className="char-card" onClick={() => openDetail('character', c.id)}>
                      <CharacterAvatar character={c} size={64} />
                      <div className="char-card__body">
                        <div className="char-card__name">
                          {c.name}{c.status === '死亡' && <em style={{ fontStyle: 'normal', color: 'var(--danger, #e07070)' }}> †</em>}
                        </div>
                        <div className="char-card__tags">
                          <Tag color="#C9A6FF">{c.role}</Tag>
                          {factionName(c.factionId) && <Tag color="#7FB0FF">{factionName(c.factionId)}</Tag>}
                          <Tag color="#6FE3D0">{c.status}</Tag>
                        </div>
                        <div className="char-card__desc">{c.description || c.background || '—'}</div>
                        <div className="char-card__meta">
                          力 {c.attributes.power} · 智 {c.attributes.wisdom} · 魅 {c.attributes.charm} · 意 {c.attributes.will} · 缘 {c.attributes.fortune}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 伍 关系图谱 */}
          <section className="glass-panel atlas-sec" id="atlas-rel">
            <SecHead num="伍" zh="关系图谱" en="RELATIONS" />
            <div className="atlas-sec-body">
              {project.characters.length === 0 ? (
                <EmptyHint text="还没有人物，无法生成关系图谱。" />
              ) : (
                <>
                  <RelationshipGraph project={project} selectedId={relSelected} onSelect={setRelSelected} height={460} />
                  <p className="dim" style={{ margin: '8px 0 0' }}>
                    共 {project.relations.length} 条关系 · 悬停/点选节点查看相邻关系；完整编辑请到「图谱」页。
                  </p>
                </>
              )}
            </div>
          </section>

          {/* 陆 势力版图 */}
          <section className="glass-panel atlas-sec" id="atlas-fac">
            <SecHead num="陆" zh="势力版图" en="FACTIONS" />
            <div className="atlas-sec-body">
              {project.factions.length === 0 && <EmptyHint text="还没有势力数据。" />}
              <div className="atlas-grid3">
                {project.factions.map((f) => {
                  const members = project.characters.filter((c) => c.factionId === f.id);
                  return (
                    <div className="atlas-card" key={f.id}>
                      <h4>{f.name}<span className="atlas-tag">{f.type}</span></h4>
                      <p><b>首领：</b>{f.leaderId ? project.characters.find((c) => c.id === f.leaderId)?.name ?? '—' : '—'}</p>
                      {f.stance && <p><b>立场：</b>{f.stance}</p>}
                      {f.description && <p className="dim">{f.description}</p>}
                      {members.length > 0 && (
                        <p style={{ marginTop: 6 }}>
                          <b>成员（{members.length}）：</b>
                          {members.map((m) => `${m.name}（${m.role}）`).join('、')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 柒 情节脉络 */}
          <section className="glass-panel atlas-sec" id="atlas-plot">
            <SecHead num="柒" zh="情节脉络" en="PLOT" />
            <div className="atlas-sec-body">
              {events.length === 0 ? (
                <EmptyHint text="还没有事件数据。" />
              ) : (
                <div className="atlas-events">
                  {events.map((e) => {
                    const cause = e.causeIds.map(eventName);
                    const effect = e.effectIds.map(eventName);
                    return (
                      <button key={e.id} type="button" className="atlas-event"
                        onClick={() => openDetail('event', e.id)}>
                        <span className="atlas-event__idx">{e.sortIndex}</span>
                        <span className="atlas-event__main">
                          <b>{e.name}</b>
                          {e.timeLabel && <span className="dim">〔{e.timeLabel}〕</span>}
                          {e.importance >= 4 && <span className="atlas-tag">重要度 {e.importance}/5</span>}
                          <span className="atlas-event__desc">{e.description || '—'}</span>
                          {(cause.length > 0 || effect.length > 0) && (
                            <span className="dim atlas-event__chain">
                              {cause.length > 0 && <>前因：{cause.join('、')}</>}
                              {cause.length > 0 && effect.length > 0 && ' ｜ '}
                              {effect.length > 0 && <>后果：{effect.join('、')}</>}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 捌 一致性体检 */}
          <section className="glass-panel atlas-sec" id="atlas-audit">
            <SecHead num="捌" zh="一致性体检" en="AUDIT" />
            <div className="atlas-sec-body">
              <p className="dim" style={{ margin: '0 0 10px' }}>
                {issues.length === 0
                  ? '当前无一致性问题 —— 人物引用、别名、因果时序均通过校验。'
                  : `共 ${issues.length} 条提示；确需变更设定，请先在工作区 09-consistency.md 留痕再落笔。`}
              </p>
              <div className="issue-list">
                {issues.slice(0, 20).map((iss) => (
                  <button key={iss.key} type="button" className="issue-row"
                    onClick={() => iss.entityId && openDetail(iss.kind, iss.entityId)}>
                    <IconAlert size={13} />
                    <span><b className="dim">[{iss.type}]</b> {iss.message}</span>
                  </button>
                ))}
                {issues.length > 20 && <span className="dim">还有 {issues.length - 20} 条…</span>}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
