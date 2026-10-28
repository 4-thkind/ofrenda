// Ofrenda — one command for every test.
// Run with: npm test

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here)
  .filter((file) => file.endsWith('.test.mjs'))
  .sort();

let failed = 0;

for (const file of files) {
  console.log(`\n— ${file}`);
  const result = spawnSync(process.execPath, [path.join(here, file)], { stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}

console.log(`\n${files.length - failed}/${files.length} test files passed`);
process.exit(failed ? 1 : 0);
