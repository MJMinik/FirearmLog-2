// Log or edit a session (spec §8.1): kind, date, guns with per-gun rounds,
// multiple drills via the context-aware picker, photos/videos, malfunctions,
// ratings, fee, notes. Removals are STAGED — cancel really cancels (rule F3).
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Ammunition, DrillDef, DrillResult, Firearm, GunCategory, MalfunctionEntry, Media, Session
} from '../lib/types.ts';
import { deleteOne, getAll, getOne, putOne } from '../lib/db.ts';
import { todayKey } from '../lib/dates.ts';
import { newId } from '../lib/id.ts';
import { stampNew, stampUpdate } from '../lib/stamps.ts';
import { drillsForContext } from '../lib/drillFilter.ts';
import { inventoryAfterUsageChange } from '../lib/costing.ts';
import { recentValues } from '../lib/suggest.ts';
import { ammoLabel } from './AmmoScreens.tsx';
import { SuggestField } from './SuggestField.tsx';
import { Sheet } from './Sheet.tsx';
import { PhotoSheet } from './PhotoSheet.tsx';
import { mediaUrl } from './media.ts';

const KINDS = [
  { value: 'practice', label: 'Live practice' },
  { value: 'dry_fire', label: 'Dry fire' },
  { value: 'class', label: 'Class' }
];

const MALF_TYPES = [
  'Failure to feed', 'Failure to fire', 'Failure to eject', 'Failure to extract',
  'Double feed', 'Stovepipe', 'Light strike', 'Other'
];

// PT's clearing methods, carried over verbatim.
const CLEAR_METHODS = [
  'Tap-Rack-Bang', 'Tap-Rack-Reassess', 'Mortar (double feed)', 'Manual clear',
  'Disassembly required', 'Mag swap', 'Resolved itself', 'Other'
];

interface DrillRow {
  name: string; distance: string; time: string; score: string; maxScore: string; notes: string;
}
interface MalfRow { firearmId: string; type: string; resolution: string; notes: string; }
interface AmmoRow { ammoId: string; rounds: string; }
interface NewFile { file: File; url: string; kind: 'image' | 'video'; }

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

