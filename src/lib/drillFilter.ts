// Context-aware drill picking (spec §8.2, req. 18):
// the picker only shows drills that fit the guns on the session AND
// whether it's dry-fire or live-fire work.

import type { DrillDef, GunCategory } from './types.ts';

/**
 * `sessionType` is the session's type ('dry_fire' means dry work; anything
 * else — practice, class — means live fire). `categories` are the categories
 * of the guns currently on the session; empty means "no gun picked yet",
 * which shows everything that fits the fire type.
 */
export function drillsForContext(
  drills: DrillDef[],
  categories: GunCategory[],
  sessionType: string
): DrillDef[] {
  const dry = sessionType === 'dry_fire';
  return drills
    .filter(d => (dry ? d.fire === 'dry' || d.fire === 'both' : d.fire === 'live' || d.fire === 'both'))
    .filter(d => categories.length === 0 || d.gunCategories.some(c => categories.includes(c)))
    .sort((a, b) => a.name.localeCompare(b.name));
}
