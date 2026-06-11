import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classFor, classificationProgress, hitFactor } from '../src/lib/competition.ts';

test('hit factor is points per second, rounded to 4 places', () => {
  assert.equal(hitFactor(130, 25.55), 5.0881);
  assert.equal(hitFactor(0, 10), 0);
  assert.equal(hitFactor(100, 0), null);
  assert.equal(hitFactor(null, 10), null);
  assert.equal(hitFactor(100, null), null);
});

test('class bands match USPSA', () => {
  assert.equal(classFor(96), 'GM');
  assert.equal(classFor(95), 'GM');
  assert.equal(classFor(85), 'M');
  assert.equal(classFor(75), 'A');
  assert.equal(classFor(60), 'B');
  assert.equal(classFor(59.99), 'C');
  assert.equal(classFor(40), 'C');
  assert.equal(classFor(39.99), 'D');
});

test('progress: best 6 of the most recent 8', () => {
  // 10 scores; the two oldest (90s) must NOT count.
  const scores = [
    { date: '2026-01-01', percent: 90 }, { date: '2026-01-02', percent: 90 },
    { date: '2026-02-01', percent: 50 }, { date: '2026-02-02', percent: 52 },
    { date: '2026-03-01', percent: 54 }, { date: '2026-03-02', percent: 56 },
    { date: '2026-04-01', percent: 58 }, { date: '2026-04-02', percent: 60 },
    { date: '2026-05-01', percent: 44 }, { date: '2026-05-02', percent: 46 }
  ];
  const p = classificationProgress(scores);
  // recent 8: 52..60 plus 44,46 → best 6: 60,58,56,54,52,50? No — 50 is 9th oldest, excluded.
  // recent 8 = 46,44,60,58,56,54,52,50? recent by date desc: 46,44,60,58,56,54,52,50 → 50 IS in (8th).
  assert.equal(p.scoresUsed.length, 6);
  assert.deepEqual(p.scoresUsed, [60, 58, 56, 54, 52, 50]);
  assert.equal(p.average, 55);
  assert.equal(p.currentClass, 'C');
  assert.deepEqual(p.next, { name: 'B', threshold: 60 });
});

test('progress with few scores still averages what exists', () => {
  const p = classificationProgress([
    { date: '2026-01-01', percent: 61 },
    { date: '2026-02-01', percent: 63 },
    { date: '2026-03-01', percent: null }
  ]);
  assert.equal(p.average, 62);
  assert.equal(p.currentClass, 'B');
  assert.equal(p.scoresOnRecord, 2);
  assert.deepEqual(p.next, { name: 'A', threshold: 75 });
});

test('progress with nothing returns empty', () => {
  const p = classificationProgress([]);
  assert.equal(p.average, null);
  assert.equal(p.currentClass, null);
});
