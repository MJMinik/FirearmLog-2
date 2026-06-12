import { useEffect, useState } from 'react';
import type { Ammunition, Firearm, MalfunctionEntry, Media, Purchase, Session } from '../lib/types.ts';
import { deleteOne, getAll, getOne, putOne } from '../lib/db.ts';
import { formatDayKey } from '../lib/dates.ts';
import { sessionRounds } from '../lib/stats.ts';
import { stampUpdate } from '../lib/stamps.ts';
import { computeFifoCosts, inventoryAfterUsageChange, sessionAmmoCost } from '../lib/costing.ts';
import { ammoLabel } from './AmmoScreens.tsx';
import { mediaUrl } from './media.ts';
import { ConfirmSheet } from './Sheet.tsx';
import { PhotoSheet } from './PhotoSheet.tsx';

const TYPE_LABEL: Record<string, string> = {
  practice: 'Live practice', dry_fire: 'Dry fire', class: 'Class'
};

export function SessionDetail({ id, onEdit, onBack, onDeleted, refreshKey }: {
  id: string; onEdit: () => void; onBack: () => void; onDeleted: () => void; refreshKey: number;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [firearms, setFirearms] = useState<Firearm[]>([]);
  const [photos, setPhotos] = useState<Media[]>([]);
  const [malfs, setMalfs] = useState<MalfunctionEntry[]>([]);
  const [ammo, setAmmo] = useState<Ammunition[]>([]);
  const [ammoCost, setAmmoCost] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [viewing, setViewing] = useState<Media | null>(null);
  const [localBump, setLocalBump] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [s, f, media, allMalfs, allAmmo, purchases, allSessions] = await Promise.all([
        getOne<Session>('sessions', id),
        getAll<Firearm>('firearms'),
        getAll<Media>('media'),
        getAll<MalfunctionEntry>('malfunctions'),
        getAll<Ammunition>('ammunition'),
        getAll<Purchase>('purchases'),
        getAll<Session>('sessions')
      ]);
      if (!alive || !s) return;
      setSession(s);
      setFirearms(f);
      setPhotos(media.filter((m) => m.ownerType === 'session' && m.ownerId === id));
      setMalfs(allMalfs.filter((m) => m.sessionId === id));
      setAmmo(allAmmo);
      setAmmoCost(sessionAmmoCost(s, computeFifoCosts(purchases, allSessions), allAmmo));
    })();
    return () => { alive = false; };
  }, [id, refreshKey, localBump]);

  if (!session) return <div className="screen" />;

  const gunName = (fid: string) => firearms.find((f) => f.id === fid)?.name ?? '—';

  async function reallyDelete() {
    // The session's photos and malfunction records go with it,
    // and any ammo it used goes back on the can.
    if (session && !session.planned) {
      const changes = inventoryAfterUsageChange(ammo, session.ammoUsage ?? [], []);
      for (const [ammoId, quantity] of changes) {
        const can = ammo.find((a) => a.id === ammoId);
        if (can) await putOne('ammunition', stampUpdate({ ...can, quantity }, Date.now()));
      }
    }
    for (const p of photos) await deleteOne('media', p.id);
    for (const m of malfs) await deleteOne('malfunctions', m.id);
    await deleteOne('sessions', id);
    onDeleted();
  }

  return (
    <div className="screen">
      <div className="navbar">
        <button className="back-btn" onClick={onBack}>‹ Back</button>
        <button className="navbar-action" onClick={onEdit}>Edit</button>
      </div>
      <h1 className="large-title">{formatDayKey(session.date)}</h1>

      <div className="card">
        <h2>Session</h2>
        <div className="row"><span className="label">Kind</span><span className="value">{TYPE_LABEL[session.type] ?? session.type}{session.planned ? ' · planned' : ''}</span></div>
        {session.instructor && <div className="row"><span className="label">Instructor</span><span className="value">{session.instructor}</span></div>}
        {session.location && <div className="row"><span className="label">Where</span><span className="value">{session.location}</span></div>}
        <div className="row">
          <span className="label">{session.type === 'dry_fire' ? 'Dry-fire reps' : 'Rounds'}</span>
          <span className="value">{sessionRounds(session).toLocaleString()}</span>
        </div>
        {session.rangeFee !== null && <div className="row"><span className="label">Range fee</span><span className="value">${session.rangeFee.toFixed(2)}</span></div>}
      </div>

      <div className="card">
        <h2>Guns</h2>
        {session.guns.map((g, i) => (
          <div className="row" key={i}>
            <span className="label">{gunName(g.firearmId)}</span>
            <span className="value">{g.rounds.toLocaleString()} {session.type === 'dry_fire' ? 'reps' : 'rds'}</span>
          </div>
        ))}
      </div>

      {(session.ammoUsage ?? []).length > 0 && (
        <div className="card">
          <h2>Ammo Used</h2>
          {(session.ammoUsage ?? []).map((u, i) => {
            const a = ammo.find((x) => x.id === u.ammoId);
            return (
              <div className="row" key={i}>
                <span className="label">{a ? ammoLabel(a) : 'Ammo deleted'}</span>
                <span className="value">{(u.rounds || 0).toLocaleString()} rds</span>
              </div>
            );
          })}
          {ammoCost > 0 && (
            <div className="row">
              <span className="label">Ammo cost</span>
              <span className="value">${ammoCost.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {session.drills.length > 0 && (
        <div className="card">
          <h2>Drills</h2>
          {session.drills.map((d, i) => (
            <div className="row" key={i}>
              <span className="label">
                {d.name}
                {(d.distance || d.notes) && (
                  <div className="row-sub">{[d.distance && `${d.distance}`, d.notes].filter(Boolean).join(' · ')}</div>
                )}
              </span>
              <span className="value">
                {[d.time !== null ? `${d.time}s` : null,
                  d.score !== null ? `${d.score}${d.maxScore !== null ? `/${d.maxScore}` : ''}` : null]
                  .filter(Boolean).join(' · ') || '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {malfs.length > 0 && (
        <div className="card">
          <h2>Malfunctions</h2>
          {malfs.map((m) => (
            <div className="row" key={m.id}>
              <span className="label">
                {m.type} — {gunName(m.firearmId)}
                {(m.resolution || m.notes) && (
                  <div className="row-sub">{[m.resolution, m.notes].filter(Boolean).join(' · ')}</div>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {session.selfRating && Object.keys(session.selfRating).length > 0 && (
        <div className="card">
          <h2>How It Felt</h2>
          {Object.entries(session.selfRating).map(([k, v]) => (
            <div className="row" key={k}>
              <span className="label" style={{ textTransform: 'capitalize' }}>{k}</span>
              <span className="value">{v} / 10</span>
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <div className="card">
          <h2>Targets, Photos &amp; Videos</h2>
          <p className="report-note" style={{ marginBottom: 8 }}>Tap one to name it, jot notes, or remove it.</p>
          <div className="photo-grid">
            {photos.map((m) => (
              <button className="thumb-tap" key={m.id} onClick={() => setViewing(m)} aria-label={m.name}>
                {m.kind === 'video'
                  ? <video src={mediaUrl(m)} preload="metadata" muted playsInline />
                  : <img src={mediaUrl(m)} alt={m.name} loading="lazy" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {session.notes && (
        <div className="card">
          <h2>Notes</h2>
          <p className="note-text">{session.notes}</p>
        </div>
      )}

      <button className="button danger" onClick={() => setConfirming(true)}>Delete Session</button>

      {confirming && (
        <ConfirmSheet
          title="Delete this session?"
          message="This removes the session, its photos, and its round counts. Ammo it used goes back on the can. There's no undo."
          confirmLabel="Delete Session"
          onConfirm={() => void reallyDelete()}
          onClose={() => setConfirming(false)}
        />
      )}
      {viewing && (
        <PhotoSheet media={viewing} onClose={() => setViewing(null)}
          onChanged={() => setLocalBump((b) => b + 1)} />
      )}
    </div>
  );
}
