// Local-only verification of the importer against Michael's REAL data file.
// The real file never leaves this computer (it's gitignored).
//
//   npm run verify-real -- ../pistol-tracker-sync.json
//
import { readFileSync } from 'node:fs';
import { parseOldFile, importPistolTracker } from '../src/lib/import/pistolTracker.ts';

const path = process.argv[2] ?? '../pistol-tracker-sync.json';
const text = readFileSync(path, 'utf8');
const old = parseOldFile(text);
const { data, report } = importPistolTracker(old, {}, Date.now());

console.log('=== FirearmLog import verification ===');
console.log(`File: ${path}`);
console.log('');
console.log('Record counts (in → out):');
for (const row of report.counts) {
  console.log(`  ${row.ok ? 'OK ' : 'FAIL'}  ${row.label}: ${row.inCount} in, ${row.outCount} out`);
}
console.log('');
console.log(`Photos: ${report.imagesIn} in, ${report.imagesOut} out  ${report.imagesOk ? 'OK' : 'FAIL'}`);
console.log('');
console.log('Rounds per gun (old app math vs new records):');
for (const g of report.guns) {
  console.log(`  ${g.ok ? 'OK ' : 'FAIL'}  ${g.name}: old=${g.oldRounds}, new=${g.newRounds}`);
}
console.log('');
console.log('Guessed categories:');
for (const f of data.firearms) {
  console.log(`  ${f.name} → ${f.category}`);
}
console.log('');
console.log(report.allOk ? 'ALL CHECKS PASSED — zero loss.' : 'SOMETHING DID NOT MATCH — do not ship.');
process.exit(report.allOk ? 0 : 1);
