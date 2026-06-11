// The one date module (spec §3.5.6). All day-keys are LOCAL time.
// Never use toISOString() for day-keys — that was old bug F8.

/** Today's date as a local YYYY-MM-DD day-key. */
export function todayKey(now: Date = new Date()): string {
  return dayKey(now);
}

/** Local YYYY-MM-DD day-key for any Date. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Friendly display like "Jun 11, 2026" from a YYYY-MM-DD day-key (local). */
export function formatDayKey(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return key;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
