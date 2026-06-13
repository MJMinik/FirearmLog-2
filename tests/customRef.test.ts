import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRefLookup, isCustomRefId, suggestReferenceMatch, toEntry } from '../src/lib/referenceData.ts';
import { maintenanceStatus } from '../src/lib/maintenance.ts';
import type { Firearm, Reference } from '../src/lib/types.ts';

const customGuide: Reference = {
  id: 'refx-abc', createdAt: 0, updatedAt: 0,
  name: "Grandpa's 1911", category: 'Pistol',
  deepCleanRounds: 800, recoilSpringRounds: 2000,
  checklist: ['Wipe it down'], guidance: 'Treat her gently.',
  links: [{ label: 'example.com', url: 'https://example.com' }]
};

test('custom IDs are recognized', () => {
  assert.ok(isCustomRefId('refx-abc'));
  assert.ok(!isCustomRefId('ref-glock'));
  assert.ok(!isCustomRefId(null));
});

test('lookup serves both built-ins and custom guides', () => {
  const lookup = buildRefLookup([customGuide]);
  assert.equal(lookup('ref-glock')?.name, 'Glock');
  assert.equal(lookup('refx-abc')?.name, "Grandpa's 1911");
  assert.equal(lookup('refx-missing'), undefined);
  assert.equal(lookup(null), undefined);
});

test('suggestReferenceMatch: exact and near-exact manufacturer names', () => {
  assert.equal(suggestReferenceMatch('Glock', 'Pistol', [])?.id, 'ref-glock');
  assert.equal(suggestReferenceMatch('glock', 'Pistol', [])?.id, 'ref-glock'); // case-insensitive
  // "Atlas Gunworks" should find "Atlas Gunworks (2011)" despite the year suffix
  assert.equal(suggestReferenceMatch('Atlas Gunworks', 'Pistol', [])?.id, 'ref-atlas');
});

test('suggestReferenceMatch: parenthetical abbreviations match (BCM)', () => {
  assert.equal(suggestReferenceMatch('BCM', 'Rifle', [])?.id, 'ref-bcm');
  assert.equal(suggestReferenceMatch('Bravo Company', 'Rifle', [])?.id, 'ref-bcm');
});

test('suggestReferenceMatch: category disambiguates Smith & Wesson', () => {
  assert.equal(suggestReferenceMatch('Smith & Wesson', 'Pistol', [])?.id, 'ref-sw-pistol');
  assert.equal(suggestReferenceMatch('Smith & Wesson', 'Rifle', [])?.id, 'ref-sw-rifle');
  // Wrong category for this manufacturer's only guide -> no match
  assert.equal(suggestReferenceMatch('Mossberg', 'Pistol', []), null);
});

test('suggestReferenceMatch: no match for blank or unrecognized manufacturer', () => {
  assert.equal(suggestReferenceMatch('', 'Pistol', []), null);
  assert.equal(suggestReferenceMatch('   ', 'Pistol', []), null);
  assert.equal(suggestReferenceMatch('Some Random Maker', 'Pistol', []), null);
});

test('suggestReferenceMatch: matches a custom guide before built-ins', () => {
  const mine: Reference = {
    ...customGuide, id: 'refx-mine', name: 'Acme Custom Shop', category: 'Pistol'
  };
  assert.equal(suggestReferenceMatch('Acme Custom Shop', 'Pistol', [mine])?.id, 'refx-mine');
  // Custom guides are scoped by category too
  assert.equal(suggestReferenceMatch('Acme Custom Shop', 'Rifle', [mine]), null);
});

test('a custom guide drives the maintenance schedule', () => {
  const gun: Firearm = {
    id: 'fa-1', createdAt: 0, updatedAt: 0,
    name: 'Old 1911', manufacturer: '', model: '', caliber: '.45',
    category: 'Pistol', serialNumber: null, dateAcquired: '', startingRoundCount: 900,
    recoilSpringInterval: null, recoilSpringWeight: null, deepCleanInterval: null,
    barrelName: null, barrelInstallDate: null, barrelStartRounds: null,
    photoIds: [], referenceId: 'refx-abc', notes: ''
  };
  const items = maintenanceStatus(gun, toEntry(customGuide), [], [], [gun], new Date(2026, 5, 11));
  // 900 starting rounds vs the guide's 800-round deep clean = due
  assert.equal(items.find((i) => i.type === 'deep_clean')!.level, 'due');
  assert.ok(items.some((i) => i.type === 'recoil_spring'));
});
