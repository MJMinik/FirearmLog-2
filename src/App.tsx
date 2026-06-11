import { useState } from 'react';
import { TabBar } from './ui/TabBar.tsx';
import type { TabId } from './ui/TabBar.tsx';
import type { View } from './ui/nav.ts';
import {
  HomeScreen, LogScreen, ProgressScreen, MoreScreen
} from './ui/screens.tsx';
import { CompeteScreen, ClassifierForm } from './ui/CompeteScreen.tsx';
import { MatchDetail, MatchForm } from './ui/MatchScreens.tsx';
import { GunDetail } from './ui/GunDetail.tsx';
import { GunForm } from './ui/GunForm.tsx';
import { SessionDetail } from './ui/SessionDetail.tsx';
import { SessionForm } from './ui/SessionForm.tsx';
import { DrillsScreen, DrillForm } from './ui/DrillsScreen.tsx';
import { MagazinesScreen, MagazineForm } from './ui/MagazinesScreen.tsx';
import { ReferenceList, ReferenceDetail, ReferenceForm } from './ui/ReferenceScreens.tsx';
import { MaintenanceOverview, MaintenanceForm } from './ui/MaintenanceScreens.tsx';

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
      onEdit={() => setView({ kind: 'gun-form', id: v.id })}
      onLogMaintenance={() => setView({ kind: 'maint-form', gunId: v.id })}
      onOpenReference={(rid) => setView({ kind: 'reference-detail', id: rid })} />;
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
  } else if (view?.kind === 'drills') {
    content = <DrillsScreen refreshKey={refreshKey}
      onBack={() => setView(null)}
      openForm={(did) => setView({ kind: 'drill-form', id: did })} />;
  } else if (view?.kind === 'drill-form') {
    const v = view;
    content = <DrillForm id={v.id}
      onCancel={() => setView({ kind: 'drills' })}
      onSaved={() => { refresh(); setView({ kind: 'drills' }); }} />;
  } else if (view?.kind === 'magazines') {
    content = <MagazinesScreen refreshKey={refreshKey}
      onBack={() => setView(null)}
      openForm={(mid) => setView({ kind: 'magazine-form', id: mid })} />;
  } else if (view?.kind === 'magazine-form') {
    const v = view;
    content = <MagazineForm id={v.id}
      onCancel={() => setView({ kind: 'magazines' })}
      onSaved={() => { refresh(); setView({ kind: 'magazines' }); }} />;
  } else if (view?.kind === 'references') {
    content = <ReferenceList refreshKey={refreshKey}
      onBack={() => setView(null)}
      openDetail={(rid) => setView({ kind: 'reference-detail', id: rid })}
      openForm={() => setView({ kind: 'reference-form' })} />;
  } else if (view?.kind === 'reference-detail') {
    const v = view;
    content = <ReferenceDetail id={v.id} refreshKey={refreshKey}
      onBack={() => setView({ kind: 'references' })}
      onEdit={() => setView({ kind: 'reference-form', id: v.id })}
      onCopy={() => setView({ kind: 'reference-form', copyFrom: v.id })}
      onDeleted={() => { refresh(); setView({ kind: 'references' }); }} />;
  } else if (view?.kind === 'reference-form') {
    const v = view;
    content = <ReferenceForm id={v.id} copyFrom={v.copyFrom}
      onCancel={() => setView(v.id !== undefined ? { kind: 'reference-detail', id: v.id } : { kind: 'references' })}
      onSaved={(rid) => { refresh(); setView({ kind: 'reference-detail', id: rid }); }} />;
  } else if (view?.kind === 'maintenance') {
    content = <MaintenanceOverview refreshKey={refreshKey}
      onBack={() => setView(null)}
      openGun={(gid) => setView({ kind: 'gun-detail', id: gid })}
      logFor={(gid) => setView({ kind: 'maint-form', gunId: gid })} />;
  } else if (view?.kind === 'maint-form') {
    const v = view;
    content = <MaintenanceForm gunId={v.gunId}
      onCancel={() => setView({ kind: 'gun-detail', id: v.gunId })}
      onSaved={() => { refresh(); setView({ kind: 'gun-detail', id: v.gunId }); }} />;
  } else if (view?.kind === 'match-detail') {
    const v = view;
    content = <MatchDetail id={v.id} refreshKey={refreshKey}
      onBack={() => setView(null)}
      onEdit={() => setView({ kind: 'match-form', id: v.id })}
      onDeleted={() => { refresh(); setView(null); }} />;
  } else if (view?.kind === 'match-form') {
    const v = view;
    content = <MatchForm id={v.id}
      onCancel={() => setView(v.id !== undefined ? { kind: 'match-detail', id: v.id } : null)}
      onSaved={(mid) => { refresh(); setView({ kind: 'match-detail', id: mid }); }} />;
  } else if (view?.kind === 'classifier-form') {
    const v = view;
    content = <ClassifierForm id={v.id}
      onCancel={() => setView(null)}
      onSaved={() => { refresh(); setView(null); }} />;
  } else if (tab === 'home') {
    content = <HomeScreen refreshKey={refreshKey} onImported={refresh} open={setView} />;
  } else if (tab === 'log') {
    content = <LogScreen refreshKey={refreshKey} open={setView} />;
  } else if (tab === 'compete') {
    content = <CompeteScreen refreshKey={refreshKey} open={setView} />;
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
