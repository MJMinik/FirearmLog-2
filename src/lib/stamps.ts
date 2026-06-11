// Record stamping rules in one place (spec §3.2.3, §3.5.10).
// Stamps change ONLY through these functions — never on mere app-open (old bug F4).

import type { BaseRecord } from './types.ts';

/** Stamp a brand-new record (or a freshly imported one). */
export function stampNew<T extends object>(record: T, id: string, at: number): T & BaseRecord {
  return { ...record, id, createdAt: at, updatedAt: at };
}

/** Stamp an edit. Call this only when the user actually saved a change. */
export function stampUpdate<T extends BaseRecord>(record: T, at: number): T {
  return { ...record, updatedAt: at };
}
