import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { publicSelfRunData, renderSelfRunPage } from '../insurance-bench/selfrun-site.ts';

// Offline receipt admission/regrade only. This command never invokes a provider.
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--root') throw new Error('Usage: tsx scripts/build-insurance-bench-selfrun.ts --root <frozen-cohort-directory>; --data publication is prohibited');
const cohortRoot = resolve(args[1]!);
const { admitSelfRunPublication } = await import('../insurance-bench/selfrun-coordinator.ts');
const data = publicSelfRunData(await admitSelfRunPublication(cohortRoot));
const output = resolve('.vercel/output');
// Require the existing six static artifacts; never rebuild or replace the archive/index.
for (const path of ['config.json', 'static/index.html', 'static/benchmarks/index.html', 'static/research.html', 'static/scores.json', 'static/assets/composite.css', 'static/assets/composite.js']) {
  if (!existsSync(resolve(output, path)) || !statSync(resolve(output, path)).isFile()) throw new Error('Run the composite static builder first; missing ' + path);
}
if (JSON.parse(readFileSync(resolve(output, 'config.json'), 'utf8')).version !== 3 || existsSync(resolve(output, 'functions'))) throw new Error('Self-runs require the existing static-only Vercel output');
mkdirSync(resolve(output, 'static/self-runs'), { recursive: true });
await build({ entryPoints: [resolve('insurance-bench/selfrun-client.ts')], outfile: resolve(output, 'static/assets/selfrun.js'), bundle: true, format: 'esm', target: 'es2022', minify: true, sourcemap: false });
copyFileSync(resolve('insurance-bench/selfrun.css'), resolve(output, 'static/assets/selfrun.css'));
writeFileSync(resolve(output, 'static/self-runs/selfrun-data.json'), JSON.stringify(data, null, 2) + '\n');
writeFileSync(resolve(output, 'static/self-runs/index.html'), renderSelfRunPage(data));
console.log(JSON.stringify({ cohortId: data.cohortId, profiles: data.profiles.length, admittedComposites: data.profiles.filter(profile => profile.score !== null).length, staticOnly: true, newModelOrJudgeCalls: 0 }));
