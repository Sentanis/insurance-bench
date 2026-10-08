import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { publicSelfRunData, renderSelfRunPage, SELF_RUN_COMPONENTS, SELF_RUN_TASK_COUNTS } from '../insurance-bench/selfrun-site.ts';

function cohort() {
  const models = ['gpt-6.1-sol', 'gpt-6-sol', 'gpt-6-luna', 'gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-luna'];
  const registeredProfiles = models.flatMap(model => ['low', 'high', 'max'].map(effort => ({ id: `${model}-${effort}`, model, effort })));
  return {
    protocol: 'matched-selfrun-v1', cohortId: 'offline-ui-regression', sourceSha: 'a'.repeat(64), registeredProfiles,
    weights: { 'legal-agent': 25, 'legal-reasoning': 15, documents: 20, 'knowledge-work': 20, 'insurance-workflows': 20 },
    limits: { maxTurns: 20, maxActions: 20, requestTimeoutMs: 600_000, maxParallelProfiles: 3, candidateTasks: 32 },
    profiles: registeredProfiles.map(({ model, effort }) => ({
      model, effort, status: 'not-attempted',
      components: Object.fromEntries(SELF_RUN_COMPONENTS.map(({ id }) => [id, { score: null as number | null, completed: 0, expected: SELF_RUN_TASK_COUNTS[id], diagnostics: ['PRIVATE_GRADER_MARKER'] }])),
      score: null as number | null, coverage: 0, tokenUsage: null as null | { inputTokens: number; cachedInputTokens: number; outputTokens: number; reasoningTokens?: number }, judgeTokenUsage: null, elapsedMs: 0, costUsd: null,
      transcript: 'PRIVATE_TRANSCRIPT_MARKER', expected: 'PRIVATE_EXPECTED_MARKER',
    })),
    contextPolicy: 'PRIVATE_CONTEXT_MARKER', qualifications: ['PRIVATE_QUALIFICATION_MARKER'],
  };
}

test('public projection removes private content and renders canonical task/action budgets', () => {
  const data = publicSelfRunData(cohort());
  const page = renderSelfRunPage(data);
  assert.equal(data.profiles.length, 18);
  assert.deepEqual(Object.values(data.profiles[0]!.components).map(component => component.expected), [3, 18, 4, 4, 3]);
  assert(!JSON.stringify(data).includes('PRIVATE_'));
  assert(!page.includes('PRIVATE_'));
  assert(page.includes('20 actions per response (400 actions maximum per episode)'));
  assert(page.includes('Cost unavailable'));
  assert(page.includes('Not attempted'));
});

test('renderer rejects forged protocol, redistributed task counts, and altered frozen limits', () => {
  const protocol = cohort(); protocol.protocol = 'forged-protocol';
  assert.throws(() => renderSelfRunPage(protocol), /protocol/);
  const counts = cohort(); counts.profiles[0]!.components.documents!.expected = 3; counts.profiles[0]!.components['insurance-workflows']!.expected = 4;
  assert.throws(() => renderSelfRunPage(counts), /canonical task count/);
  const limits = cohort(); limits.limits.maxActions = 19;
  assert.throws(() => renderSelfRunPage(limits), /frozen/);
});

test('scores require full completed coverage and exact fixed-weight arithmetic', () => {
  const forged = cohort(); forged.profiles[0]!.score = 80;
  assert.throws(() => publicSelfRunData(forged), /complete admitted/);
  const full = cohort(); const profile = full.profiles[0]!;
  profile.status = 'completed'; profile.coverage = 1; profile.score = 80;
  for (const component of Object.values(profile.components)) { component.completed = component.expected; component.score = 80; }
  assert.equal(publicSelfRunData(full).profiles[0]!.score, 80);
  profile.score = 81;
  assert.throws(() => publicSelfRunData(full), /component weights/);
});

test('cached and reasoning tokens are included subsets, with unavailable cost kept null', () => {
  const input = cohort(); input.profiles[0]!.tokenUsage = { inputTokens: 100, cachedInputTokens: 50, outputTokens: 20, reasoningTokens: 10 };
  const data = publicSelfRunData(input);
  assert.equal(data.profiles[0]!.costUsd, null);
  assert(renderSelfRunPage(data).includes('120 total'));
  input.profiles[0]!.tokenUsage.cachedInputTokens = 101;
  assert.throws(() => publicSelfRunData(input), /Cached input exceeds input/);
  input.profiles[0]!.tokenUsage.cachedInputTokens = 50; input.profiles[0]!.tokenUsage.reasoningTokens = 21;
  assert.throws(() => publicSelfRunData(input), /Reasoning exceeds output/);
});

test('matched comparison renders a model-effort scatter plot and defaults to cross-model high effort', () => {
  const input = cohort();
  const profile = input.profiles[0]!;
  profile.status = 'completed'; profile.coverage = 1; profile.score = 80; profile.elapsedMs = 120_000;
  for (const component of Object.values(profile.components)) { component.completed = component.expected; component.score = 80; }
  const page = renderSelfRunPage(input);
  assert(page.includes('data-selfrun-chart'));
  assert(page.includes('data-selfrun-model-table'));
  assert(page.includes('data-selfrun-effort-table value="high" checked'));
  assert(page.includes('data-score="80" data-elapsed-ms="120000" data-cost-usd=""'));
  assert(page.includes('Reported API cost (not available)'));
  assert(page.includes('Select Low and High together'));
});

test('publication CLI refuses arbitrary summary JSON before admission or output writes', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/build-insurance-bench-selfrun.ts', '--data', '/nonexistent-untrusted-summary.json'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--data publication is prohibited/);
  assert(!result.stderr.includes('ENOENT'));
});
