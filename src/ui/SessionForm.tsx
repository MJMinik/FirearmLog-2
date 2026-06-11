// Log or edit a session (spec §8.1): kind, date, guns with per-gun rounds,
// multiple drills picked through the context-aware picker, ratings, fee, notes.
// Editing preserves everything it doesn't touch (photos, malfunctions, legacy).
import { useEffect, useMemo, useState } from 'react';
import type { DrillDef, DrillResult, Firearm, GunCategory, Session } from '../lib/types.ts';
import { getAll, getOne, putOne } from '../lib/db.ts';
import { todayKey } from '../lib/dates.ts';
import { newId } from '../lib/id.ts';
import { stampNew, stampUpdate } from '../lib/stamps.ts';
import { drillsForContext } from '../lib/drillFilter.ts';
import { Sheet } from './Sheet.tsx';

const KINDS = [
  { value: 'practice', label: 'Live practice' },
  { value: 'dry_fire', label: 'Dry fire' },
  { value: 'class', label: 'Class' }
];

interface DrillRow {
  name: string; distance: string; time: string; score: string; maxScore: string; notes: string;
}

const toRow = (d: DrillResult): DrillRow => ({
  name: d.name, distance: d.distance,
  time: d.time === null ? '' : String(d.time),
  score: d.score === null ? '' : String(d.score),
  maxScore: d.maxScore === null ? '' : String(d.maxScore),
  notes: d.notes
});

const fromRow = (r: DrillRow): DrillResult => ({
  name: r.name, distance: r.distance.trim(),
  time: r.time.trim() === '' ? null : Number(r.time),
  score: r.score.trim() === '' ? null : Number(r.score),
  maxScore: r.maxScore.trim() === '' ? null : Number(r.maxScore),
  notes: r.notes.trim()
});

