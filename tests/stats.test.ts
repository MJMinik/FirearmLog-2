import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundsForFirearm, sessionRounds, totalRounds } from '../src/lib/stats.ts';

const firearms = [
  { id: 'fa-1', startingRoundCount: 100 },
  { id: 'fa-2', startingRoundCount: 0 }
];
const sessions = [
  { planned: false, guns: [{ firearmId: 'fa-1', rounds: 300 }] },
  { planned: false, guns: [{ firearmId: 'fa-1', rounds: 400 }, { firearmId: 'fa-2', rounds: 20 }] },
  { planned: true, guns: [{ firearmId: 'fa-1', rounds: 999 }] } // planned never counts
];
const matches = [{ firearmId: 'fa-2', totalRounds: 80 }];

test('roundsForFirearm: starting count + splits + matches, planned excluded', () => {
  assert.equal(roundsForFirearm('fa-1', firearms, sessions, matches), 800);
  assert.equal(roundsForFirearm('fa-2', firearms, sessions, matches), 100);
  assert.equal(roundsForFirearm('missing', firearms, sessions, matches), 0);
});

test('sessionRounds sums all guns on the session', () => {
  assert.equal(sessionRounds(sessions[1]), 420);
});

test('totalRounds is the sum over every gun', () => {
  assert.equal(totalRounds(firearms, sessions, matches), 900);
});
