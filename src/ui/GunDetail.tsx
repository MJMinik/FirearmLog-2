import { useEffect, useRef, useState } from 'react';
import type { Firearm, Match, Media, Session } from '../lib/types.ts';
import { getAll, getOne, putOne } from '../lib/db.ts';
import { newId } from '../lib/id.ts';
import { stampNew } from '../lib/stamps.ts';
import { roundsForFirearm } from '../lib/stats.ts';
import { mediaUrl } from './media.ts';
import { PhotoSheet } from './PhotoSheet.tsx';

export function GunDetail({ id, onEdit, onBack, refreshKey }: {
  id: string; onEdit: () => void; onBack: () => void; refreshKey: number;
}) {
  const [gun, setGun] = useState<Firearm | null>(null);
  const [photos, setPhotos] = useState<Media[]>([]);
  const [stats, setStats] = useState({ rounds: 0, sessions: 0 });
  const [viewing, setViewing] = useState<Media | null>(null);
  const [localBump, setLocalBump] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [g, firearms, sessions, matches, media] = await Promise.all([
        getOne<Firearm>('firearms', id),
        getAll<Firearm>('firearms'),
        getAll<Session>('sessions'),
        getAll<Match>('matches'),
        getAll<Media>('media')
      ]);
      if (!alive || !g) return;
      setGun(g);
      setPhotos(media.filter((m) => m.ownerType === 'firearm' && m.ownerId === id));
      setStats({
        rounds: roundsForFirearm(id, firearms, sessions, matches),
        sessions: sessions.filter((s) => !s.planned && s.guns.some((x) => x.firearmId === id)).length
      });
    })();
    return () => { alive = false; };
  }, [id, refreshKey, localBump]);

  if (!gun) return <div className="screen" />;

  async function addPhotos(list: FileList | null) {
    if (!list || !gun) return;
    const now = Date.now();
    let seq = photos.length;
    for (const file of Array.from(list)) {
      seq += 1;
      const buf = await file.arrayBuffer();
      await putOne('media', stampNew({
        ownerType: 'firearm' as const, ownerId: id,
        kind: file.type.startsWith('video') ? 'video' as const : 'image' as const,
        name: `${gun.name} — photo ${seq}`,
        annotations: [], mime: file.type || 'application/octet-stream', data: buf
      }, newId('md'), now));
    }
    setLocalBump((b) => b + 1);
  }

  return (
    <div className="screen">
      <div className="navbar">
        <button className="back-btn" onClick={onBack}>‹ Back</button>
        <button className="navbar-action" onClick={onEdit}>Edit</button>
      </div>
      <h1 className="large-title">{gun.name}</h1>

      <div className="stat-grid">
        <div className="stat"><div className="num">{stats.rounds.toLocaleString()}</div><div className="cap">Lifetime rounds</div></div>
        <div className="stat"><div className="num">{stats.sessions}</div><div className="cap">Sessions</div></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Details</h2>
        <div className="row"><span className="label">Made by</span><span className="value">{gun.manufacturer || '—'}</span></div>
        <div className="row"><span className="label">Model</span><span className="value">{gun.model || '—'}</span></div>
        <div className="row"><span className="label">Type</span><span className="value">{gun.category}</span></div>
        <div className="row"><span className="label">Caliber</span><span className="value">{gun.caliber || '—'}</span></div>
        <div className="row"><span className="label">Serial</span><span className="value">{gun.serialNumber || '—'}</span></div>
        {gun.dateAcquired && <div className="row"><span className="label">Acquired</span><span className="value">{gun.dateAcquired}</span></div>}
        {gun.startingRoundCount > 0 && <div className="row"><span className="label">Starting round count</span><span className="value">{gun.startingRoundCount.toLocaleString()}</span></div>}
      </div>

      <div className="card">
        <h2>Photos</h2>
        {photos.length > 0 && (
          <>
            <p className="report-note" style={{ marginBottom: 8 }}>Tap one to name it, jot notes, or remove it.</p>
            <div className="photo-grid" style={{ marginBottom: 12 }}>
              {photos.map((m) => (
                <button className="thumb-tap" key={m.id} onClick={() => setViewing(m)} aria-label={m.name}>
                  {m.kind === 'video'
                    ? <video src={mediaUrl(m)} preload="metadata" muted playsInline />
                    : <img src={mediaUrl(m)} alt={m.name} loading="lazy" />}
                </button>
              ))}
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
          onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
        <button className="button secondary" onClick={() => fileRef.current?.click()}>+ Add Photos</button>
      </div>

      {gun.notes && (
        <div className="card">
          <h2>Notes</h2>
          <p className="note-text">{gun.notes}</p>
        </div>
      )}

      {viewing && (
        <PhotoSheet media={viewing} onClose={() => setViewing(null)}
          onChanged={() => setLocalBump((b) => b + 1)} />
      )}
    </div>
  );
}
