import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CHECKLIST_ITEMS, addCustomItem, buildChecklistPrintHtml, checklistItemsForCategory,
  checklistProgress, newChecklist, normalizeChecklist, normalizeCustomItems, setChecklistMode,
  setItemPacked, setItemTake
} from '../src/lib/checklist.ts';
import type { Firearm } from '../src/lib/types.ts';

const gun = (id: string, name: string): Firearm => ({
  id, createdAt: 0, updatedAt: 0,
  name, manufacturer: '', model: '', caliber: '9mm', category: 'Pistol',
  serialNumber: null, dateAcquired: '', startingRoundCount: 0,
  photoIds: [], referenceId: null, notes: ''
});

test('newChecklist starts empty with both modes off', () => {
  const cl = newChecklist();
  assert.equal(cl.nightMode, false);
  assert.equal(cl.tacticalMode, false);
  assert.deepEqual(cl.items, {});
});

test('normalizeChecklist tolerates null/garbage', () => {
  assert.deepEqual(normalizeChecklist(null), newChecklist());
  assert.deepEqual(normalizeChecklist(undefined), newChecklist());
  assert.deepEqual(normalizeChecklist('nope'), newChecklist());
  assert.deepEqual(normalizeChecklist(42), newChecklist());
});

test('normalizeChecklist parses a well-formed old-app checklist', () => {
  const cl = normalizeChecklist({
    nightMode: true, tacticalMode: false,
    items: { e1: { take: true, packed: true }, f_abc: { take: true } }
  });
  assert.equal(cl.nightMode, true);
  assert.equal(cl.tacticalMode, false);
  assert.deepEqual(cl.items.e1, { take: true, packed: true });
  assert.deepEqual(cl.items.f_abc, { take: true, packed: false });
});

test('normalizeChecklist drops malformed item entries', () => {
  const cl = normalizeChecklist({ items: { e1: 'bogus', e2: { take: true } } });
  assert.equal(cl.items.e1, undefined);
  assert.deepEqual(cl.items.e2, { take: true, packed: false });
});

test('normalizeCustomItems filters out malformed entries', () => {
  const custom = normalizeCustomItems({
    essentials: [{ id: 'ci1', label: 'Custom thing' }, { id: 'ci2' }, 'nope'],
    night: 'not-an-array'
  });
  assert.deepEqual(custom.essentials, [{ id: 'ci1', label: 'Custom thing' }]);
  assert.deepEqual(custom.night, []);
  assert.deepEqual(custom.tactical, []);
});

test('checklistItemsForCategory appends custom items after defaults', () => {
  const custom = normalizeCustomItems({ essentials: [{ id: 'ci1', label: 'Drone' }] });
  const items = checklistItemsForCategory('essentials', custom);
  assert.equal(items.length, DEFAULT_CHECKLIST_ITEMS.essentials.length + 1);
  assert.equal(items[items.length - 1].label, 'Drone');
});

test('setItemTake toggles take and clears packed when unchecked', () => {
  let cl = newChecklist();
  cl = setItemTake(cl, 'e1', true);
  cl = setItemPacked(cl, 'e1', true);
  assert.deepEqual(cl.items.e1, { take: true, packed: true });

  cl = setItemTake(cl, 'e1', false);
  assert.deepEqual(cl.items.e1, { take: false, packed: false });
});

test('setItemPacked is a no-op data-wise on an item not yet taken', () => {
  let cl = newChecklist();
  cl = setItemPacked(cl, 'e1', true);
  // Still records packed:true, but progress won't count it (see below) since take is falsy.
  assert.equal(cl.items.e1?.packed, true);
  assert.equal(cl.items.e1?.take, undefined);
});

test('setChecklistMode enabling night/tactical just flips the flag', () => {
  const custom = normalizeCustomItems(undefined);
  let cl = newChecklist();
  cl = setChecklistMode(cl, 'night', true, custom);
  assert.equal(cl.nightMode, true);
});

test('setChecklistMode disabling a category clears its items', () => {
  const custom = normalizeCustomItems({ night: [{ id: 'ci-night', label: 'Glow sticks' }] });
  let cl = newChecklist();
  cl = setChecklistMode(cl, 'night', true, custom);
  cl = setItemTake(cl, 'n1', true);
  cl = setItemTake(cl, 'ci-night', true);
  assert.equal(cl.items.n1?.take, true);
  assert.equal(cl.items['ci-night']?.take, true);

  cl = setChecklistMode(cl, 'night', false, custom);
  assert.equal(cl.nightMode, false);
  assert.equal(cl.items.n1, undefined);
  assert.equal(cl.items['ci-night'], undefined);
});

test('addCustomItem appends a trimmed label and ignores blanks', () => {
  let custom = normalizeCustomItems(undefined);
  custom = addCustomItem(custom, 'tactical', 'ci-1', '  Drop pouch  ');
  assert.deepEqual(custom.tactical, [{ id: 'ci-1', label: 'Drop pouch' }]);

  const unchanged = addCustomItem(custom, 'tactical', 'ci-2', '   ');
  assert.deepEqual(unchanged, custom);
});

test('checklistProgress counts firearms + active categories only', () => {
  const firearms = [gun('f1', 'Glock 19'), gun('f2', 'AR-15')];
  const custom = normalizeCustomItems(undefined);
  let cl = newChecklist();

  // Take one firearm (packed), one essential (not packed). Night off -> not counted.
  cl = setItemTake(cl, 'f_f1', true);
  cl = setItemPacked(cl, 'f_f1', true);
  cl = setItemTake(cl, 'e1', true);
  cl = setItemTake(cl, 'n1', true); // night not enabled, shouldn't count

  let progress = checklistProgress(cl, firearms, custom);
  assert.equal(progress.toTake, 2);
  assert.equal(progress.packed, 1);
  assert.equal(progress.pct, 50);

  // Turn on night mode -> n1 now counts too
  cl = setChecklistMode(cl, 'night', true, custom);
  cl = setItemTake(cl, 'n1', true);
  progress = checklistProgress(cl, firearms, custom);
  assert.equal(progress.toTake, 3);
  assert.equal(progress.packed, 1);
});

test('checklistProgress is 0% when nothing is selected', () => {
  const progress = checklistProgress(newChecklist(), [], normalizeCustomItems(undefined));
  assert.deepEqual(progress, { toTake: 0, packed: 0, pct: 0 });
});

test('buildChecklistPrintHtml includes taken items, escapes notes, and skips inactive categories', () => {
  const firearms = [gun('f1', 'Glock <19>')];
  const custom = normalizeCustomItems(undefined);
  let cl = newChecklist();
  cl = setItemTake(cl, 'f_f1', true);
  cl = setItemPacked(cl, 'f_f1', true);
  cl = setItemTake(cl, 'e1', true); // Eye protection

  const html = buildChecklistPrintHtml({
    date: '2026-06-13', location: 'Shoot Straight', notes: '<script>bad</script>',
    checklist: cl, custom, firearms
  });

  assert.match(html, /Gear Checklist/);
  assert.match(html, /Glock &lt;19&gt;/);
  assert.match(html, /Eye protection/);
  assert.doesNotMatch(html, /<script>bad<\/script>/);
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  // Night/Tactical sections are off and shouldn't appear.
  assert.doesNotMatch(html, /Night Session/);
  assert.doesNotMatch(html, /Tactical/);
});
