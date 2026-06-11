// Tab screens. Home and Log are live against the database; Compete and
// Progress arrive in M5 and M7 and say so in plain language.
import { useEffect, useState } from 'react';
import type { Ammunition, Firearm, MaintenanceEntry, Match, Reference, Session } from '../lib/types.ts';
import { getAll } from '../lib/db.ts';
import { maintenanceAlerts } from '../lib/maintenance.ts';
import { lowAmmo } from '../lib/costing.ts';
import { ammoLabel } from './AmmoScreens.tsx';
import { buildRefLookup } from '../lib/referenceData.ts';
import { formatDayKey } from '../lib/dates.ts';
import { sessionRounds, totalRounds } from '../lib/stats.ts';
import { ImportFlow } from './ImportFlow.tsx';
import { SyncCard } from './SyncCard.tsx';
import { MonthCalendar } from './Calendar.tsx';
import type { CalItem } from './Calendar.tsx';
import type { View } from './nav.ts';

function useData(refreshKey: number) {
  const [firearms, setFirearms] = useState<Firearm[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceEntry[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [ammo, setAmmo] = useState<Ammunition[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [f, s, m, mt, r, am] = await Promise.all([
        getAll<Firearm>('firearms'), getAll<Session>('sessions'),
        getAll<Match>('matches'), getAll<MaintenanceEntry>('maintenance'),
        getAll<Reference>('references'), getAll<Ammunition>('ammunition')
      ]);
      if (!alive) return;
      setFirearms(f);
      setSessions(s.sort((a, b) => b.date.localeCompare(a.date)));
      setMatches(m);
      setMaintenance(mt);
      setReferences(r);
      setAmmo(am);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [refreshKey]);
  return { firearms, sessions, matches, maintenance, references, ammo, loaded };
}

function SessionRow({ s, firearms, onTap }: { s: Session; firearms: Firearm[]; onTap: () => void }) {
  const names = s.guns
    .map((g) => firearms.find((f) => f.id === g.firearmId)?.name ?? '—')
    .join(', ');
  return (
    <button className="row-tap" onClick={onTap}>
      <span className="label">
        {formatDayKey(s.date)}
        <div className="row-sub">{names}{s.location ? ` · ${s.location}` : ''}</div>
      </span>
      <span className="value">{sessionRounds(s).toLocaleString()} rds</span>
    </button>
  );
}

export function HomeScreen({ refreshKey, onImported, open }: {
  refreshKey: number; onImported: () => void; open: (v: View) => void;
}) {
  const { firearms, sessions, matches, maintenance, references, ammo, loaded } = useData(refreshKey);
  if (!loaded) return <div className="screen" />;

  const empty = firearms.length === 0 && sessions.length === 0;
  const alerts = maintenanceAlerts(firearms, buildRefLookup(references), sessions, maintenance, new Date());
  const lowCans = lowAmmo(ammo);
  return (
    <div className="screen">
      <h1 className="large-title">FirearmLog</h1>
      {empty ? (
        <>
          <p className="empty">Welcome. Let's get your range history in here.</p>
          <ImportFlow onImported={onImported} />
        </>
      ) : (
        <>
          <button className="button" onClick={() => open({ kind: 'session-form' })}>+ Log Session</button>
          <div className="stat-grid" style={{ marginTop: 16 }}>
            <div className="stat">
              <div className="num">{firearms.length}</div>
              <div className="cap">Guns</div>
            </div>
            <div className="stat">
              <div className="num">{sessions.filter((s) => !s.planned).length}</div>
              <div className="cap">Sessions</div>
            </div>
            <div className="stat">
              <div className="num">{totalRounds(firearms, sessions, matches).toLocaleString()}</div>
              <div className="cap">Lifetime rounds</div>
            </div>
          </div>
          {(alerts.length > 0 || lowCans.length > 0) && (
            <div className="card" style={{ marginTop: 16 }}>
              <h2>Needs Attention</h2>
              {alerts.map((a, i) => (
                <button className="row-tap" key={i}
                  onClick={() => open({ kind: 'gun-detail', id: a.firearmId })}>
                  <span className="label">
                    {a.gunName}: {a.item.label.toLowerCase()}
                    <div className="row-sub">{a.item.detail}</div>
                  </span>
                  <span className={`badge ${a.item.level === 'due' ? 'bad' : 'warn-badge'}`}>
                    {a.item.level === 'due' ? 'Due' : 'Soon'}
                  </span>
                </button>
              ))}
              {lowCans.map((a) => (
                <button className="row-tap" key={a.id} onClick={() => open({ kind: 'ammo' })}>
                  <span className="label">
                    Low ammo: {ammoLabel(a)}
                    <div className="row-sub">{(a.quantity || 0).toLocaleString()} rounds left</div>
                  </span>
                  <span className="badge warn-badge">Low</span>
                </button>
              ))}
            </div>
          )}
          <div className="card" style={{ marginTop: alerts.length > 0 || lowCans.length > 0 ? 0 : 16 }}>
            <h2>Recent Sessions</h2>
            {sessions.slice(0, 5).map((s) => (
              <SessionRow key={s.id} s={s} firearms={firearms}
                onTap={() => open({ kind: 'session-detail', id: s.id })} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function LogScreen({ refreshKey, open }: { refreshKey: number; open: (v: View) => void }) {
  const { firearms, sessions, matches, loaded } = useData(refreshKey);
  const [mode, setMode] = useState<'list' | 'calendar'>('list');
  if (!loaded) return <div className="screen" />;

  const calItems = new Map<string, CalItem[]>();
  for (const s of sessions) {
    if (!s.date) continue;
    const names = s.guns.map((g) => firearms.find((f) => f.id === g.firearmId)?.name ?? '—').join(', ');
    const list = calItems.get(s.date) ?? [];
    list.push({ kind: 'session', id: s.id, label: `Session — ${names}`, sub: `${sessionRounds(s).toLocaleString()} rounds` });
    calItems.set(s.date, list);
  }
  for (const m of matches) {
    if (!m.date) continue;
    const list = calItems.get(m.date) ?? [];
    list.push({ kind: 'match', id: m.id, label: m.name || 'Match', sub: `${m.matchType ?? 'Match'} · ${m.division ?? ''}` });
    calItems.set(m.date, list);
  }

  return (
    <div className="screen">
      <h1 className="large-title">Log</h1>
      <button className="button" onClick={() => open({ kind: 'session-form' })}>+ Log Session</button>
      <div className="seg" role="radiogroup" aria-label="View" style={{ marginTop: 12 }}>
        <button role="radio" aria-checked={mode === 'list'} className={mode === 'list' ? 'on' : ''}
          onClick={() => setMode('list')}>List</button>
        <button role="radio" aria-checked={mode === 'calendar'} className={mode === 'calendar' ? 'on' : ''}
          onClick={() => setMode('calendar')}>Calendar</button>
      </div>
      {mode === 'calendar' ? (
        <MonthCalendar items={calItems}
          onOpen={(it) => open(it.kind === 'session'
            ? { kind: 'session-detail', id: it.id }
            : { kind: 'match-detail', id: it.id })} />
      ) : sessions.length === 0 ? (
        <p className="empty">Nothing logged yet. Tap "Log Session" after your next range trip, or import your Pistol Tracker data from the Home screen.</p>
      ) : (
        <div className="card">
          <h2>All Sessions</h2>
          {sessions.map((s) => (
            <SessionRow key={s.id} s={s} firearms={firearms}
              onTap={() => open({ kind: 'session-detail', id: s.id })} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProgressScreen() {
  return (
    <div className="screen">
      <h1 className="large-title">Progress</h1>
      <p className="empty">Trends, personal records, and goals land here in a later build.</p>
    </div>
  );
}

export function MoreScreen({ refreshKey, onImported, open }: {
  refreshKey: number; onImported: () => void; open: (v: View) => void;
}) {
  const { firearms, loaded } = useData(refreshKey);
  if (!loaded) return <div className="screen" />;
  return (
    <div className="screen">
      <h1 className="large-title">More</h1>
      <div className="card">
        <h2>Guns</h2>
        {firearms.map((f) => (
          <button className="row-tap" key={f.id} onClick={() => open({ kind: 'gun-detail', id: f.id })}>
            <span className="label">{f.name}</span>
            <span className="value">{f.category} · {f.caliber} ›</span>
          </button>
        ))}
        <div style={{ marginTop: 10 }}>
          <button className="button secondary" onClick={() => open({ kind: 'gun-form' })}>+ Add Gun</button>
        </div>
      </div>
      <div className="card">
        <h2>Gear &amp; Library</h2>
        <button className="row-tap" onClick={() => open({ kind: 'drills' })}>
          <span className="label">Drills</span>
          <span className="value">›</span>
        </button>
        <button className="row-tap" onClick={() => open({ kind: 'magazines' })}>
          <span className="label">Magazines</span>
          <span className="value">›</span>
        </button>
        <button className="row-tap" onClick={() => open({ kind: 'ammo' })}>
          <span className="label">Ammo</span>
          <span className="value">›</span>
        </button>
        <button className="row-tap" onClick={() => open({ kind: 'costs' })}>
          <span className="label">Costs &amp; Purchases</span>
          <span className="value">›</span>
        </button>
        <button className="row-tap" onClick={() => open({ kind: 'maintenance' })}>
          <span className="label">Maintenance</span>
          <span className="value">›</span>
        </button>
        <button className="row-tap" onClick={() => open({ kind: 'references' })}>
          <span className="label">Reference</span>
          <span className="value">›</span>
        </button>
      </div>
      <SyncCard onPulled={onImported} />
      <div className="card">
        <h2>Settings &amp; Data</h2>
        <p className="report-note" style={{ marginBottom: 12 }}>
          Import your Pistol Tracker backup here. Running it again simply re-applies the same
          records — it won't double anything up.
        </p>
        <ImportFlow onImported={onImported} />
      </div>
    </div>
  );
}
