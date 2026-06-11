// M1 screens. Home and Log are live against the database; Compete and
// Progress arrive in M5 and M7 and say so in plain language.
import { useEffect, useState } from 'react';
import type { Firearm, Session } from '../lib/types.ts';
import { getAll } from '../lib/db.ts';
import { formatDayKey } from '../lib/dates.ts';
import { ImportFlow } from './ImportFlow.tsx';

function useData(refreshKey: number) {
  const [firearms, setFirearms] = useState<Firearm[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [f, s] = await Promise.all([getAll<Firearm>('firearms'), getAll<Session>('sessions')]);
      if (!alive) return;
      setFirearms(f);
      setSessions(s.sort((a, b) => b.date.localeCompare(a.date)));
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [refreshKey]);
  return { firearms, sessions, loaded };
}

function lifetimeRounds(firearms: Firearm[], sessions: Session[]): number {
  let total = firearms.reduce((sum, f) => sum + (f.startingRoundCount || 0), 0);
  for (const s of sessions) {
    if (s.planned) continue;
    for (const g of s.guns) total += g.rounds;
  }
  return total;
}

export function HomeScreen({ refreshKey, onImported }: { refreshKey: number; onImported: () => void }) {
  const { firearms, sessions, loaded } = useData(refreshKey);
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
          <div className="stat-grid">
            <div className="stat">
              <div className="num">{firearms.length}</div>
              <div className="cap">Guns</div>
            </div>
            <div className="stat">
              <div className="num">{sessions.filter((s) => !s.planned).length}</div>
              <div className="cap">Sessions</div>
            </div>
            <div className="stat">
              <div className="num">{lifetimeRounds(firearms, sessions).toLocaleString()}</div>
              <div className="cap">Lifetime rounds</div>
            </div>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Recent Sessions</h2>
            {sessions.slice(0, 5).map((s) => (
              <SessionRow key={s.id} s={s} firearms={firearms} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SessionRow({ s, firearms }: { s: Session; firearms: Firearm[] }) {
  const names = s.guns
    .map((g) => firearms.find((f) => f.id === g.firearmId)?.name ?? '—')
    .join(', ');
  const rounds = s.guns.reduce((sum, g) => sum + g.rounds, 0);
  return (
    <div className="row">
      <span className="label">
        {formatDayKey(s.date)}
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{names}{s.location ? ` · ${s.location}` : ''}</div>
      </span>
      <span className="value">{rounds.toLocaleString()} rds</span>
    </div>
  );
}

export function LogScreen({ refreshKey }: { refreshKey: number }) {
  const { firearms, sessions, loaded } = useData(refreshKey);
  if (!loaded) return <div className="screen" />;
  return (
    <div className="screen">
      <h1 className="large-title">Log</h1>
      {sessions.length === 0 ? (
        <p className="empty">Nothing logged yet. Import your Pistol Tracker data from the Home screen, or hang tight — logging new sessions arrives in the next build.</p>
      ) : (
        <div className="card">
          <h2>All Sessions</h2>
          {sessions.map((s) => (
            <SessionRow key={s.id} s={s} firearms={firearms} />
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

export function MoreScreen({ refreshKey, onImported }: { refreshKey: number; onImported: () => void }) {
  const { firearms, loaded } = useData(refreshKey);
  if (!loaded) return <div className="screen" />;
  return (
    <div className="screen">
      <h1 className="large-title">More</h1>
      {firearms.length > 0 && (
        <div className="card">
          <h2>Guns</h2>
          {firearms.map((f) => (
            <div className="row" key={f.id}>
              <span className="label">{f.name}</span>
              <span className="value">{f.category} · {f.caliber}</span>
            </div>
          ))}
        </div>
      )}
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
