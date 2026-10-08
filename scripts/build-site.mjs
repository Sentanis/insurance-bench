import { readFileSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';

const root = resolve('public');
const manifest = JSON.parse(readFileSync('publication.json', 'utf8')).artifacts;
const files = readdirSync(root, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile()).map(entry => relative(root, resolve(entry.parentPath, entry.name))).sort();
if (JSON.stringify(files) !== JSON.stringify(Object.keys(manifest).sort())) throw new Error('Publication file list differs from the recorded deployment.');
for (const file of files) {
  const hash = createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');
  if (hash !== manifest[file]) throw new Error('Publication hash mismatch: ' + file);
}
rmSync('dist', { recursive: true, force: true });
cpSync('public', 'dist', { recursive: true });
console.log('Verified and built ' + files.length + ' exact static deployment artifacts.');
