import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dryRepsForFirearm, roundsForFirearm, sessionRounds, totalRounds } from '../src/lib/stats.ts';

const firearms = [
  { id: 'fa-1', startingRoundCount: 100 },
  { id: 'fa-2', startingRoundCount: 0 }
];
const sessions = [
  { planned: false, type: 'practice', guns: [{ firearmId: 'fa-1', rounds: 300 }] },
  { planned: false, type: 'practice', guns: [{ firearmId: 'fa-1', rounds: 400 }, { firearmId: 'fa-2', rounds: 20 }] },
  { planned: true, type: 'practice', guns: [{ firearmId: 'fa-1', rounds: 999 }] },  // planned never counts
  { planned: false, type: 'dry_fire', guns: [{ firearmId: 'fa-1', rounds: 500 }] }  // dry reps never count
];
const matches = [{ firearmId: 'fa-2', totalRounds: 80 }];

test('roundsForFirearm: starting count + splits + matches; planned AND dry fire excluded', () => {
  assert.equal(roundsForFirearm('fa-1', firearms, sessions, matches), 800);
  assert.equal(roundsForFirearm('fa-2', firearms, sessions, matches), 100);
  assert.equal(roundsForFirearm('missing', firearms, sessions, matches), 0);
});

test('dry-fire reps are tracked separately, never as rounds fired', () => {
  assert.equal(dryRepsForFirearm('fa-1', sessions), 500);
  assert.equal(dryRepsForFirearm('fa-2', sessions), 0);
});

test('sessionRounds sums all guns on the session', () => {
  assert.equal(sessionRounds(sessions[1]), 420);
});

test('totalRounds is the sum over every gun (live fire only)', () => {
  assert.equal(totalRounds(firearms, sessions, matches), 900);
});
