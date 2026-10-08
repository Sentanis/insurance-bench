import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { COMPONENTS, DEFAULT_WEIGHTS, computeComposite, validateCompositeData, type CompositeData, type ModelRecord, type Observation } from '../insurance-bench/composite.js';
import { renderCompositePage, renderBenchmarkDocs } from '../insurance-bench/composite-site.js';
import { assertCompositeSourceAdmission } from '../insurance-bench/composite-admission.js';

// Public numeric facts + hash-bound fictional native scores only. No env, DB or model calls.
const root = resolve('insurance-bench');
const admission = assertCompositeSourceAdmission(resolve('.'));
const published = JSON.parse(readFileSync(resolve(root, 'composite-published.json'), 'utf8')) as { models: ModelRecord[]; observations: Observation[] };
const supplemental = JSON.parse(readFileSync(resolve(root, 'composite-supplemental.json'), 'utf8')) as typeof published;
// Independent operator cohorts have unverified snapshot/effort equivalence. Keep
// them as source-qualified profiles instead of inventing aliases from punctuation.
for (const model of supplemental.models) {
  if (model.id.startsWith('local-')) continue;
  const originalId = model.id;
  const ownObservation = supplemental.observations.find(observation => observation.modelId === originalId);
  if (!ownObservation) throw new Error('Supplemental model has no source evidence.');
  const prefix = ownObservation.benchmark === 'OmniDocBench' ? 'omnidoc-v16-' : 'gdpval-gold-2025-';
  model.id = prefix + originalId;
  for (const observation of supplemental.observations) if (observation.modelId === originalId) observation.modelId = model.id;
}
const byId = new Map<string, ModelRecord>();
for (const model of [...published.models, ...supplemental.models]) {
  const existing = byId.get(model.id);
  if (existing && existing.label !== model.label) throw new Error(`A source model label collides: ${model.id}`);
  if (!existing) byId.set(model.id, model);
}
const data: CompositeData = {
  schemaVersion: 1, asOf: '2026-10-07', models: [...byId.values()].sort((left, right) => left.label.localeCompare(right.label)),
  observations: [...published.observations, ...supplemental.observations],
  benchmarks: JSON.parse(readFileSync(resolve(root, 'composite-docs.json'), 'utf8')) as CompositeData['benchmarks'],
};
validateCompositeData(data);
const summaries = data.models.map(model => ({ modelId: model.id, ...computeComposite(model.id, data.observations) }));
const assembled = JSON.stringify(data, null, 2) + '\n';
writeFileSync(resolve(root, 'composite-data.json'), assembled);
// Separate output tree. The previously accepted research HTML stays byte-identical.
const output = resolve('.vercel/output');
rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, 'static/benchmarks'), { recursive: true });
mkdirSync(resolve(output, 'static/assets'), { recursive: true });
writeFileSync(resolve(output, 'config.json'), JSON.stringify({ version: 3 }) + '\n');
writeFileSync(resolve(output, 'static/index.html'), renderCompositePage(data));
writeFileSync(resolve(output, 'static/benchmarks/index.html'), renderBenchmarkDocs(data));
writeFileSync(resolve(output, 'static/scores.json'), assembled);
copyFileSync(resolve(root, 'composite.css'), resolve(output, 'static/assets/composite.css'));
copyFileSync(resolve(root, 'site/index.html'), resolve(output, 'static/research.html'));
await build({ entryPoints: [resolve(root, 'composite-client.ts')], outfile: resolve(output, 'static/assets/composite.js'), bundle: true, format: 'esm', target: 'es2022', minify: true, sourcemap: false });
const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');
const receipt = {
  schemaVersion: 1, asOf: data.asOf, modelProfiles: data.models.length, observations: data.observations.length,
  eligibleObservations: data.observations.filter(observation => observation.eligible).length,
  fullCanonicalScores: summaries.filter(summary => summary.score !== null).length,
  components: COMPONENTS, defaultWeights: DEFAULT_WEIGHTS,
  sourceCounts: Object.fromEntries([...new Set(data.observations.map(observation => observation.benchmark))].map(benchmark => [benchmark, data.observations.filter(observation => observation.benchmark === benchmark).length])),
  dataSha256: sha256(resolve(root, 'composite-data.json')),
  scoreHtmlSha256: sha256(resolve(output, 'static/index.html')), docsHtmlSha256: sha256(resolve(output, 'static/benchmarks/index.html')),
  scriptSha256: sha256(resolve(output, 'static/assets/composite.js')), cssSha256: sha256(resolve(output, 'static/assets/composite.css')),
  retainedResearchHtmlSha256: sha256(resolve(output, 'static/research.html')),
  newModelOrJudgeCalls: 0, sensitiveInputs: 0, summaries,
  ...admission,
};
writeFileSync(resolve(root, 'results/meta/composite-build-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ modelProfiles: receipt.modelProfiles, observations: receipt.observations, fullCanonicalScores: receipt.fullCanonicalScores, sourceCounts: receipt.sourceCounts, dataSha256: receipt.dataSha256 }));
