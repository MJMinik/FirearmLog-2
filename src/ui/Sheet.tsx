// THE shared modal sheet and confirm-before-delete (rules R3/R5/A1):
// every dialog in the app goes through these two components.
import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function Sheet({ title, onClose, children }: {
  title: string; onClose: () => void; children: ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmSheet({ title, message, confirmLabel, onConfirm, onClose }: {
  title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="report-note" style={{ marginBottom: 14 }}>{message}</p>
      <button className="button danger" onClick={onConfirm}>{confirmLabel}</button>
      <div style={{ height: 8 }} />
      <button className="button secondary" onClick={onClose}>Cancel</button>
    </Sheet>
  );
}
