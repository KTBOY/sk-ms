import { useMemo, useState } from 'react';
import type { Chapter, CharacterAttributes } from '../../core/types';
import { auditProject } from '../../core/consistency';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { RadarChart } from '../../components/ui/RadarChart';
import { CharacterAvatar } from '../../components/ui/Avatar';
import { Select } from '../../components/ui/primitives';
import { IconEvent, IconFaction, IconUsers } from '../../components/icons';

/**
 * 总览 —— 1:1 复刻参考数据大屏构图：
 * 左侧人物立绘（上溢出）＋中央幽灵数字雷达＋环绕属性大字 ＋ 右侧大名字/三卡行/2×2信息格
 * 底部：事件统计表（行卡）＋ 章节记分卡（W/L 徽标）
 */

const ATTR_LABELS: Array<{ key: keyof CharacterAttributes; label: string; pos: string }> = [
  { key: 'power', label: '力量', pos: 'power' },
  { key: 'wisdom', label: '智谋', pos: 'wisdom' },
  { key: 'charm', label: '魅力', pos: 'charm' },
  { key: 'will', label: '意志', pos: 'will' },
  { key: 'fortune', label: '机缘', pos: 'fortune' },
];

type EvSort = 'time' | 'importance';
type ChTab = '最新' | '草稿' | '写作中' | '已完成';

