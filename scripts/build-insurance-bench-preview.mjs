import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

// Build only the fictional benchmark report, never the claims application.
const runs = resolve(process.argv[2] ?? 'insurance-bench/results');
execFileSync(process.execPath, ['--import', 'tsx', 'scripts/insurance-bench.ts', 'report', '--runs', runs], { stdio: 'inherit' });
// Exclude any stale application functions or assets from a previous build.
rmSync('.vercel/output', { recursive: true, force: true });
mkdirSync('.vercel/output/static', { recursive: true });
copyFileSync('insurance-bench/site/index.html', '.vercel/output/static/index.html');
writeFileSync('.vercel/output/config.json', JSON.stringify({ version: 3 }) + '\n');
console.log('Static report ready for vercel --prebuilt. Use the dedicated protected insurance-bench project.');
