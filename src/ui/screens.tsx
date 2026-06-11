// Tab screens. Home and Log are live against the database; Compete and
// Progress arrive in M5 and M7 and say so in plain language.
import { useEffect, useState } from 'react';
import type { Firearm, Match, Session } from '../lib/types.ts';
import { getAll } from '../lib/db.ts';
import { formatDayKey } from '../lib/dates.ts';
import { sessionRounds, totalRounds } from '../lib/stats.ts';
import { ImportFlow } from './ImportFlow.tsx';
import { SyncCard } from './SyncCard.tsx';
import type { View } from './nav.ts';

function useData(refreshKey: number) {
  const [firearms, setFirearms] = useState<Firearm[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [f, s, m] = await Promise.all([
        getAll<Firearm>('firearms'), getAll<Session>('sessions'), getAll<Match>('matches')
      ]);
      if (!alive) return;
      setFirearms(f);
      setSessions(s.sort((a, b) => b.date.localeCompare(a.date)));
      setMatches(m);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [refreshKey]);
  return { firearms, sessions, matches, loaded };
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
  const { firearms, sessions, matches, loaded } = useData(refreshKey);
  if (!loaded) return <div className="screen" />;

  const empty = firearms.length === 0 && sessions.length === 0;
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
          <div className="card" style={{ marginTop: 16 }}>
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
  const { firearms, sessions, loaded } = useData(refreshKey);
  if (!loaded) return <div className="screen" />;
  return (
    <div className="screen">
      <h1 className="large-title">Log</h1>
      <button className="button" onClick={() => open({ kind: 'session-form' })}>+ Log Session</button>
      {sessions.length === 0 ? (
        <p className="empty">Nothing logged yet. Tap "Log Session" after your next range trip, or import your Pistol Tracker data from the Home screen.</p>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
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

export function CompeteScreen() {
  return (
    <div className="screen">
      <h1 className="large-title">Compete</h1>
      <p className="empty">Match logging, classifiers, and your road from C to B land here in a later build.</p>
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
