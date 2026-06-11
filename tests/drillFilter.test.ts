import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drillsForContext } from '../src/lib/drillFilter.ts';
import type { DrillDef } from '../src/lib/types.ts';

const d = (name: string, fire: DrillDef['fire'], cats: DrillDef['gunCategories']): DrillDef => ({
  id: name, createdAt: 0, updatedAt: 0,
  name, fire, gunCategories: cats,
  briefDescription: '', fullDescription: '', scoring: '', requiresHolster: false, tags: []
});

const drills = [
  d('Bill Drill', 'both', ['Pistol']),
  d('Wall Drill', 'dry', ['Pistol']),
  d('Doubles 5yd', 'live', ['Pistol']),
  d('Skeet Single', 'live', ['Shotgun'])
];

test('dry-fire session shows only dry-capable drills', () => {
  const names = drillsForContext(drills, ['Pistol'], 'dry_fire').map(x => x.name);
  assert.deepEqual(names, ['Bill Drill', 'Wall Drill']);
});

test('live session (practice) hides dry-only drills', () => {
  const names = drillsForContext(drills, ['Pistol'], 'practice').map(x => x.name);
  assert.deepEqual(names, ['Bill Drill', 'Doubles 5yd']);
});

test('class counts as live fire', () => {
  const names = drillsForContext(drills, ['Pistol'], 'class').map(x => x.name);
  assert.deepEqual(names, ['Bill Drill', 'Doubles 5yd']);
});

test('gun category filters: shotgun session shows shotgun drills only', () => {
  const names = drillsForContext(drills, ['Shotgun'], 'practice').map(x => x.name);
  assert.deepEqual(names, ['Skeet Single']);
});

test('no gun picked yet: every drill matching the fire type shows', () => {
  const names = drillsForContext(drills, [], 'practice').map(x => x.name);
  assert.deepEqual(names, ['Bill Drill', 'Doubles 5yd', 'Skeet Single']);
});

test('mixed categories show the union', () => {
  const names = drillsForContext(drills, ['Pistol', 'Shotgun'], 'practice').map(x => x.name);
  assert.deepEqual(names, ['Bill Drill', 'Doubles 5yd', 'Skeet Single']);
});
