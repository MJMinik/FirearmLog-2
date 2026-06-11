import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, readZip, writeZip } from '../src/lib/zip.ts';

test('crc32 matches the standard check value', () => {
  // "123456789" -> 0xCBF43926 is the published CRC-32 test vector.
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

test('zip round-trip: text and binary entries come back byte-for-byte', () => {
  const bin = new Uint8Array(10000);
  for (let i = 0; i < bin.length; i++) bin[i] = (i * 37) & 0xFF;
  const entries = [
    { name: 'data.json', data: new TextEncoder().encode('{"hello":"world"}') },
    { name: 'media/md-1', data: bin },
    { name: 'media/md-2', data: new Uint8Array(0) }
  ];
  const zipped = writeZip(entries, new Date(2026, 5, 11, 12, 0, 0));
  const back = readZip(zipped);
  assert.equal(back.length, 3);
  assert.deepEqual(back.map((e) => e.name), ['data.json', 'media/md-1', 'media/md-2']);
  assert.deepEqual([...back[1].data], [...bin]);
  assert.equal(new TextDecoder().decode(back[0].data), '{"hello":"world"}');
});

test('a damaged file is refused with a plain-language error', () => {
  const zipped = writeZip([{ name: 'a.txt', data: new TextEncoder().encode('hello hello') }]);
  zipped[35] ^= 0xFF; // flip a byte inside the stored data
  assert.throws(() => readZip(zipped), /damaged/);
});

test('random bytes are refused', () => {
  assert.throws(() => readZip(new Uint8Array(100)), /Not a FirearmLog data file/);
});
