// Optics helpers — pure logic for the battery-log / "battery due" status
// (PT parity). Fully unit tested.

export interface BatteryEntry {
  date: string; // YYYY-MM-DD
  notes: string;
}

/** PT's threshold: flag the battery as due after this many days. */
export const BATTERY_DUE_DAYS = 330;

/** Pull well-formed { date, notes } entries out of an Optic's batteryLog, newest first. */
export function normalizeBatteryLog(batteryLog: unknown[]): BatteryEntry[] {
  return batteryLog
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map((e) => ({
      date: typeof e.date === 'string' ? e.date : '',
      notes: typeof e.notes === 'string' ? e.notes : ''
    }))
    .filter((e) => e.date !== '')
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Most recent battery-change entry, or null if none logged. */
export function lastBatteryEntry(batteryLog: unknown[]): BatteryEntry | null {
  const entries = normalizeBatteryLog(batteryLog);
  return entries.length > 0 ? entries[0] : null;
}

/** Whole days elapsed between a YYYY-MM-DD day-key and `now` (local). */
export function daysSince(date: string, now: Date): number {
  const then = new Date(date + 'T12:00:00').getTime();
  return Math.floor((now.getTime() - then) / (1000 * 60 * 60 * 24));
}

/** True once it's been more than BATTERY_DUE_DAYS since the last logged change. */
export function isBatteryDue(batteryLog: unknown[], now: Date): boolean {
  const last = lastBatteryEntry(batteryLog);
  if (!last) return false;
  return daysSince(last.date, now) > BATTERY_DUE_DAYS;
}
