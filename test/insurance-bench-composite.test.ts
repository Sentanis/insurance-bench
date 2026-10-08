import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { COMPONENTS, computeComposite, DEFAULT_WEIGHTS, normalizedWeights, validateCompositeData, type Observation, type Weights } from '../insurance-bench/composite.js';
import { renderCompositePage, renderBenchmarkDocs } from '../insurance-bench/composite-site.js';
import { assertCompositeSourceAdmission } from '../insurance-bench/composite-admission.js';

function observation(componentId: Observation['componentId'], score: number, eligible = true): Observation {
  return { id: componentId, modelId: 'model', componentId, benchmark: 'Benchmark', benchmarkVersion: 'frozen-v1', metric: 'accuracy', score,
    origin: 'published', sourceUrl: 'https://example.com/results', sourceLabel: 'Operator', asOf: '2026-10-07', conditions: 'Pinned baseline', caveats: [], eligible };
}
test('complete composite uses the declared weights and remains a bounded index', () => {
  const result = computeComposite('model', COMPONENTS.map((component, index) => observation(component.id, [80, 60, 90, 50, 70][index]!)));
  assert.equal(result.score, 71); assert.equal(result.coverage, 100); assert.equal(result.lowerBound, 71); assert.equal(result.upperBound, 71);
});
test('missing components yield mathematical bounds without renormalization or zero ability', () => {
  const result = computeComposite('model', [observation('legal-agent', 80), observation('legal-reasoning', 60)]);
  assert.equal(result.score, null); assert.equal(result.coverage, 40); assert.equal(result.lowerBound, 29); assert.equal(result.upperBound, 89);
  assert.equal(result.components.documents.score, null);
});
test('actual zero is scored evidence rather than missing', () => {
  const result = computeComposite('model', COMPONENTS.map(component => observation(component.id, 0)));
  assert.equal(result.score, 0); assert.equal(result.coverage, 100); assert.equal(result.upperBound, 0);
});
test('conflicting eligible cohorts fail closed rather than selecting the better score', () => {
  const first = observation('legal-agent', 80); const second = { ...first, id: 'second', score: 90, benchmarkVersion: 'other-cohort' };
  const result = computeComposite('model', [first, second]);
  assert.equal(result.components['legal-agent'].status, 'ambiguous'); assert.equal(result.coverage, 0); assert.equal(result.score, null);
});
test('excluded historical scores remain evidence but contribute no composite points', () => {
  const result = computeComposite('model', [observation('insurance-workflows', 93, false)]);
  assert.equal(result.components['insurance-workflows'].status, 'excluded'); assert.equal(result.lowerBound, 0); assert.equal(result.upperBound, 100);
});
test('global custom weights normalize once and zero-weight components are explicitly omitted', () => {
  const weights: Weights = { ...DEFAULT_WEIGHTS, 'legal-agent': 50, 'legal-reasoning': 0, documents: 0, 'knowledge-work': 0, 'insurance-workflows': 0 };
  assert.equal(normalizedWeights(weights)['legal-agent'], 1); assert.equal(computeComposite('model', [observation('legal-agent', 80)], weights).score, 80);
});
test('invalid weights and out-of-range observed values cannot become scores', () => {
  for (const value of [NaN, Infinity, -1]) assert.throws(() => normalizedWeights({ ...DEFAULT_WEIGHTS, documents: value }));
  assert.throws(() => normalizedWeights(Object.fromEntries(COMPONENTS.map(c => [c.id, 0])) as Weights));
  assert.throws(() => normalizedWeights({ ...DEFAULT_WEIGHTS, hidden: 3 } as Weights));
  for (const value of [NaN, Infinity, -1, 101]) assert.throws(() => computeComposite('model', [observation('documents', value)]));
});
test('different model profiles cannot leak evidence into another row', () => {
  assert.equal(computeComposite('different', [observation('legal-agent', 80)]).coverage, 0);
});
test('unrepresentable positive weights cannot silently omit a required component', () => {
  assert.throws(() => computeComposite('model', [observation('legal-agent', 80)], { 'legal-agent': 1e308, 'legal-reasoning': Number.MIN_VALUE, documents: 0, 'knowledge-work': 0, 'insurance-workflows': 0 }));
});
test('source data requires attributable unique model identities and rejects unsafe source URLs', () => {
  const data = { schemaVersion: 1, asOf: '2026-10-07', models: [{ id: 'model', label: 'Model', provider: 'Provider', profile: 'high', access: 'reference' }], observations: [observation('legal-agent', 80)], benchmarks: [] };
  validateCompositeData(data);
  for (const sourceUrl of ['javascript:alert(1)', 'https://example.com/?token=secret', 'https://user:pass@example.com', 'http://example.com']) assert.throws(() => validateCompositeData({ ...data, observations: [{ ...data.observations[0], sourceUrl }] }));
  assert.throws(() => validateCompositeData({ ...data, observations: [data.observations[0], data.observations[0]] }));
  assert.throws(() => validateCompositeData({ ...data, models: [] }));
  for (const asOf of ['2026-99-99', '2026-02-30', '2025-02-29']) assert.throws(() => validateCompositeData({ ...data, asOf }));
});
test('real curated data keeps source profiles and provenance without false full scores', () => {
  const data: unknown = JSON.parse(readFileSync(new URL('../insurance-bench/composite-data.json', import.meta.url), 'utf8'));
  validateCompositeData(data);
  assert.equal(data.models.length, 212); assert.equal(data.observations.length, 269);
  assert.equal(data.observations.filter(observation => observation.origin === 'local').length, 2);
  for (const model of data.models) {
    const result = computeComposite(model.id, data.observations);
    assert.equal(result.score, null);
    assert.ok(result.lowerBound >= 0 && result.upperBound <= 100 && result.upperBound >= result.lowerBound);
  }
  const fable = data.observations.find(observation => observation.id === 'vals-hlab-claude-fable-5');
  assert.equal(fable?.score, 11.25); assert.equal(fable?.eligible, false);
});
test('renderer keeps excluded recorded values while preventing markup and script injection', () => {
  const data = { schemaVersion: 1 as const, asOf: '2026-10-07', models: [{ id: 'model', label: '</script><img src=x onerror=alert(1)>', provider: 'Provider', profile: 'high', access: 'reference' }], observations: [observation('legal-agent', 11.25, false)], benchmarks: [] };
  const html = renderCompositePage(data);
  assert.match(html, /class="evidence-item"[^]*?<b>11\.3<\/b>/);
  assert.ok(html.includes('Reference only'));
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(html.includes('\\u003c/script\\u003e'));
});
test('documentation explains runnable public releases and private/protocol limits', () => {
  const data: unknown = JSON.parse(readFileSync(new URL('../insurance-bench/composite-data.json', import.meta.url), 'utf8'));
  validateCompositeData(data);
  const html = renderBenchmarkDocs(data);
  for (const expected of ['Harvey Legal Agent Benchmark', 'LegalBench-RAG', 'OmniDocBench', 'GDPval', 'FinQA', 'OCRBench', 'research-only', 'private cohort', '220', '1320']) assert.ok(html.includes(expected), expected);
  const cards = [...html.matchAll(/<article class="benchmark-entry"[^]*?<\/article>/g)].map(match => match[0]);
  assert.equal(cards.length, 8);
  for (const [index, count] of [75, 149, 0, 35, 0, 7, 0, 2].entries()) {
    assert.ok(cards[index]!.includes(count === 0 ? 'No imported scores' : `${count} eligible imported observations`));
  }
});
test('source admission rejects a valid-range score edit before publication and a resealed false projection', () => {
  const target = mkdtempSync(resolve(tmpdir(), 'insurance-composite-admission-'));
  const registrationPath = 'insurance-bench/composite-registration.json';
  const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');
  const registration = JSON.parse(readFileSync(resolve(repoRoot, registrationPath), 'utf8')) as { files: Record<string, string>; nativeFiles: Record<string, string>; nativeAuditFile: string };
  try {
    for (const relative of [registrationPath, ...Object.keys(registration.files), ...Object.keys(registration.nativeFiles), registration.nativeAuditFile]) {
      mkdirSync(dirname(resolve(target, relative)), { recursive: true });
      copyFileSync(resolve(repoRoot, relative), resolve(target, relative));
    }
    assertCompositeSourceAdmission(target);
    const relative = 'insurance-bench/composite-supplemental.json';
    const supplement = JSON.parse(readFileSync(resolve(target, relative), 'utf8')) as { observations: Observation[] };
    supplement.observations[0]!.score = 99;
    writeFileSync(resolve(target, relative), JSON.stringify(supplement));
    assert.throws(() => assertCompositeSourceAdmission(target), /freeze mismatch/);
    registration.files[relative] = createHash('sha256').update(readFileSync(resolve(target, relative))).digest('hex');
    writeFileSync(resolve(target, registrationPath), JSON.stringify(registration));
    assert.throws(() => assertCompositeSourceAdmission(target), /differs from the native published metric/);
    // Resealing a projection cannot relabel unchanged source scores as another component.
    copyFileSync(resolve(repoRoot, relative), resolve(target, relative));
    const reseal = (file: string): void => {
      registration.files[file] = createHash('sha256').update(readFileSync(resolve(target, file))).digest('hex');
      writeFileSync(resolve(target, registrationPath), JSON.stringify(registration));
    };
    const original = JSON.parse(readFileSync(resolve(target, relative), 'utf8')) as { observations: Observation[] };
    original.observations[0]!.componentId = 'knowledge-work';
    writeFileSync(resolve(target, relative), JSON.stringify(original)); reseal(relative);
    assert.throws(() => assertCompositeSourceAdmission(target), /differs from the native published metric/);
    copyFileSync(resolve(repoRoot, relative), resolve(target, relative)); reseal(relative);
    const publishedPath = 'insurance-bench/composite-published.json';
    const published = JSON.parse(readFileSync(resolve(target, publishedPath), 'utf8')) as { observations: Observation[] };
    published.observations[0]!.componentId = 'insurance-workflows';
    writeFileSync(resolve(target, publishedPath), JSON.stringify(published)); reseal(publishedPath);
    assert.throws(() => assertCompositeSourceAdmission(target), /differs from its source receipt/);
    copyFileSync(resolve(repoRoot, publishedPath), resolve(target, publishedPath)); reseal(publishedPath);
    // A new native headline requires a new audit of those exact bytes and episodes.
    const nativePath = Object.keys(registration.nativeFiles)[0]!;
    const native = JSON.parse(readFileSync(resolve(target, nativePath), 'utf8')) as { runId: string; benchmarkScore: number };
    native.benchmarkScore = 99;
    writeFileSync(resolve(target, nativePath), JSON.stringify(native));
    const nativeHash = createHash('sha256').update(readFileSync(resolve(target, nativePath))).digest('hex');
    registration.nativeFiles[nativePath] = nativeHash;
    const localProjection = JSON.parse(readFileSync(resolve(target, relative), 'utf8')) as { observations: Observation[] };
    localProjection.observations.find(row => row.id === native.runId)!.score = 99;
    writeFileSync(resolve(target, relative), JSON.stringify(localProjection)); reseal(relative);
    const receiptPath = 'insurance-bench/results/meta/composite-supplemental-source-receipt.json';
    const receipt = JSON.parse(readFileSync(resolve(target, receiptPath), 'utf8')) as { local: { file: string; score: number; sha256: string }[] };
    const localReceipt = receipt.local.find(row => row.file === nativePath)!;
    localReceipt.score = 99; localReceipt.sha256 = nativeHash;
    writeFileSync(resolve(target, receiptPath), JSON.stringify(receipt)); reseal(receiptPath);
    assert.throws(() => assertCompositeSourceAdmission(target), /independently approved audit panel/);
  } finally { rmSync(target, { recursive: true, force: true }); }
});
