import { useState } from 'react';
import { TabBar } from './ui/TabBar.tsx';
import type { TabId } from './ui/TabBar.tsx';
import type { View } from './ui/nav.ts';
import {
  HomeScreen, LogScreen, CompeteScreen, ProgressScreen, MoreScreen
} from './ui/screens.tsx';
import { GunDetail } from './ui/GunDetail.tsx';
import { GunForm } from './ui/GunForm.tsx';
import { SessionDetail } from './ui/SessionDetail.tsx';
import { SessionForm } from './ui/SessionForm.tsx';

export function App() {
  const [tab, setTabState] = useState<TabId>('home');
  const [view, setView] = useState<View | null>(null);
  // Bump this to make every screen re-read the database after a save/import.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);
  const setTab = (t: TabId) => { setView(null); setTabState(t); };

  let content;
  if (view?.kind === 'gun-detail') {
    const v = view;
    content = <GunDetail id={v.id} refreshKey={refreshKey}
      onBack={() => setView(null)}
      onEdit={() => setView({ kind: 'gun-form', id: v.id })} />;
  } else if (view?.kind === 'gun-form') {
    const v = view;
    content = <GunForm id={v.id}
      onCancel={() => setView(v.id !== undefined ? { kind: 'gun-detail', id: v.id } : null)}
      onSaved={(gid) => { refresh(); setView({ kind: 'gun-detail', id: gid }); }} />;
  } else if (view?.kind === 'session-detail') {
    const v = view;
    content = <SessionDetail id={v.id} refreshKey={refreshKey}
      onBack={() => setView(null)}
      onEdit={() => setView({ kind: 'session-form', id: v.id })}
      onDeleted={() => { refresh(); setView(null); }} />;
  } else if (view?.kind === 'session-form') {
    const v = view;
    content = <SessionForm id={v.id}
      onCancel={() => setView(v.id !== undefined ? { kind: 'session-detail', id: v.id } : null)}
      onSaved={(sid) => { refresh(); setView({ kind: 'session-detail', id: sid }); }} />;
  } else if (tab === 'home') {
    content = <HomeScreen refreshKey={refreshKey} onImported={refresh} open={setView} />;
  } else if (tab === 'log') {
    content = <LogScreen refreshKey={refreshKey} open={setView} />;
  } else if (tab === 'compete') {
    content = <CompeteScreen />;
  } else if (tab === 'progress') {
    content = <ProgressScreen />;
  } else {
    content = <MoreScreen refreshKey={refreshKey} onImported={refresh} open={setView} />;
  }

  return (
    <>
      {content}
      <TabBar active={tab} onChange={setTab} />
    </>
  );
}
