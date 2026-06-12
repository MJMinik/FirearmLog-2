// Combining duplicate ammo cans (the old app's "Consolidate Duplicates",
// rebuilt as prevention): saving a can that matches an existing
// brand + caliber + grain + bullet type offers to combine the two.
// Pure logic only — unit tested; the form applies the results.

import type { UsageLike } from './costing.ts';

export interface CanFields {
  brand: string;
  caliber: string;
  grain: string;
  bulletType: string;
}

export interface MergeCan extends CanFields {
  id: string;
  quantity: number;
  costPerRound: number;
}

/** Two cans are "the same ammo" when these four fields match, ignoring case/spacing. */
export function skuKey(a: CanFields): string {
  return [a.brand, a.caliber, a.grain, a.bulletType]
    .map((s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|');
}

/** The existing can these fields duplicate, if any. */
export function findSameAmmo<T extends MergeCan>(
  cans: T[], fields: CanFields, excludeId?: string
): T | undefined {
  const key = skuKey(fields);
  return cans.find((c) => c.id !== excludeId && skuKey(c) === key);
}

/**
 * Quantity and cost/round after pouring `add` into `keep`: rounds sum;
 * cost/round is weighted by rounds across the parts that have a cost
 * (matching the old app's consolidation math).
 */
export function combinedCan(
  keep: Pick<MergeCan, 'quantity' | 'costPerRound'>,
  add: Pick<MergeCan, 'quantity' | 'costPerRound'>
): { quantity: number; costPerRound: number } {
  const quantity = (keep.quantity || 0) + (add.quantity || 0);
  let weighted = 0, costQty = 0;
  for (const part of [keep, add]) {
    if (part.costPerRound > 0 && part.quantity > 0) {
      weighted += part.quantity * part.costPerRound;
      costQty += part.quantity;
    }
  }
  const costPerRound = costQty > 0
    ? +(weighted / costQty).toFixed(4)
    : keep.costPerRound || add.costPerRound || 0;
  return { quantity, costPerRound };
}

/**
 * Sessions whose ammo rows point at the removed can, rewritten to point at
 * the kept one (rows for the same can within a session collapse into one).
 * Returns only the sessions that changed.
 */
export function repointAmmoUsage(
  sessions: { id: string; ammoUsage?: UsageLike[] }[],
  fromId: string,
  toId: string
): { id: string; ammoUsage: UsageLike[] }[] {
  const out: { id: string; ammoUsage: UsageLike[] }[] = [];
  for (const s of sessions) {
    const usage = s.ammoUsage ?? [];
    if (!usage.some((u) => u.ammoId === fromId)) continue;
    const collapsed = new Map<string, number>();
    for (const u of usage) {
      const ammoId = u.ammoId === fromId ? toId : u.ammoId;
      collapsed.set(ammoId, (collapsed.get(ammoId) ?? 0) + (u.rounds || 0));
    }
    out.push({
      id: s.id,
      ammoUsage: [...collapsed].map(([ammoId, rounds]) => ({ ammoId, rounds }))
    });
  }
  return out;
}

/**
 * IDs of purchases linked to the removed can (formal field or legacy bag) —
 * each needs its formal ammoId set to the kept can so FIFO costing follows.
 */
export function repointPurchaseIds(
  purchases: { id: string; ammoId?: string | null; legacy?: Record<string, unknown> }[],
  fromId: string
): string[] {
  return purchases
    .filter((p) => p.ammoId === fromId || (!p.ammoId && p.legacy?.ammoId === fromId))
    .map((p) => p.id);
}
