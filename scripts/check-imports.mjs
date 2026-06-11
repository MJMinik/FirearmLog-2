// Cheap guard: flag imported names that never appear again in their file.
// Catches the most common type-check failure before code leaves the machine.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

let bad = 0;
for (const path of walk('src')) {
  const src = readFileSync(path, 'utf8');
  for (const m of src.matchAll(/import (?:type )?\{([^}]+)\} from/g)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().replace(/^type /, '');
      if (!name) continue;
      const count = (src.match(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) ?? []).length;
      if (count < 2) {
        console.error(`UNUSED IMPORT: ${name} in ${path}`);
        bad++;
      }
    }
  }
}
if (bad > 0) process.exit(1);
console.log('imports clean');
