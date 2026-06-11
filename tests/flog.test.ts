import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFlog, newestStamp, parseFlog } from '../src/lib/flog.ts';
import type { Snapshot } from '../src/lib/flog.ts';
import { writeZip } from '../src/lib/zip.ts';
import type { Media } from '../src/lib/types.ts';

function sampleSnapshot(): Snapshot {
  const photoBytes = new Uint8Array([1, 2, 3, 4, 5, 200, 100, 0]);
  const media: Media[] = [{
    id: 'md-fa-1-0', createdAt: 1000, updatedAt: 2000,
    ownerType: 'firearm', ownerId: 'fa-1', kind: 'image',
    name: 'Test photo', annotations: ['nice group'],
    mime: 'image/jpeg', data: photoBytes.buffer
  }];
  const stores = {
    firearms: [{ id: 'fa-1', name: 'Test Gun', createdAt: 1000, updatedAt: 5000 }],
    sessions: [{ id: 'se-1', date: '2026-06-11', createdAt: 1000, updatedAt: 9000 }],
    meta: [{ key: 'settings', value: { ownerName: 'Test' } }]
  };
  return { exportedAt: 10000, lastModified: 9000, stores, media };
}

test('newestStamp finds the latest real change', () => {
  const s = sampleSnapshot();
  assert.equal(newestStamp(s.stores, s.media), 9000);
});

test('flog round-trip: stores, media bytes, and stamps survive', () => {
  const s = sampleSnapshot();
  const file = buildFlog(s);
  const back = parseFlog(file);
  assert.equal(back.lastModified, 9000);
  assert.equal(back.exportedAt, 10000);
  assert.deepEqual(back.stores.firearms, s.stores.firearms);
  assert.deepEqual(back.stores.meta, s.stores.meta);
  assert.equal(back.media.length, 1);
  assert.equal(back.media[0].name, 'Test photo');
  assert.deepEqual(back.media[0].annotations, ['nice group']);
  assert.deepEqual([...new Uint8Array(back.media[0].data)], [1, 2, 3, 4, 5, 200, 100, 0]);
});

test('non-flog zips are refused in plain language', () => {
  const notFlog = writeZip([{ name: 'whatever.txt', data: new Uint8Array([1]) }]);
  assert.throws(() => parseFlog(notFlog), /isn't a FirearmLog data file/);
});

test('files from a newer app version are refused with advice', () => {
  const s = sampleSnapshot();
  const file = buildFlog(s);
  const back = parseFlog(file); // sanity
  assert.ok(back);
  const futuristic = writeZip([{
    name: 'data.json',
    data: new TextEncoder().encode(JSON.stringify({ format: 'FirearmLog', version: 99, stores: {}, mediaMeta: [] }))
  }]);
  assert.throws(() => parseFlog(futuristic), /NEWER version/);
});
