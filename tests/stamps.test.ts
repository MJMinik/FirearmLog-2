import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stampNew, stampUpdate } from '../src/lib/stamps.ts';

test('stampNew sets id and both stamps', () => {
  const r = stampNew({ name: 'x' }, 'ab-1', 1000);
  assert.deepEqual(r, { name: 'x', id: 'ab-1', createdAt: 1000, updatedAt: 1000 });
});

test('stampUpdate bumps only updatedAt (old bug F4 stays dead)', () => {
  const r = stampNew({ name: 'x' }, 'ab-1', 1000);
  const edited = stampUpdate(r, 2000);
  assert.equal(edited.createdAt, 1000);
  assert.equal(edited.updatedAt, 2000);
});
