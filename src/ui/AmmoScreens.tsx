// Ammo inventory (spec §15.6, §5.7): one row per ammo can — brand, caliber,
// grain, bullet type, rounds on hand, and what those rounds cost. The
// cost/round shown prefers the FIFO "in the can" number (from linked Ammo
// Purchases) and falls back to the manually typed figure.
import { useEffect, useState } from 'react';
import type { Ammunition, Purchase, Session } from '../lib/types.ts';
import { deleteOne, getAll, getOne, putOne } from '../lib/db.ts';
import { newId } from '../lib/id.ts';
import { stampNew, stampUpdate } from '../lib/stamps.ts';
import { ammoCurrentCostPerRound, lowAmmo } from '../lib/costing.ts';
import { ConfirmSheet } from './Sheet.tsx';

export const ammoLabel = (a: Pick<Ammunition, 'brand' | 'caliber' | 'grain' | 'bulletType'>): string =>
  [a.brand, a.caliber, a.grain && `${a.grain}gr`, a.bulletType].filter(Boolean).join(' ');

export function AmmoScreen({ refreshKey, onBack, openForm }: {
  refreshKey: number; onBack: () => void; openForm: (id?: string) => void;
}) {
  const [ammo, setAmmo] = useState<Ammunition[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      getAll<Ammunition>('ammunition'), getAll<Purchase>('purchases'), getAll<Session>('sessions')
    ]).then(([a, p, s]) => {
      if (!alive) return;
      setAmmo(a.sort((x, y) => ammoLabel(x).localeCompare(ammoLabel(y))));
      setPurchases(p);
      setSessions(s);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [refreshKey]);

  if (!loaded) return <div className="screen" />;
  const low = new Set(lowAmmo(ammo).map((a) => a.id));

  return (
    <div className="screen">
      <div className="navbar">
        <button className="back-btn" onClick={onBack}>‹ More</button>
      </div>
      <h1 className="large-title">Ammo</h1>
      <button className="button" onClick={() => openForm()}>+ Add Ammo</button>
      {ammo.length === 0 ? (
        <p className="empty">No ammo tracked yet. Add a can, then log purchases under More → Costs &amp; Purchases so FirearmLog can figure your true cost per round.</p>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>On Hand</h2>
          {ammo.map((a) => {
            const inCan = ammoCurrentCostPerRound(a.id, purchases, sessions);
            const perRound = inCan ?? (a.costPerRound > 0 ? a.costPerRound : null);
            return (
              <button className="row-tap" key={a.id} onClick={() => openForm(a.id)}>
                <span className="label">
                  {ammoLabel(a) || 'Unnamed ammo'}
                  <div className="row-sub">
                    {perRound !== null
                      ? `$${perRound.toFixed(3)}/round${inCan !== null ? '' : ' (typed in, not from purchases)'}`
                      : 'No cost info yet'}
                  </div>
                </span>
                <span className="value">
                  {(a.quantity || 0).toLocaleString()} rds
                  {low.has(a.id) && <span className="badge warn-badge" style={{ marginLeft: 6 }}>Low</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="report-note">
        Rounds come off a can automatically when you log a session that used it,
        and go on when you log an ammo purchase linked to it.
      </p>
    </div>
  );
}

const BULLET_TYPES = ['FMJ', 'JHP', 'TMJ', 'LRN', 'Frangible', 'Birdshot', 'Buckshot', 'Slug', 'Other'];

export function AmmoForm({ id, onSaved, onCancel }: {
  id?: string; onSaved: () => void; onCancel: () => void;
}) {
  const editing = id !== undefined;
  const [original, setOriginal] = useState<Ammunition | null>(null);
  const [brand, setBrand] = useState('');
  const [caliber, setCaliber] = useState('9mm');
  const [grain, setGrain] = useState('');
  const [bulletType, setBulletType] = useState('FMJ');
  const [quantity, setQuantity] = useState('');
  const [costPerRound, setCostPerRound] = useState('');
  const [notes, setNotes] = useState('');
  const [usedBy, setUsedBy] = useState(0);
  const [problem, setProblem] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (id === undefined) return;
    let alive = true;
    void Promise.all([getOne<Ammunition>('ammunition', id), getAll<Session>('sessions')]).then(([a, s]) => {
      if (!alive || !a) return;
      setOriginal(a);
      setBrand(a.brand); setCaliber(a.caliber); setGrain(a.grain);
      setBulletType(a.bulletType || 'FMJ');
      setQuantity(String(a.quantity || 0));
      setCostPerRound(a.costPerRound > 0 ? String(a.costPerRound) : '');
      setNotes(a.notes);
      setUsedBy(s.filter((x) => (x.ammoUsage ?? []).some((u) => u.ammoId === id)).length);
    });
    return () => { alive = false; };
  }, [id]);

  async function save() {
    if (!brand.trim() && !caliber.trim()) { setProblem('Give it at least a brand or a caliber.'); return; }
    const qty = quantity.trim() === '' ? 0 : Number(quantity);
    const cpr = costPerRound.trim() === '' ? 0 : Number(costPerRound);
    if (!Number.isFinite(qty) || qty < 0) { setProblem('Rounds on hand needs to be a plain number.'); return; }
    if (!Number.isFinite(cpr) || cpr < 0) { setProblem('Cost per round needs to be a plain number, like 0.30.'); return; }
    const now = Date.now();
    const fields = {
      brand: brand.trim(), caliber: caliber.trim(), grain: grain.trim(),
      bulletType, quantity: qty, costPerRound: cpr, notes: notes.trim()
    };
    if (original) await putOne('ammunition', stampUpdate({ ...original, ...fields }, now));
    else await putOne('ammunition', stampNew(fields, newId('am'), now));
    onSaved();
  }

  async function reallyDelete() {
    if (id !== undefined) await deleteOne('ammunition', id);
    onSaved();
  }

  return (
    <div className="screen">
      <div className="navbar">
        <button className="back-btn" onClick={onCancel}>‹ Cancel</button>
        <button className="navbar-action" onClick={() => void save()}>Save</button>
      </div>
      <h1 className="large-title">{editing ? 'Edit Ammo' : 'Add Ammo'}</h1>
      {problem && <p className="form-problem">{problem}</p>}
      <div className="card">
        <label className="field">Brand
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Blazer Brass" />
        </label>
        <label className="field">Caliber
          <input value={caliber} onChange={(e) => setCaliber(e.target.value)} placeholder="9mm" />
        </label>
        <label className="field">Grain
          <input type="number" inputMode="numeric" value={grain} onChange={(e) => setGrain(e.target.value)} placeholder="115" />
        </label>
        <label className="field">Bullet type
          <select value={bulletType} onChange={(e) => setBulletType(e.target.value)}>
            {BULLET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="field">Rounds on hand
          <input type="number" inputMode="numeric" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label className="field">Cost per round ($, optional)
          <input type="number" inputMode="decimal" step="0.001" min="0" value={costPerRound}
            onChange={(e) => setCostPerRound(e.target.value)} placeholder="0.30" />
        </label>
        <p className="report-note">
          Only needed for sessions older than your purchase history — once you log
          ammo purchases, FirearmLog works out the real cost per round on its own.
        </p>
        <label className="field">Notes
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <button className="button" onClick={() => void save()}>{editing ? 'Save Changes' : 'Save Ammo'}</button>
      {editing && (
        <button className="button danger" style={{ marginTop: 8 }} onClick={() => setConfirming(true)}>
          Delete Ammo
        </button>
      )}
      {confirming && (
        <ConfirmSheet
          title="Delete this ammo?"
          message={usedBy > 0
            ? `${usedBy} session${usedBy === 1 ? ' used' : 's used'} this ammo — those will show "ammo deleted." There's no undo.`
            : "This removes the can from your inventory. There's no undo."}
          confirmLabel="Delete Ammo"
          onConfirm={() => void reallyDelete()}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
