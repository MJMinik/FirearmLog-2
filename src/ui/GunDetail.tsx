import { useEffect, useState } from 'react';
import type { Firearm, Match, Media, Session } from '../lib/types.ts';
import { getAll, getOne } from '../lib/db.ts';
import { roundsForFirearm } from '../lib/stats.ts';
import { mediaUrl } from './media.ts';

export function GunDetail({ id, onEdit, onBack, refreshKey }: {
  id: string; onEdit: () => void; onBack: () => void; refreshKey: number;
}) {
  const [gun, setGun] = useState<Firearm | null>(null);
  const [photos, setPhotos] = useState<Media[]>([]);
  const [stats, setStats] = useState({ rounds: 0, sessions: 0 });

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
  }, [id, refreshKey]);

  if (!gun) return <div className="screen" />;

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

      {photos.length > 0 && (
        <div className="card">
          <h2>Photos</h2>
          <div className="photo-grid">
            {photos.map((m) => (
              <img key={m.id} src={mediaUrl(m)} alt={m.name} loading="lazy" />
            ))}
          </div>
        </div>
      )}

      {gun.notes && (
        <div className="card">
          <h2>Notes</h2>
          <p className="note-text">{gun.notes}</p>
        </div>
      )}
    </div>
  );
}
