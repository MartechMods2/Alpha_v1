import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = [];
async function walk(dir) {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(name);
    else if (/\.(js|mjs)$/.test(entry.name)) files.push(name);
  }
}
for (const dir of ['commands', 'core', 'db', 'queue', 'routes', 'utils', 'scripts']) await walk(dir);
files.push('index.js');
let failed = 0;
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    failed++;
    console.error(`${file}: ${result.error?.message || result.stderr}`);
  }
}
console.log(`Syntax check: ${files.length} files, ${failed} errors.`);
process.exitCode = failed ? 1 : 0;
