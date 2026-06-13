import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BATTERY_DUE_DAYS, daysSince, isBatteryDue, lastBatteryEntry, normalizeBatteryLog } from '../src/lib/optics.ts';

test('normalizeBatteryLog tolerates garbage and sorts newest first', () => {
  assert.deepEqual(normalizeBatteryLog([]), []);
  assert.deepEqual(normalizeBatteryLog([null, 'nope', 42, { notes: 'no date' }]), []);
  const log = normalizeBatteryLog([
    { date: '2025-01-01', notes: 'first' },
    { date: '2026-01-01', notes: 'second' },
    { date: '2025-06-01' } // missing notes tolerated
  ]);
  assert.equal(log.length, 3);
  assert.equal(log[0].date, '2026-01-01');
  assert.equal(log[1].date, '2025-06-01');
  assert.equal(log[1].notes, '');
});

test('lastBatteryEntry returns the newest entry or null', () => {
  assert.equal(lastBatteryEntry([]), null);
  const last = lastBatteryEntry([
    { date: '2025-01-01', notes: 'first' },
    { date: '2026-01-01', notes: 'second' }
  ]);
  assert.equal(last?.date, '2026-01-01');
  assert.equal(last?.notes, 'second');
});

test('daysSince counts whole days', () => {
  const now = new Date(2026, 5, 13, 12, 0, 0); // Jun 13, 2026
  assert.equal(daysSince('2026-06-13', now), 0);
  assert.equal(daysSince('2026-06-01', now), 12);
});

test('isBatteryDue is false with no log, false under the threshold, true over it', () => {
  const now = new Date(2026, 5, 13, 12, 0, 0); // Jun 13, 2026
  assert.equal(isBatteryDue([], now), false);

  const recent = [{ date: '2026-05-01', notes: '' }]; // ~43 days ago
  assert.equal(isBatteryDue(recent, now), false);

  const stale = [{ date: '2025-01-01', notes: '' }]; // well over BATTERY_DUE_DAYS
  assert.equal(isBatteryDue(stale, now), true);

  // Sanity check the threshold constant is what PT used.
  assert.equal(BATTERY_DUE_DAYS, 330);
});