export function SessionForm({ id, initialPlanned, onSaved, onCancel }: {
  id?: string; initialPlanned?: boolean; onSaved: (sessionId: string) => void; onCancel: () => void;
}) {
  const editing = id !== undefined;
  const [original, setOriginal] = useState<Session | null>(null);
  const [firearms, setFirearms] = useState<Firearm[]>([]);
  const [drillLib, setDrillLib] = useState<DrillDef[]>([]);
  const [ammoLib, setAmmoLib] = useState<Ammunition[]>([]);
  const [ammoRows, setAmmoRows] = useState<AmmoRow[]>([]);
  const [pastLocations, setPastLocations] = useState<string[]>([]);

  const [kind, setKind] = useState('practice');
  const [date, setDate] = useState(todayKey());
  const [location, setLocation] = useState('');
  const [planned, setPlanned] = useState(!editing && !!initialPlanned);
  const [instructors, setInstructors] = useState<string[]>([]);
  const [instructor, setInstructor] = useState('');
  const [newInstructor, setNewInstructor] = useState('');
  const [rounds, setRounds] = useState<Record<string, string>>({});
  const [drills, setDrills] = useState<DrillRow[]>([]);
  const [malfs, setMalfs] = useState<MalfRow[]>([]);
  const [oldMalfIds, setOldMalfIds] = useState<string[]>([]);
  const [existingMedia, setExistingMedia] = useState<Media[]>([]);
  const [removedMedia, setRemovedMedia] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<NewFile[]>([]);
  const [ratings, setRatings] = useState<Record<string, string>>(
    editing ? { focus: '', fundamentals: '', satisfaction: '' } : { focus: '5', fundamentals: '5', satisfaction: '5' }
  );
  const [rangeFee, setRangeFee] = useState('');
  const [notes, setNotes] = useState('');
  const [picking, setPicking] = useState(false);
  const [viewing, setViewing] = useState<Media | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [f, dl, am, allSessions] = await Promise.all([
        getAll<Firearm>('firearms'), getAll<DrillDef>('drills'), getAll<Ammunition>('ammunition'),
        getAll<Session>('sessions')
      ]);
      if (!alive) return;
      setFirearms(f.sort((a, b) => a.name.localeCompare(b.name)));
      setDrillLib(dl);
      setAmmoLib(am.sort((a, b) => ammoLabel(a).localeCompare(ammoLabel(b))));
      setPastLocations(recentValues(allSessions.map((s) => ({ date: s.date, value: s.location }))));
      const instructorRow = await getOne<{ key: string; value: string[] }>('meta', 'instructors');
      if (alive) setInstructors(instructorRow?.value ?? []);
      if (id !== undefined) {
        const [s, allMedia, allMalfs] = await Promise.all([
          getOne<Session>('sessions', id),
          getAll<Media>('media'),
          getAll<MalfunctionEntry>('malfunctions')
        ]);
        if (!alive || !s) return;
        setOriginal(s);
        setKind(s.type); setDate(s.date); setLocation(s.location);
        setPlanned(s.planned);
        setInstructor(s.instructor ?? '');
        const r: Record<string, string> = {};
        for (const g of s.guns) r[g.firearmId] = String(g.rounds);
        setRounds(r);
        setDrills(s.drills.map(toRow));
        setAmmoRows((s.ammoUsage ?? []).map((u) => ({ ammoId: u.ammoId, rounds: String(u.rounds) })));
        setExistingMedia(allMedia.filter((m) => m.ownerType === 'session' && m.ownerId === id));
        const mine = allMalfs.filter((m) => m.sessionId === id);
        setOldMalfIds(mine.map((m) => m.id));
        setMalfs(mine.map((m) => ({
          firearmId: m.firearmId, type: m.type, resolution: m.resolution, notes: m.notes
        })));
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

  const selectedGuns = useMemo(
    () => firearms.filter((f) => rounds[f.id] !== undefined),
    [firearms, rounds]
  );
  const selectedCategories = useMemo(() => {
    const cats = new Set<GunCategory>();
    for (const f of selectedGuns) cats.add(f.category);
    return [...cats];
  }, [selectedGuns]);

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

  function filesPicked(list: FileList | null) {
    if (!list) return;
    const added: NewFile[] = [];
    for (const file of Array.from(list)) {
      added.push({
        file,
        url: URL.createObjectURL(file),
        kind: file.type.startsWith('video') ? 'video' : 'image'
      });
    }
    setNewFiles((prev) => [...prev, ...added]);
  }

  async function save() {
    if (saving) return;
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

    const ammoUsage = ammoRows
      .filter((r) => r.ammoId !== '')
      .map((r) => ({ ammoId: r.ammoId, rounds: r.rounds.trim() === '' ? 0 : Number(r.rounds) }));
    if (ammoUsage.some((u) => !Number.isFinite(u.rounds) || u.rounds < 0)) {
      setProblem('Ammo rounds need to be plain numbers.'); return;
    }

    const ratingEntries = Object.entries(ratings).filter(([, v]) => v !== '');
    const selfRating = ratingEntries.length
      ? Object.fromEntries(ratingEntries.map(([k, v]) => [k, Number(v)]))
      : null;
    const fee = rangeFee.trim() === '' ? null : Number(rangeFee);
    if (fee !== null && !Number.isFinite(fee)) { setProblem('Range fee needs to be a number.'); return; }

    setSaving(true);
    try {
      const sid = original ? original.id : newId('se');
      const now = Date.now();
      const finalInstructor = kind === 'class' ? (newInstructor.trim() || instructor.trim()) : '';
      const fields = {
        date, type: kind, guns, location: location.trim(), notes: notes.trim(),
        drills: drills.map(fromRow), selfRating, rangeFee: fee, ammoUsage,
        planned, instructor: finalInstructor || null
      };
      if (original) {
        await putOne('sessions', stampUpdate({ ...original, ...fields }, now));
      } else {
        await putOne('sessions', stampNew({
          ...fields, distances: '', targetMediaIds: [],
          malfunctions: [], checklist: null
        }, sid, now));
      }
      if (finalInstructor && !instructors.includes(finalInstructor)) {
        await putOne('meta', { key: 'instructors', value: [...instructors, finalInstructor].sort() });
      }

      // Ammo comes off the cans — only the CHANGE, so edits never double-deduct.
      // Planned sessions never move stock: their usage baseline/target is empty,
      // so marking a planned session as shot deducts exactly once, and flipping
      // a real session back to planned returns the rounds.
      const baselineUsage = original && !original.planned ? (original.ammoUsage ?? []) : [];
      const targetUsage = planned ? [] : ammoUsage;
      const changes = inventoryAfterUsageChange(ammoLib, baselineUsage, targetUsage);
      for (const [ammoId, quantity] of changes) {
        const can = ammoLib.find((a) => a.id === ammoId);
        if (can) await putOne('ammunition', stampUpdate({ ...can, quantity }, now));
      }

      // Staged photo/video changes commit only now (rule F3).
      for (const mid of removedMedia) await deleteOne('media', mid);
      let seq = existingMedia.length;
      for (const nf of newFiles) {
        seq += 1;
        const buf = await nf.file.arrayBuffer();
        await putOne('media', stampNew({
          ownerType: 'session' as const, ownerId: sid,
          kind: nf.kind, name: `${nf.kind === 'video' ? 'Video' : 'Photo'} ${seq} — ${date}`,
          annotations: [], mime: nf.file.type || 'application/octet-stream', data: buf
        }, newId('md'), now));
      }

      // Malfunctions: rewrite this session's set.
      for (const mid of oldMalfIds) await deleteOne('malfunctions', mid);
      for (const m of malfs) {
        if (!m.type) continue;
        await putOne('malfunctions', stampNew({
          sessionId: sid, date, firearmId: m.firearmId,
          type: m.type, resolution: m.resolution.trim(), notes: m.notes.trim()
        }, newId('mf'), now));
      }

      onSaved(sid);
    } finally {
      setSaving(false);
    }
  }

  const visibleExisting = existingMedia.filter((m) => !removedMedia.includes(m.id));

  return (
    <div className="screen">
      <div className="navbar">
        <button className="back-btn" onClick={onCancel}>‹ Cancel</button>
        <button className="navbar-action" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <h1 className="large-title">{editing ? 'Edit Session' : planned ? 'Plan Session' : 'Log Session'}</h1>
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
        <SuggestField label="Where" value={location} onChange={setLocation}
          suggestions={pastLocations} placeholder="Shoot Straight: University" />
        {kind === 'class' && (
          <>
            <label className="field">Instructor
              <select value={instructor} onChange={(e) => { setInstructor(e.target.value); setNewInstructor(''); }}>
                <option value="">—</option>
                {instructors.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="field">…or add a new instructor
              <input value={newInstructor} onChange={(e) => setNewInstructor(e.target.value)} placeholder="Ben Stoeger" />
            </label>
          </>
        )}
        <div className="row">
          <button className={`gun-toggle ${planned ? 'on' : ''}`} aria-pressed={planned}
            onClick={() => setPlanned(!planned)}>
            Planned session (hasn't happened yet — nothing counts until it does)
          </button>
        </div>
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
                  placeholder={planned ? 'planned rounds' : kind === 'dry_fire' ? 'reps' : 'rounds'}
                  aria-label={`Rounds for ${f.name}`}
                  value={rounds[f.id]}
                  onChange={(e) => setRounds((prev) => ({ ...prev, [f.id]: e.target.value }))} />
              )}
            </div>
          );
        })}
      </div>

      {kind !== 'dry_fire' && ammoLib.length > 0 && (
        <div className="card">
          <h2>Ammo Used</h2>
          {ammoRows.map((r, i) => (
            <div className="row" key={i}>
              <select className="category-pick ammo-pick" aria-label={`Ammo ${i + 1}`} value={r.ammoId}
                onChange={(e) => setAmmoRows((p) => p.map((x, n) => n === i ? { ...x, ammoId: e.target.value } : x))}>
                <option value="">Pick ammo…</option>
                {ammoLib.map((a) => <option key={a.id} value={a.id}>{ammoLabel(a)}</option>)}
              </select>
              <input className="rounds-input" type="number" inputMode="numeric" min="0"
                placeholder="rounds" aria-label={`Rounds of ammo ${i + 1}`} value={r.rounds}
                onChange={(e) => setAmmoRows((p) => p.map((x, n) => n === i ? { ...x, rounds: e.target.value } : x))} />
              <button className="icon-btn" aria-label="Remove ammo row"
                onClick={() => setAmmoRows((prev) => prev.filter((_, x) => x !== i))}>✕</button>
            </div>
          ))}
          <button className="button secondary" onClick={() => setAmmoRows((prev) => [...prev, { ammoId: '', rounds: '' }])}>
            + Add Ammo
          </button>
          {(() => {
            const used = ammoRows.reduce((t, r) => t + (Number(r.rounds) || 0), 0);
            const shot = Object.values(rounds).reduce((t, v) => t + (Number(v) || 0), 0);
            return used > 0 && shot > 0 && used !== shot ? (
              <p className="report-note">
                Heads up: ammo rows total {used.toLocaleString()} but the guns above total{' '}
                {shot.toLocaleString()}. You can still save — just check the numbers.
              </p>
            ) : (
              <p className="report-note">Rounds come off the can when you save; fixing a number later puts the difference back.</p>
            );
          })()}
        </div>
      )}

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
        <h2>Targets, Photos &amp; Videos</h2>
        {(visibleExisting.length > 0 || newFiles.length > 0) && (
          <div className="photo-grid" style={{ marginBottom: 12 }}>
            {visibleExisting.map((m) => (
              <div className="thumb-wrap" key={m.id}>
                <button className="thumb-tap" onClick={() => setViewing(m)} aria-label={`Open ${m.name}`}>
                  {m.kind === 'video'
                    ? <video src={mediaUrl(m)} preload="metadata" muted playsInline />
                    : <img src={mediaUrl(m)} alt={m.name} loading="lazy" />}
                </button>
                <button className="thumb-x" aria-label={`Remove ${m.name}`}
                  onClick={() => setRemovedMedia((prev) => [...prev, m.id])}>✕</button>
              </div>
            ))}
            {newFiles.map((nf, i) => (
              <div className="thumb-wrap" key={nf.url}>
                {nf.kind === 'video'
                  ? <video src={nf.url} preload="metadata" muted playsInline />
                  : <img src={nf.url} alt="New photo" />}
                <button className="thumb-x" aria-label="Remove new file"
                  onClick={() => setNewFiles((prev) => prev.filter((_, x) => x !== i))}>✕</button>
              </div>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
          onChange={(e) => { filesPicked(e.target.files); e.target.value = ''; }} />
        <button className="button secondary" onClick={() => fileRef.current?.click()}>+ Add Photos or Videos</button>
        <p className="report-note">Tap a photo to name it or jot notes. Removals only happen when you Save — Cancel really cancels.</p>
      </div>

      <div className="card">
        <h2>Malfunctions</h2>
        {malfs.map((m, i) => (
          <div className="drill-edit" key={i}>
            <div className="drill-edit-head">
              <strong>{m.type || 'New malfunction'}</strong>
              <button className="icon-btn" aria-label="Remove malfunction"
                onClick={() => setMalfs((prev) => prev.filter((_, x) => x !== i))}>✕</button>
            </div>
            <label className="field">What happened
              <select value={m.type}
                onChange={(e) => setMalfs((p) => p.map((x, n) => n === i ? { ...x, type: e.target.value } : x))}>
                <option value="">Pick one…</option>
                {MALF_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="field">Which gun
              <select value={m.firearmId}
                onChange={(e) => setMalfs((p) => p.map((x, n) => n === i ? { ...x, firearmId: e.target.value } : x))}>
                {(selectedGuns.length ? selectedGuns : firearms).map((f) =>
                  <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
            <label className="field">How you cleared it
              <select value={CLEAR_METHODS.includes(m.resolution) || m.resolution === '' ? m.resolution : 'Other'}
                onChange={(e) => setMalfs((p) => p.map((x, n) => n === i ? { ...x, resolution: e.target.value } : x))}>
                <option value="">Pick one…</option>
                {CLEAR_METHODS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field">Notes
              <input value={m.notes}
                onChange={(e) => setMalfs((p) => p.map((x, n) => n === i ? { ...x, notes: e.target.value } : x))} />
            </label>
          </div>
        ))}
        <button className="button secondary" onClick={() => setMalfs((prev) => [
          ...prev,
          { firearmId: (selectedGuns[0] ?? firearms[0])?.id ?? '', type: '', resolution: 'Tap-Rack-Bang', notes: '' }
        ])}>+ Add Malfunction</button>
      </div>

      <div className="card">
        <h2>How It Felt (1–10)</h2>
        {(['focus', 'fundamentals', 'satisfaction'] as const).map((k) => (
          <div className="row" key={k}>
            <span className="label" style={{ textTransform: 'capitalize' }}>{k}</span>
            <select className="category-pick" aria-label={k} value={ratings[k]}
              onChange={(e) => setRatings((prev) => ({ ...prev, [k]: e.target.value }))}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
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

      <button className="button" disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : editing ? 'Save Changes' : 'Save Session'}
      </button>

      {viewing && (
        <PhotoSheet media={viewing} allowDelete={false} onClose={() => setViewing(null)}
          onChanged={async () => {
            const allMedia = await getAll<Media>('media');
            setExistingMedia(allMedia.filter((m) => m.ownerType === 'session' && m.ownerId === (original?.id ?? '')));
          }} />
      )}
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