const fmtNum = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)} 万` : n.toLocaleString());

export function DashboardPage() {
  const project = useProjectStore((s) => s.project);
  const openDetail = useUIStore((s) => s.openDetail);
  const navigate = useUIStore((s) => s.navigate);
  const [evSort, setEvSort] = useState<EvSort>('time');
  const [chTab, setChTab] = useState<ChTab>('最新');

  const data = useMemo(() => {
    if (!project) return null;
    const issues = auditProject(project);
    const words = project.chapters.reduce((acc, c) => acc + c.content.replace(/\s/g, '').length, 0);
    const hero =
      project.characters.find((c) => c.role === '主角') ??
      [...project.characters].sort((a, b) =>
        project.relations.filter((r) => r.toId === b.id || r.fromId === b.id).length -
        project.relations.filter((r) => r.toId === a.id || r.fromId === a.id).length)[0];
    const relCount = hero ? project.relations.filter((r) => r.fromId === hero.id || r.toId === hero.id).length : 0;
    const evCount = hero ? project.events.filter((e) => e.participantIds.includes(hero.id)).length : 0;
    const ghost = hero
      ? Math.round((hero.attributes.power + hero.attributes.wisdom + hero.attributes.charm + hero.attributes.will + hero.attributes.fortune) / 5)
      : 0;
    return { issues, words, hero, relCount, evCount, ghost };
  }, [project]);

  if (!project || !data) return null;

  const events = [...project.events]
    .sort((a, b) => (evSort === 'time' ? b.sortIndex - a.sortIndex : b.importance - a.importance))
    .slice(0, 5);
  const charOf = (id: string) => project.characters.find((c) => c.id === id);
  const locName = (id: string | null) => (id ? project.locations.find((l) => l.id === id)?.name : undefined);

  const chapters: Chapter[] = (() => {
    const sorted = [...project.chapters].sort((a, b) => b.order - a.order);
    if (chTab === '最新') return sorted.slice(0, 3);
    return sorted.filter((c) => c.status === chTab).slice(0, 3);
  })();
  const tabs: ChTab[] = ['最新', '草稿', '写作中', '已完成'];
  const statusBadge = (c: Chapter) =>
    c.status === '已完成'
      ? { cls: 'score-badge--win', text: '完成' }
      : c.status === '写作中'
        ? { cls: 'score-badge--live', text: '写作' }
        : { cls: 'score-badge--draft', text: '草稿' };

  const faction = data.hero ? project.factions.find((f) => f.id === data.hero!.factionId) : undefined;

  return (
    <div className="page dash2">
      {/* ============ 英雄区 ============ */}
      <section className="hero2">
        {/* 左：人物立绘（上溢出） */}
        <div className="hero2__cutout">
          {data.hero ? (
            <button type="button" className="hero2__portrait" title="点击查看人物档案"
              onClick={() => openDetail('character', data.hero!.id)}>
              <CharacterAvatar character={data.hero} size={300} />
            </button>
          ) : (
            <button type="button" className="hero2__portrait hero2__portrait--empty" onClick={() => navigate('characters')}>
              <IconUsers size={72} />
              <span>创建你的主角</span>
            </button>
          )}
        </div>

        {/* 中：幽灵数字 + 雷达 + 环绕属性 */}
        <div className="hero2__radar">
          <div className="hero2__ghost">{data.ghost}</div>
          <RadarChart values={data.hero ? data.hero.attributes : { power: 0, wisdom: 0, charm: 0, will: 0, fortune: 0 }} size={280} labels={false} accent="gold" />
          {ATTR_LABELS.map((a) => (
            <div key={a.key} className={`hero2__attr hero2__attr--${a.pos}`}>
              <span>{a.label}</span>
              <b>{data.hero ? data.hero.attributes[a.key] : 0}</b>
            </div>
          ))}
        </div>

        {/* 右：大名 + 势力徽章 + 三卡行 + 2×2 */}
        <div className="hero2__info">
          <h1>{data.hero ? data.hero.name : project.name}</h1>
          <button type="button" className="hero2__team" onClick={() => (faction ? openDetail('faction', faction.id) : navigate('factions'))}>
            <i><IconFaction size={15} /></i>
            <span>{faction ? faction.name : '无势力'}</span>
            {data.hero && <em>{data.hero.role}</em>}
          </button>

          <div className="hero2__cards3">
            <button type="button" className="h3card h3card--accent" onClick={() => navigate('characters')}>
              <IconUsers size={20} />
              <span>人物关系</span>
              <b>{data.relCount}</b>
            </button>
            <button type="button" className="h3card" onClick={() => navigate('timeline')}>
              <IconEvent size={20} />
              <span>参与事件</span>
              <b>{data.evCount}</b>
            </button>
            <button type="button" className="h3card h3card--bright" onClick={() => navigate('writing')}>
              <span>图谱健康</span>
              <b>{Math.max(60, 100 - data.issues.length * 4)}<small>%</small></b>
            </button>
          </div>

          <div className="hero2__grid4">
            <button type="button" className="g4card" onClick={() => navigate('export')}>
              <span>总字数</span>
              <b>{fmtNum(data.words)}</b>
            </button>
            <button type="button" className="g4card" onClick={() => navigate('writing')}>
              <span>章节</span>
              <b>{project.chapters.length}</b>
            </button>
            <button type="button" className="g4card" onClick={() => navigate('characters')}>
              <span>人物</span>
              <b>{project.characters.length}</b>
            </button>
            <button type="button" className="g4card" onClick={() => navigate('events')}>
              <span>事件</span>
              <b>{project.events.length}</b>
            </button>
          </div>

          {data.issues.length > 0 && (
            <button type="button" className="hero2__alert" onClick={() => navigate('writing')}>
              <i>{data.issues.length}</i>
              <span>项一致性提示待处理 →</span>
            </button>
          )}
        </div>
      </section>

      {/* ============ 底部两栏 ============ */}
      <div className="dash2__cols">
        {/* 事件统计表 */}
        <section className="glass-panel">
          <header className="glass-panel__head">
            <h3>事件统计<span className="head-en">EVENT LOG</span></h3>
            <Select className="dash2-select" value={evSort} onChange={(e) => setEvSort(e.target.value as EvSort)}>
              <option value="time">按时间 ↓</option>
              <option value="importance">按重要度 ↓</option>
            </Select>
          </header>
          <div className="ev2">
            <div className="ev2__row ev2__row--head">
              <span>时间</span><span>事件</span><span>地点</span><span>参与人物</span><span>重要度</span><span>序号</span>
            </div>
            {events.map((e) => (
              <button key={e.id} type="button" className="ev2__row" onClick={() => openDetail('event', e.id)}>
                <span className="dim">{e.timeLabel || `第${e.sortIndex}事`}</span>
                <span className="ev2__name">{e.name}</span>
                <span className="dim">{locName(e.locationId) ?? '—'}</span>
                <span className="ev2__who">
                  {e.participantIds.slice(0, 3).map((pid) => {
                    const c = charOf(pid);
                    return c ? <CharacterAvatar key={pid} character={c} size={24} /> : null;
                  })}
                  {e.participantIds.length > 3 && <em>+{e.participantIds.length - 3}</em>}
                </span>
                <span className="ev2__stars">{'★'.repeat(e.importance)}</span>
                <span className="ev2__idx">{e.sortIndex}</span>
              </button>
            ))}
            {events.length === 0 && <p className="dim" style={{ padding: 16 }}>暂无事件，去事件设计器创建</p>}
          </div>
        </section>

        {/* 章节记分卡 */}
        <section className="glass-panel">
          <header className="glass-panel__head">
            <h3>章节进度<span className="head-en">CHAPTERS</span></h3>
            <div className="score-tabs">
              {tabs.map((t, i) => (
                <button key={t} type="button" className={`score-tab ${chTab === t ? 'is-active' : ''}`}
                  onClick={() => setChTab(t)}>
                  {t === '最新' && <i className="score-tab__dot" />}
                  {t}
                  {i < tabs.length - 1 && <em className="score-tab__sep">·</em>}
                </button>
              ))}
            </div>
          </header>
          <div className="score-list">
            {chapters.map((c) => {
              const badge = statusBadge(c);
              return (
                <button key={c.id} type="button" className="score-card" onClick={() => navigate('writing')}>
                  <span className="score-card__no">{c.order}</span>
                  <span className="score-card__title">{c.title}</span>
                  <span className="score-card__num">{c.content.replace(/\s/g, '').length}<small>字</small></span>
                  <span className={`score-badge ${badge.cls}`}>{badge.text}</span>
                  <span className="score-card__date">{new Date(c.updatedAt).toLocaleDateString('zh-CN')}</span>
                </button>
              );
            })}
            {chapters.length === 0 && <p className="dim" style={{ padding: 16 }}>该状态下暂无章节</p>}
            <button type="button" className="score-more" onClick={() => navigate('writing')}>进入写作台 →</button>
          </div>
        </section>
      </div>
    </div>
  );
}
