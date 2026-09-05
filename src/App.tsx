import { lazy, Suspense, useEffect } from 'react';
import { useProjectStore } from './store/projectStore';
import { useUIStore } from './store/uiStore';
import { AppLayout } from './layouts/AppLayout';
import { ToastHost, ConfirmHost } from './components/ui/Toast';
import { DashboardPage } from './features/dashboard/DashboardPage';

/* 路由级代码分割：首屏只打包总览页；其余页面（含 D3 图谱 / docx / jszip 等重库）
   按需加载 —— 启动只解析小包，大幅缩短首帧时间。 */
const WritingPage = lazy(() => import('./features/writing/WritingPage').then((m) => ({ default: m.WritingPage })));
const CharactersPage = lazy(() => import('./features/characters/CharactersPage').then((m) => ({ default: m.CharactersPage })));
const GraphPage = lazy(() => import('./features/graph/GraphPage').then((m) => ({ default: m.GraphPage })));
const EventsPage = lazy(() => import('./features/events/EventsPage').then((m) => ({ default: m.EventsPage })));
const TimelinePage = lazy(() => import('./features/timeline/TimelinePage').then((m) => ({ default: m.TimelinePage })));
const ItemsPage = lazy(() => import('./features/designers').then((m) => ({ default: m.ItemsPage })));
const LocationsPage = lazy(() => import('./features/designers').then((m) => ({ default: m.LocationsPage })));
const FactionsPage = lazy(() => import('./features/designers').then((m) => ({ default: m.FactionsPage })));
const ExportPage = lazy(() => import('./features/export/ExportPage').then((m) => ({ default: m.ExportPage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

/* 首帧渲染完成后，利用空闲时段预取全部分块：启动不被拖慢，页内切换也无加载感 */
function usePrefetchPages() {
  useEffect(() => {
    const prefetch = () => {
      void import('./features/writing/WritingPage');
      void import('./features/characters/CharactersPage');
      void import('./features/graph/GraphPage');
      void import('./features/events/EventsPage');
      void import('./features/timeline/TimelinePage');
      void import('./features/designers');
      void import('./features/export/ExportPage');
      void import('./features/settings/SettingsPage');
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetch);
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(prefetch, 1500);
    return () => window.clearTimeout(timer);
  }, []);
}

/** 页面切换时的加载占位（与启动画面同视觉语言） */
function PageFallback() {
  return (
    <div className="boot" style={{ minHeight: '60vh', justifyContent: 'center' }}>
      <span className="boot__mark" aria-hidden />
      <span className="boot__en">LOADING</span>
    </div>
  );
}

/** 应用壳：初始化存储 → hash 路由同步 → 页面分发。 */

export default function App() {
  const init = useProjectStore((s) => s.init);
  const initialized = useProjectStore((s) => s.initialized);
  const project = useProjectStore((s) => s.project);
  const page = useUIStore((s) => s.page);
  const syncFromHash = useUIStore((s) => s.syncFromHash);

  usePrefetchPages();

  useEffect(() => {
    void init();
    const onHash = () => syncFromHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!initialized || !project) {
    return (
      <div className="app-shell">
        <div className="app-panel app-panel--hud app-panel--loading">
          <div className="boot">
            <span className="boot__mark" aria-hidden />
            <b>墨枢</b>
            <span className="boot__en">NOVEL ATLAS</span>
            <span>正在载入作品数据…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppLayout>
        <Suspense fallback={<PageFallback />}>
          {page === 'dashboard' && <DashboardPage />}
          {page === 'writing' && <WritingPage />}
          {page === 'characters' && <CharactersPage />}
          {page === 'graph' && <GraphPage />}
          {page === 'events' && <EventsPage />}
          {page === 'timeline' && <TimelinePage />}
          {page === 'locations' && <LocationsPage />}
          {page === 'factions' && <FactionsPage />}
          {page === 'items' && <ItemsPage />}
          {page === 'export' && <ExportPage />}
          {page === 'settings' && <SettingsPage />}
        </Suspense>
      </AppLayout>
      <ToastHost />
      <ConfirmHost />
    </>
  );
}
