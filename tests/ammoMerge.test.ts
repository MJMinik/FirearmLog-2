import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  combinedCan, findSameAmmo, repointAmmoUsage, repointPurchaseIds, skuKey
} from '../src/lib/ammoMerge.ts';

const blazer = { id: 'am-1', brand: 'Blazer Brass', caliber: '9mm', grain: '115', bulletType: 'FMJ', quantity: 2930, costPerRound: 0.302 };
const blazer2 = { id: 'am-2', brand: 'blazer  brass', caliber: '9MM', grain: '115', bulletType: 'FMJ', quantity: 1000, costPerRound: 0.303 };
const winchester = { id: 'am-3', brand: 'Winchester', caliber: '9mm', grain: '115', bulletType: 'FMJ', quantity: 350, costPerRound: 0.22 };

test('skuKey ignores case and extra spaces', () => {
  assert.equal(skuKey(blazer), skuKey(blazer2));
  assert.notEqual(skuKey(blazer), skuKey(winchester));
});

test('findSameAmmo spots the duplicate and respects the exclusion', () => {
  assert.equal(findSameAmmo([blazer, winchester], blazer2)?.id, 'am-1');
  assert.equal(findSameAmmo([blazer], blazer, 'am-1'), undefined);
  assert.equal(findSameAmmo([winchester], blazer2), undefined);
});

test('combinedCan: rounds sum, cost/round weighted by rounds (Michael\'s real case)', () => {
  const c = combinedCan(blazer, blazer2);
  assert.equal(c.quantity, 3930);
  assert.equal(c.costPerRound, 0.3023); // (2930×.302 + 1000×.303) / 3930
});

test('combinedCan: missing costs fall back instead of skewing the average', () => {
  assert.equal(combinedCan({ quantity: 100, costPerRound: 0 }, { quantity: 50, costPerRound: 0.3 }).costPerRound, 0.3);
  assert.equal(combinedCan({ quantity: 100, costPerRound: 0.25 }, { quantity: 50, costPerRound: 0 }).costPerRound, 0.25);
  assert.equal(combinedCan({ quantity: 0, costPerRound: 0 }, { quantity: 0, costPerRound: 0 }).costPerRound, 0);
});

test('repointAmmoUsage rewrites only touched sessions and collapses double rows', () => {
  const sessions = [
    { id: 'se-1', ammoUsage: [{ ammoId: 'am-2', rounds: 100 }] },
    { id: 'se-2', ammoUsage: [{ ammoId: 'am-1', rounds: 50 }, { ammoId: 'am-2', rounds: 150 }] },
    { id: 'se-3', ammoUsage: [{ ammoId: 'am-3', rounds: 25 }] },
    { id: 'se-4' }
  ];
  const changed = repointAmmoUsage(sessions, 'am-2', 'am-1');
  assert.deepEqual(changed, [
    { id: 'se-1', ammoUsage: [{ ammoId: 'am-1', rounds: 100 }] },
    { id: 'se-2', ammoUsage: [{ ammoId: 'am-1', rounds: 200 }] }
  ]);
});

test('repointPurchaseIds finds formal and legacy links', () => {
  const purchases = [
    { id: 'pu-1', ammoId: 'am-2' },
    { id: 'pu-2', ammoId: null, legacy: { ammoId: 'am-2' } },
    { id: 'pu-3', ammoId: 'am-1' },
    { id: 'pu-4' }
  ];
  assert.deepEqual(repointPurchaseIds(purchases, 'am-2'), ['pu-1', 'pu-2']);
});
