// Reference (spec §9): manufacturer care guides, browsable from More and
// linkable to guns so the schedule defaults flow from the maker's guidance.
import type { GunCategory } from '../lib/types.ts';
import { REFERENCES, getReference } from '../lib/referenceData.ts';

export function ReferenceList({ onBack, openDetail }: {
  onBack: () => void; openDetail: (id: string) => void;
}) {
  const groups: GunCategory[] = ['Pistol', 'Rifle', 'Shotgun'];
  return (
    <div className="screen">
      <div className="navbar">
        <button className="back-btn" onClick={onBack}>‹ Back</button>
        <span />
      </div>
      <h1 className="large-title">Reference</h1>
      <p className="report-note" style={{ marginBottom: 12 }}>
        Care guides by manufacturer. Link one to a gun (on the gun's page) and that
        maker's schedule becomes the gun's default.
      </p>
      {groups.map((cat) => (
        <div className="card" key={cat}>
          <h2>{cat}s</h2>
          {REFERENCES.filter((r) => r.category === cat).map((r) => (
            <button className="row-tap" key={r.id} onClick={() => openDetail(r.id)}>
              <span className="label">{r.name}</span>
              <span className="value">›</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ReferenceDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const ref = getReference(id);
  if (!ref) {
    return (
      <div className="screen">
        <div className="navbar"><button className="back-btn" onClick={onBack}>‹ Back</button><span /></div>
        <p className="empty">That reference isn't here anymore.</p>
      </div>
    );
  }
  return (
    <div className="screen">
      <div className="navbar">
        <button className="back-btn" onClick={onBack}>‹ Back</button>
        <span />
      </div>
      <h1 className="large-title">{ref.name}</h1>

      <div className="card">
        <h2>Suggested Schedule</h2>
        <div className="row">
          <span className="label">Deep clean</span>
          <span className="value">every {ref.maintenance.deepCleanRounds.toLocaleString()} rounds</span>
        </div>
        {ref.maintenance.recoilSpringRounds && (
          <div className="row">
            <span className="label">Recoil spring</span>
            <span className="value">every {ref.maintenance.recoilSpringRounds.toLocaleString()} rounds</span>
          </div>
        )}
        <div className="row">
          <span className="label">Field strip</span>
          <span className="value">after live sessions</span>
        </div>
        <div className="row">
          <span className="label">Inspection</span>
          <span className="value">yearly</span>
        </div>
        <p className="report-note" style={{ marginTop: 8 }}>
          {ref.maintenance.note} These are common starting points — your owner's manual wins.
        </p>
      </div>

      <div className="card">
        <h2>Cleaning Checklist</h2>
        <ol className="sync-steps">
          {ref.checklist.map((c, i) => <li key={i}>{c}</li>)}
        </ol>
      </div>

      <div className="card">
        <h2>Care Notes</h2>
        <p className="note-text">{ref.guidance}</p>
      </div>

      <div className="card">
        <h2>Manufacturer Links</h2>
        {ref.links.map((l) => (
          <a className="row-tap" key={l.url} href={l.url} target="_blank" rel="noreferrer"
            style={{ textDecoration: 'none' }}>
            <span className="label" style={{ color: 'var(--accent)' }}>{l.label}</span>
            <span className="value">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
