import { useEffect, useState } from 'react';
import type { Firearm, Media, Session } from '../lib/types.ts';
import { deleteOne, getAll, getOne } from '../lib/db.ts';
import { formatDayKey } from '../lib/dates.ts';
import { sessionRounds } from '../lib/stats.ts';
import { mediaUrl } from './media.ts';
import { ConfirmSheet } from './Sheet.tsx';

const TYPE_LABEL: Record<string, string> = {
  practice: 'Live practice', dry_fire: 'Dry fire', class: 'Class'
};

export function SessionDetail({ id, onEdit, onBack, onDeleted, refreshKey }: {
  id: string; onEdit: () => void; onBack: () => void; onDeleted: () => void; refreshKey: number;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [firearms, setFirearms] = useState<Firearm[]>([]);
  const [photos, setPhotos] = useState<Media[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [s, f, media] = await Promise.all([
        getOne<Session>('sessions', id),
        getAll<Firearm>('firearms'),
        getAll<Media>('media')
      ]);
      if (!alive || !s) return;
      setSession(s);
      setFirearms(f);
      setPhotos(media.filter((m) => m.ownerType === 'session' && m.ownerId === id));
    })();
    return () => { alive = false; };
  }, [id, refreshKey]);

  if (!session) return <div className="screen" />;

  const gunName = (fid: string) => firearms.find((f) => f.id === fid)?.name ?? '—';

  async function reallyDelete() {
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
        <div className="row"><span className="label">Kind</span><span className="value">{TYPE_LABEL[session.type] ?? session.type}</span></div>
        {session.location && <div className="row"><span className="label">Where</span><span className="value">{session.location}</span></div>}
        <div className="row"><span className="label">Rounds</span><span className="value">{sessionRounds(session).toLocaleString()}</span></div>
        {session.rangeFee !== null && <div className="row"><span className="label">Range fee</span><span className="value">${session.rangeFee.toFixed(2)}</span></div>}
      </div>

      <div className="card">
        <h2>Guns</h2>
        {session.guns.map((g, i) => (
          <div className="row" key={i}>
            <span className="label">{gunName(g.firearmId)}</span>
            <span className="value">{g.rounds.toLocaleString()} rds</span>
          </div>
        ))}
      </div>

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

      {session.selfRating && Object.keys(session.selfRating).length > 0 && (
        <div className="card">
          <h2>How It Felt</h2>
          {Object.entries(session.selfRating).map(([k, v]) => (
            <div className="row" key={k}>
              <span className="label" style={{ textTransform: 'capitalize' }}>{k}</span>
              <span className="value">{v} / 5</span>
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <div className="card">
          <h2>Targets</h2>
          <div className="photo-grid">
            {photos.map((m) => <img key={m.id} src={mediaUrl(m)} alt={m.name} loading="lazy" />)}
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
          message="This removes the session and its round counts. There's no undo."
          confirmLabel="Delete Session"
          onConfirm={() => void reallyDelete()}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
