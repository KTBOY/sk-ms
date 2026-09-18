import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { EntityKind } from '../core/types';
import { auditProject } from '../core/consistency';
import { entitiesOfKind, KIND_LABELS } from '../core/collections';
import { useProjectStore } from '../store/projectStore';
import { useUIStore, PAGE_TITLES } from '../store/uiStore';
import type { Page } from '../store/uiStore';
import { Input, StatusPill } from '../components/ui/primitives';
import { CharacterAvatar } from '../components/ui/Avatar';
import { getDesktopBridge } from '../core/desktop';
import { WindowControls } from '../components/layout/WindowControls';
import {
  IconBook, IconChevronDown, IconDashboard, IconDoc, IconEvent, IconExport, IconFaction, IconGraph, IconItem, IconLocation,
  IconSearch, IconSettings, IconTimeline, IconUsers, IconWriting, IconX,
} from '../components/icons';

const NAV: Array<{ page: Page; icon: (p: { size?: number }) => ReactNode; title: string }> = [
  { page: 'dashboard', icon: IconDashboard, title: '总览' },
  { page: 'writing', icon: IconWriting, title: '写作台' },
  { page: 'characters', icon: IconUsers, title: '人物' },
  { page: 'graph', icon: IconGraph, title: '图谱' },
  { page: 'events', icon: IconEvent, title: '事件' },
  { page: 'timeline', icon: IconTimeline, title: '时间线' },
  { page: 'locations', icon: IconLocation, title: '地点' },
  { page: 'factions', icon: IconFaction, title: '势力' },
  { page: 'items', icon: IconItem, title: '物品' },
  { page: 'atlas', icon: IconBook, title: '设定集' },
  { page: 'docs', icon: IconDoc, title: '文档' },
  { page: 'export', icon: IconExport, title: '导出' },
  { page: 'settings', icon: IconSettings, title: '设置' },
];

/** 全局框架：Resonance HUD 深色金调面板（菱形双语 Logo ｜ 方格图标导航 ｜ 搜索 + 头像）。 */
export function AppLayout({ children }: { children: ReactNode }) {
  const project = useProjectStore((s) => s.project);
  const projects = useProjectStore((s) => s.projects);
  const saveState = useProjectStore((s) => s.saveState);
  const refreshProjects = useProjectStore((s) => s.refreshProjects);
  const switchProject = useProjectStore((s) => s.switchProject);
  const page = useUIStore((s) => s.page);
  const navigate = useUIStore((s) => s.navigate);
  const openDetail = useUIStore((s) => s.openDetail);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [projOpen, setProjOpen] = useState(false);
  const projRef = useRef<HTMLDivElement>(null);

  const issueCount = useMemo(() => (project ? auditProject(project).length : 0), [project]);

  const results = useMemo(() => {
    if (!project || !query.trim()) return [];
    const q = query.trim();
    return (['character', 'event', 'item', 'location', 'faction'] as EntityKind[])
      .flatMap((kind) => entitiesOfKind(project, kind).map((e) => ({ kind, e })))
      .filter(({ e }) => e.name.includes(q) || e.aliases.some((a) => a.includes(q)))
      .slice(0, 8);
  }, [project, query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
      if (!projRef.current?.contains(e.target as Node)) setProjOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  // 头像：优先主角形象，其次作品封面字
  const hero = project?.characters.find((c) => c.role === '主角');

  // 桌面端（Electron）才有的无边框窗口控制；浏览器为 null
  const desktop = getDesktopBridge();

  return (
    <div className="app-shell">
      <div className="app-panel app-panel--hud">
        <header className="app-topbar">
          <button type="button" className="app-logo" onClick={() => navigate('dashboard')} aria-label="墨枢 NovelAtlas">
            <span className="app-logo__mark" aria-hidden />
            <span className="app-logo__text">
              <b>墨枢</b>
              <i>NOVEL ATLAS</i>
            </span>
          </button>

          {/* 全局作品切换器：写作台 / 导出中心等任何页面都可一键换书 */}
          <div className="proj-switch" ref={projRef}>
            <button type="button" className="proj-switch__btn" title="切换作品"
              onClick={() => {
                if (!projOpen) void refreshProjects();
                setProjOpen(!projOpen);
              }}>
              <IconBook size={13} />
              <span className="proj-switch__name">《{project?.name ?? '…'}》</span>
              <IconChevronDown size={12} />
            </button>
            {projOpen && (
              <div className="proj-switch__pop">
                <div className="proj-switch__label">作品库 · {projects.length}</div>
                {projects.map((p) => (
                  <button key={p.id} type="button"
                    className={`proj-switch__item ${p.id === project?.id ? 'is-current' : ''}`}
                    onClick={() => {
                      setProjOpen(false);
                      if (p.id !== project?.id) void switchProject(p.id);
                    }}>
                    <b>{p.id === project?.id ? '● ' : ''}{p.name}</b>
                    <span className="dim">{p.genre || '未设类型'} · 更新于 {new Date(p.updatedAt).toLocaleDateString('zh-CN')}</span>
                  </button>
                ))}
                <button type="button" className="proj-switch__item"
                  onClick={() => { setProjOpen(false); navigate('settings'); }}>
                  <b>＋ 新建 / 管理作品…</b>
                  <span className="dim">前往「设置 → 作品管理」</span>
                </button>
              </div>
            )}
          </div>

          <nav className="app-nav" aria-label="主导航">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <button key={n.page} type="button" title={n.title}
                  className={`app-nav__btn ${page === n.page ? 'is-active' : ''}`}
                  aria-label={n.title}
                  onClick={() => navigate(n.page)}>
                  <Icon size={19} />
                </button>
              );
            })}
          </nav>

          <div className="app-topbar__right">
            <div className="app-search" ref={searchRef}>
              <IconSearch size={15} />
              <Input value={query} placeholder="搜索人物 / 事件 / 物品…"
                onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)} />
              {query && <button type="button" aria-label="清空" onClick={() => setQuery('')}><IconX size={13} /></button>}
              {searchOpen && results.length > 0 && (
                <ul className="app-search__pop">
                  {results.map(({ kind, e }) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => { openDetail(kind, e.id); setSearchOpen(false); setQuery(''); }}>
                        <b>{e.name}</b>
                        <span className="dim">{KIND_LABELS[kind]}{e.aliases.length ? ` · ${e.aliases[0]}` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="button" className="app-avatar" title={issueCount > 0 ? `${issueCount} 项一致性提示待处理` : '当前作品'}
              onClick={() => navigate(issueCount > 0 ? 'writing' : 'settings')}>
              {hero
                ? <CharacterAvatar character={hero} size={42} />
                : <span className="app-avatar__fallback">{project?.name.slice(0, 1) ?? '书'}</span>}
              {issueCount > 0 && <i>{issueCount > 9 ? '9+' : issueCount}</i>}
            </button>
            {desktop && <WindowControls bridge={desktop} />}
          </div>
        </header>
        <main className="app-content hud-scope">{children}</main>
        <footer className="app-foot">
          <span>{PAGE_TITLES[page]} · 《{project?.name ?? '…'}》</span>
          <span className="app-foot__right">
            <StatusPill state={saveState} />
            <em>{desktop ? '数据存储于本机文件' : '数据存储于浏览器'} · 墨枢 NovelAtlas v1.1</em>
          </span>
        </footer>
      </div>
    </div>
  );
}
