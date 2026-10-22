import { readFileSync, readdirSync, cpSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
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
// Verify the frozen publication first; instrumentation is a separate build layer.
await build({ entryPoints: ['scripts/web-analytics.ts'], outfile: 'dist/assets/web-analytics.js', bundle: true, minify: true, format: 'esm', platform: 'browser' });
for (const file of files.filter(file => file.endsWith('.html'))) {
  const path = resolve('dist', file);
  writeFileSync(path, readFileSync(path, 'utf8').replace('</head>', '<script type="module" src="/assets/web-analytics.js"></script></head>'));
}
console.log('Verified ' + files.length + ' frozen publication artifacts and added Web Analytics to the site build.');
