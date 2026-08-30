import { useEffect } from 'react';
import { useProjectStore } from './store/projectStore';
import { useUIStore } from './store/uiStore';
import { AppLayout } from './layouts/AppLayout';
import { ToastHost, ConfirmHost } from './components/ui/Toast';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { WritingPage } from './features/writing/WritingPage';
import { CharactersPage } from './features/characters/CharactersPage';
import { GraphPage } from './features/graph/GraphPage';
import { EventsPage } from './features/events/EventsPage';
import { TimelinePage } from './features/timeline/TimelinePage';
import { ItemsPage, LocationsPage, FactionsPage } from './features/designers';
import { ExportPage } from './features/export/ExportPage';
import { SettingsPage } from './features/settings/SettingsPage';

/** 应用壳：初始化存储 → hash 路由同步 → 页面分发。 */

export default function App() {
  const init = useProjectStore((s) => s.init);
  const initialized = useProjectStore((s) => s.initialized);
  const project = useProjectStore((s) => s.project);
  const page = useUIStore((s) => s.page);
  const syncFromHash = useUIStore((s) => s.syncFromHash);

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
      </AppLayout>
      <ToastHost />
      <ConfirmHost />
    </>
  );
}
