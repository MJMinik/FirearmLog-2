import { useState } from 'react';
import { TabBar } from './ui/TabBar.tsx';
import type { TabId } from './ui/TabBar.tsx';
import {
  HomeScreen, LogScreen, CompeteScreen, ProgressScreen, MoreScreen
} from './ui/screens.tsx';

export function App() {
  const [tab, setTab] = useState<TabId>('home');
  // Bump this to make every screen re-read the database (e.g. after an import).
  const [refreshKey, setRefreshKey] = useState(0);
  const onImported = () => setRefreshKey((k) => k + 1);

  return (
    <>
      {tab === 'home' && <HomeScreen refreshKey={refreshKey} onImported={onImported} />}
      {tab === 'log' && <LogScreen refreshKey={refreshKey} />}
      {tab === 'compete' && <CompeteScreen />}
      {tab === 'progress' && <ProgressScreen />}
      {tab === 'more' && <MoreScreen refreshKey={refreshKey} onImported={onImported} />}
      <TabBar active={tab} onChange={setTab} />
    </>
  );
}
