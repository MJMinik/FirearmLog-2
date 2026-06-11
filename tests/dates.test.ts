import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, formatDayKey } from '../src/lib/dates.ts';

test('dayKey uses LOCAL time, never UTC (old bug F8)', () => {
  // 11:30 PM local on Jan 5 must be Jan 5, even though UTC may already be Jan 6.
  const lateNight = new Date(2026, 0, 5, 23, 30, 0);
  assert.equal(dayKey(lateNight), '2026-01-05');
  const earlyMorning = new Date(2026, 0, 5, 0, 15, 0);
  assert.equal(dayKey(earlyMorning), '2026-01-05');
});

test('dayKey pads months and days', () => {
  assert.equal(dayKey(new Date(2026, 5, 9)), '2026-06-09');
});

test('formatDayKey leaves junk alone', () => {
  assert.equal(formatDayKey('not-a-date'), 'not-a-date');
});