export function SessionForm({ id, onSaved, onCancel }: {
  id?: string; onSaved: (sessionId: string) => void; onCancel: () => void;
}) {
  const editing = id !== undefined;
  const [original, setOriginal] = useState<Session | null>(null);
  const [firearms, setFirearms] = useState<Firearm[]>([]);
  const [drillLib, setDrillLib] = useState<DrillDef[]>([]);

  const [kind, setKind] = useState('practice');
  const [date, setDate] = useState(todayKey());
  const [location, setLocation] = useState('');
  const [rounds, setRounds] = useState<Record<string, string>>({}); // firearmId -> rounds text ('' = not on session)
  const [drills, setDrills] = useState<DrillRow[]>([]);
  const [ratings, setRatings] = useState<Record<string, string>>({ focus: '', fundamentals: '', satisfaction: '' });
  const [rangeFee, setRangeFee] = useState('');
  const [notes, setNotes] = useState('');
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [f, dl] = await Promise.all([getAll<Firearm>('firearms'), getAll<DrillDef>('drills')]);
      if (!alive) return;
      setFirearms(f.sort((a, b) => a.name.localeCompare(b.name)));
      setDrillLib(dl);
      if (id !== undefined) {
        const s = await getOne<Session>('sessions', id);
        if (!alive || !s) return;
        setOriginal(s);
        setKind(s.type); setDate(s.date); setLocation(s.location);
        const r: Record<string, string> = {};
        for (const g of s.guns) r[g.firearmId] = String(g.rounds);
        setRounds(r);
        setDrills(s.drills.map(toRow));
        setRatings({
          focus: s.selfRating?.focus !== undefined ? String(s.selfRating.focus) : '',
          fundamentals: s.selfRating?.fundamentals !== undefined ? String(s.selfRating.fundamentals) : '',
          satisfaction: s.selfRating?.satisfaction !== undefined ? String(s.selfRating.satisfaction) : ''
        });
        setRangeFee(s.rangeFee === null ? '' : String(s.rangeFee));
        setNotes(s.notes);
      }
    })();
    return () => { alive = false; };
  }, [editing, id]);

  const selectedCategories = useMemo(() => {
    const cats = new Set<GunCategory>();
    for (const f of firearms) {
      if (rounds[f.id] !== undefined) cats.add(f.category);
    }
    return [...cats];
  }, [firearms, rounds]);

  const pickable = useMemo(
    () => drillsForContext(drillLib, selectedCategories, kind),
    [drillLib, selectedCategories, kind]
  );

  function toggleGun(fid: string) {
    setRounds((prev) => {
      const next = { ...prev };
      if (next[fid] !== undefined) delete next[fid];
      else next[fid] = '';
      return next;
    });
  }

  async function save() {
    const guns = Object.entries(rounds).map(([firearmId, text]) => ({
      firearmId, rounds: text.trim() === '' ? 0 : Number(text)
    }));
    if (!date) { setProblem('Pick a date.'); return; }
    if (guns.length === 0) { setProblem('Pick at least one gun.'); return; }
    if (guns.some((g) => !Number.isFinite(g.rounds) || g.rounds < 0)) {
      setProblem('Rounds need to be plain numbers.'); return;
    }
    const badDrill = drills.map(fromRow).find((d) =>
      (d.time !== null && !Number.isFinite(d.time)) ||
      (d.score !== null && !Number.isFinite(d.score)) ||
      (d.maxScore !== null && !Number.isFinite(d.maxScore)));
    if (badDrill) { setProblem(`Check the numbers on "${badDrill.name}".`); return; }

    const ratingEntries = Object.entries(ratings).filter(([, v]) => v !== '');
    const selfRating = ratingEntries.length
      ? Object.fromEntries(ratingEntries.map(([k, v]) => [k, Number(v)]))
      : null;
    const fee = rangeFee.trim() === '' ? null : Number(rangeFee);
    if (fee !== null && !Number.isFinite(fee)) { setProblem('Range fee needs to be a number.'); return; }

    const fields = {
      date, type: kind, guns, location: location.trim(), notes: notes.trim(),
      drills: drills.map(fromRow), selfRating, rangeFee: fee
    };
    if (editing && original) {
      const updated = stampUpdate({ ...original, ...fields }, Date.now());
      await putOne('sessions', updated);
      onSaved(updated.id);
    } else {
      const created: Session = stampNew({
        ...fields, distances: '', ammoUsage: [], targetMediaIds: [],
        malfunctions: [], planned: false, checklist: null
      }, newId('se'), Date.now());
      await putOne('sessions', created);
      onSaved(created.id);
    }
  }

  return (
    <div className="screen">
      <div className="navbar">
        <button className="back-btn" onClick={onCancel}>‹ Cancel</button>
        <button className="navbar-action" onClick={() => void save()}>Save</button>
      </div>
      <h1 className="large-title">{editing ? 'Edit Session' : 'Log Session'}</h1>
      {problem && <p className="form-problem">{problem}</p>}

      <div className="card">
        <h2>What Kind of Work</h2>
        <div className="seg" role="radiogroup" aria-label="Session kind">
          {KINDS.map((k) => (
            <button key={k.value} role="radio" aria-checked={kind === k.value}
              className={kind === k.value ? 'on' : ''} onClick={() => setKind(k.value)}>
              {k.label}
            </button>
          ))}
        </div>
        <label className="field">Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">Where
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Shoot Straight: University" />
        </label>
      </div>

      <div className="card">
        <h2>Guns &amp; Rounds</h2>
        {firearms.length === 0 && <p className="report-note">No guns yet — add one under More → Guns.</p>}
        {firearms.map((f) => {
          const on = rounds[f.id] !== undefined;
          return (
            <div className="row" key={f.id}>
              <button className={`gun-toggle ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleGun(f.id)}>
                {f.name}
              </button>
              {on && (
                <input className="rounds-input" type="number" inputMode="numeric" min="0"
                  placeholder={kind === 'dry_fire' ? 'reps' : 'rounds'}
                  aria-label={`Rounds for ${f.name}`}
                  value={rounds[f.id]}
                  onChange={(e) => setRounds((prev) => ({ ...prev, [f.id]: e.target.value }))} />
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Drills</h2>
        {drills.map((d, i) => (
          <div className="drill-edit" key={i}>
            <div className="drill-edit-head">
              <strong>{d.name}</strong>
              <button className="icon-btn" aria-label={`Remove ${d.name}`}
                onClick={() => setDrills((prev) => prev.filter((_, x) => x !== i))}>✕</button>
            </div>
            <div className="drill-edit-fields">
              <label className="field small">Distance
                <input value={d.distance} placeholder="7 yd"
                  onChange={(e) => setDrills((p) => p.map((x, n) => n === i ? { ...x, distance: e.target.value } : x))} />
              </label>
              <label className="field small">Time (s)
                <input type="number" inputMode="decimal" value={d.time}
                  onChange={(e) => setDrills((p) => p.map((x, n) => n === i ? { ...x, time: e.target.value } : x))} />
              </label>
              <label className="field small">Score
                <input type="number" inputMode="decimal" value={d.score}
                  onChange={(e) => setDrills((p) => p.map((x, n) => n === i ? { ...x, score: e.target.value } : x))} />
              </label>
              <label className="field small">Out of
                <input type="number" inputMode="decimal" value={d.maxScore}
                  onChange={(e) => setDrills((p) => p.map((x, n) => n === i ? { ...x, maxScore: e.target.value } : x))} />
              </label>
            </div>
            <label className="field">Drill notes
              <input value={d.notes}
                onChange={(e) => setDrills((p) => p.map((x, n) => n === i ? { ...x, notes: e.target.value } : x))} />
            </label>
          </div>
        ))}
        <button className="button secondary" onClick={() => setPicking(true)}>+ Add Drill</button>
      </div>

      <div className="card">
        <h2>How It Felt (1–5, optional)</h2>
        {(['focus', 'fundamentals', 'satisfaction'] as const).map((k) => (
          <div className="row" key={k}>
            <span className="label" style={{ textTransform: 'capitalize' }}>{k}</span>
            <select className="category-pick" aria-label={k} value={ratings[k]}
              onChange={(e) => setRatings((prev) => ({ ...prev, [k]: e.target.value }))}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Wrap-Up</h2>
        <label className="field">Range fee ($)
          <input type="number" inputMode="decimal" min="0" value={rangeFee} onChange={(e) => setRangeFee(e.target.value)} />
        </label>
        <label className="field">Notes
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <button className="button" onClick={() => void save()}>{editing ? 'Save Changes' : 'Save Session'}</button>

      {picking && (
        <Sheet title="Pick a Drill" onClose={() => setPicking(false)}>
          {pickable.length === 0 && (
            <p className="report-note">
              No drills fit this setup yet ({selectedCategories.join(', ') || 'no gun picked'} ·{' '}
              {kind === 'dry_fire' ? 'dry fire' : 'live fire'}).
            </p>
          )}
          {pickable.map((d) => (
            <button key={d.id} className="drill-pick-row" onClick={() => {
              setDrills((prev) => [...prev, { name: d.name, distance: '', time: '', score: '', maxScore: '', notes: '' }]);
              setPicking(false);
            }}>
              <strong>{d.name}</strong>
              {d.briefDescription && <span>{d.briefDescription}</span>}
            </button>
          ))}
        </Sheet>
      )}
    </div>
  );
}
