/** Static publication boundary. Never serialize coordinator/task objects directly. */
export const SELF_RUN_COMPONENTS = [
  { id: 'legal-agent', label: 'Legal agent', description: 'Adapted Harvey text artifacts' },
  { id: 'legal-reasoning', label: 'Legal reasoning', description: '18-case LegalBench subset' },
  { id: 'documents', label: 'Documents', description: 'Original fictional OCR tasks' },
  { id: 'knowledge-work', label: 'Professional work', description: 'Original fictional work products' },
  { id: 'insurance-workflows', label: 'Insurance workflows', description: 'Fresh synthetic stateful episodes' },
] as const;
const MODELS = ['gpt-6.1-sol', 'gpt-6-sol', 'gpt-6-luna', 'gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-luna'] as const;
const EFFORTS = ['low', 'high', 'max'] as const;
const WEIGHTS = { 'legal-agent': 25, 'legal-reasoning': 15, documents: 20, 'knowledge-work': 20, 'insurance-workflows': 20 } as const;
export const SELF_RUN_TASK_COUNTS = { 'legal-agent': 3, 'legal-reasoning': 18, documents: 4, 'knowledge-work': 4, 'insurance-workflows': 3 } as const;
const LIMITS = { maxTurns: 20, maxActions: 20, requestTimeoutMs: 600_000, maxParallelProfiles: 3, candidateTasks: 32 } as const;
type ComponentId = typeof SELF_RUN_COMPONENTS[number]['id'];
type Effort = typeof EFFORTS[number];
type Usage = { inputTokens: number; cachedInputTokens: number; outputTokens: number; reasoningTokens?: number };
type PublicComponent = { score: number | null; completed: number; expected: number };
export interface PublicSelfRunProfile {
  model: string; effort: Effort; status: 'not-attempted' | 'running' | 'completed' | 'stopped-access';
  components: Record<ComponentId, PublicComponent>; score: number | null; coverage: number;
  tokenUsage: Usage | null; judgeTokenUsage: Usage | null; elapsedMs: number; costUsd: number | null;
  attempts?: { completed: number; expected: number; measured: number; gaps: number; claimed: number; requestStarted: number; requestFinished: number };
}
export interface PublicSelfRunData {
  protocol: 'matched-selfrun-v1'; cohortId: string; sourceSha: string;
  registeredProfiles: { id: string; model: string; effort: Effort }[];
  profiles: PublicSelfRunProfile[]; weights: Record<ComponentId, number>;
  limits: { maxTurns: number; maxActions: number; requestTimeoutMs: number; maxParallelProfiles: number; candidateTasks: number };
}
function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value as Record<string, unknown>;
}
function numeric(value: unknown, name: string, max: number, integer = false, min = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) throw new Error(`Invalid ${name}`);
  return value;
}
function score(value: unknown, name: string): number | null { return value === null ? null : numeric(value, name, 100); }
function identity(value: unknown, name: string, allowed: readonly string[]): string {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(`Invalid ${name}`);
  return value;
}
function usage(value: unknown, name: string): Usage | null {
  if (value === null) return null;
  const raw = object(value, name);
  const result: Usage = {
    inputTokens: numeric(raw.inputTokens, `${name} input`, 1e12, true),
    cachedInputTokens: numeric(raw.cachedInputTokens, `${name} cached input`, 1e12, true),
    outputTokens: numeric(raw.outputTokens, `${name} output`, 1e12, true),
  };
  if (result.cachedInputTokens > result.inputTokens) throw new Error(`Cached input exceeds input in ${name}`);
  if (raw.reasoningTokens !== undefined) {
    result.reasoningTokens = numeric(raw.reasoningTokens, `${name} reasoning`, 1e12, true);
    if (result.reasoningTokens > result.outputTokens) throw new Error(`Reasoning exceeds output in ${name}`);
  }
  return result;
}
/** Validates an offline summary and creates a fresh allow-listed object. Private fields are discarded. */
export function publicSelfRunData(input: unknown): PublicSelfRunData {
  const raw = object(input, 'self-run summary');
  if (raw.protocol !== 'matched-selfrun-v1') throw new Error('Unsupported self-run protocol');
  if (typeof raw.cohortId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(raw.cohortId)) throw new Error('Invalid cohort ID');
  if (typeof raw.sourceSha !== 'string' || !/^[a-f0-9]{64}$/.test(raw.sourceSha)) throw new Error('Invalid source SHA-256');
  if (!Array.isArray(raw.registeredProfiles) || raw.registeredProfiles.length !== 18 || !Array.isArray(raw.profiles) || raw.profiles.length !== 18) throw new Error('The matched cohort must contain all 18 profiles');
  const registeredProfiles = raw.registeredProfiles.map(value => {
    const item = object(value, 'registered profile');
    const model = identity(item.model, 'model', MODELS);
    const effort = identity(item.effort, 'effort', EFFORTS) as Effort;
    if (item.id !== `${model}-${effort}`) throw new Error('Profile identity mismatch');
    return { id: item.id, model, effort };
  });
  const expectedIds = new Set(MODELS.flatMap(model => EFFORTS.map(effort => `${model}-${effort}`)));
  if (new Set(registeredProfiles.map(profile => profile.id)).size !== 18 || registeredProfiles.some(profile => !expectedIds.has(profile.id))) throw new Error('Duplicate or missing registered profile');
  const rawWeights = object(raw.weights, 'weights');
  const weights = Object.fromEntries(SELF_RUN_COMPONENTS.map(({ id }) => [id, numeric(rawWeights[id], `weight ${id}`, 100, false, 0.000001)])) as PublicSelfRunData['weights'];
  if (SELF_RUN_COMPONENTS.some(({ id }) => weights[id] !== WEIGHTS[id])) throw new Error('Weights must match the frozen matched-selfrun-v1 protocol');
  const rawLimits = object(raw.limits, 'limits');
  const limits = {
    maxTurns: numeric(rawLimits.maxTurns, 'turn limit', 1000, true, 1),
    maxActions: numeric(rawLimits.maxActions, 'action limit', 1000, true, 1),
    requestTimeoutMs: numeric(rawLimits.requestTimeoutMs, 'request timeout', 3_600_000, true, 1),
    maxParallelProfiles: numeric(rawLimits.maxParallelProfiles, 'parallel limit', 18, true, 1),
    candidateTasks: numeric(rawLimits.candidateTasks, 'task count', 10000, true, 1),
  };
  if (Object.entries(LIMITS).some(([key, value]) => limits[key as keyof typeof limits] !== value)) throw new Error('Limits must match the frozen matched-selfrun-v1 protocol');
  const profiles = raw.profiles.map(value => {
    const item = object(value, 'profile');
    const model = identity(item.model, 'model', MODELS);
    const effort = identity(item.effort, 'effort', EFFORTS) as Effort;
    const status = identity(item.status, 'status', ['not-attempted', 'running', 'completed', 'stopped-access']) as PublicSelfRunProfile['status'];
    const rawComponents = object(item.components, 'components');
    const components = Object.fromEntries(SELF_RUN_COMPONENTS.map(({ id }) => {
      const component = object(rawComponents[id], `component ${id}`);
      const completed = numeric(component.completed, `${id} measured tasks`, 10000, true);
      const expected = numeric(component.expected, `${id} expected tasks`, 10000, true, 1);
      if (expected !== SELF_RUN_TASK_COUNTS[id]) throw new Error(`Wrong canonical task count for ${id}`);
      const result = { completed, expected, score: score(component.score, `${id} score`) };
      if (completed > expected || (result.score !== null && completed !== expected)) throw new Error(`Incomplete ${id} cannot have a score`);
      return [id, result];
    })) as PublicSelfRunProfile['components'];
    const totals = Object.values(components).reduce((sum, component) => ({ completed: sum.completed + component.completed, expected: sum.expected + component.expected }), { completed: 0, expected: 0 });
    const coverage = numeric(item.coverage, 'coverage', 1);
    if (totals.expected !== limits.candidateTasks || Math.abs(coverage - totals.completed / totals.expected) > 1e-8) throw new Error('Coverage/task count mismatch');
    const composite = score(item.score, 'composite score');
    if (composite !== null) {
      if (status !== 'completed' || coverage !== 1 || SELF_RUN_COMPONENTS.some(({ id }) => components[id].score === null)) throw new Error('Only complete admitted profiles receive a composite');
      const recomputed = SELF_RUN_COMPONENTS.reduce((sum, { id }) => sum + components[id].score! * weights[id] / 100, 0);
      if (Math.abs(composite - recomputed) > 1e-6) throw new Error('Composite does not match component weights');
    }
    const profile: PublicSelfRunProfile = { model, effort, status, components, score: composite, coverage, tokenUsage: usage(item.tokenUsage, 'candidate usage'), judgeTokenUsage: usage(item.judgeTokenUsage, 'jury usage'), elapsedMs: numeric(item.elapsedMs, 'elapsed time', 365 * 24 * 60 * 60 * 1000), costUsd: item.costUsd === null ? null : numeric(item.costUsd, 'cost', 1e6) };
    if (item.attempts !== undefined) {
      const attempts = object(item.attempts, 'attempt counts');
      profile.attempts = {
        completed: numeric(attempts.completed, 'finished tasks', 10000, true), expected: numeric(attempts.expected, 'expected tasks', 10000, true),
        measured: numeric(attempts.measured, 'measured tasks', 10000, true), gaps: numeric(attempts.gaps, 'task gaps', 10000, true),
        claimed: numeric(attempts.claimed, 'claimed tasks', 10000, true), requestStarted: numeric(attempts.requestStarted, 'requests started', 1e6, true), requestFinished: numeric(attempts.requestFinished, 'requests finished', 1e6, true),
      };
      const a = profile.attempts;
      if (a.expected !== totals.expected || a.measured !== totals.completed || a.completed !== a.measured + a.gaps || a.completed > a.expected || a.claimed > a.expected || a.requestFinished > a.requestStarted) throw new Error('Inconsistent attempt counts');
    }
    return profile;
  });
  if (new Set(profiles.map(profile => `${profile.model}-${profile.effort}`)).size !== 18) throw new Error('Duplicate result profile');
  profiles.sort((a, b) => MODELS.indexOf(a.model as typeof MODELS[number]) - MODELS.indexOf(b.model as typeof MODELS[number]) || EFFORTS.indexOf(a.effort) - EFFORTS.indexOf(b.effort));
  return { protocol: 'matched-selfrun-v1', cohortId: raw.cohortId, sourceSha: raw.sourceSha, registeredProfiles, profiles, weights, limits };
}
const html = (value: unknown): string => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const number = (value: number): string => value.toLocaleString('en-US');
const scoreText = (value: number | null): string => value === null ? 'Unscored' : value.toFixed(1);
function usageMarkup(value: Usage | null): string {
  if (value === null) return '<span class="selfrun-unavailable">Unavailable</span>';
  return `<strong>${number(value.inputTokens + value.outputTokens)} total</strong><span>${number(value.inputTokens)} input · ${number(value.outputTokens)} output</span><span>${number(value.cachedInputTokens)} cached input (included in input)</span>${value.reasoningTokens === undefined ? '<span>Reasoning breakdown unavailable</span>' : `<span>${number(value.reasoningTokens)} reasoning (included in output)</span>`}`;
}
function elapsedText(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
function row(profile: PublicSelfRunProfile, index: number): string {
  const measured = Object.values(profile.components).reduce((sum, component) => sum + component.completed, 0);
  const expected = Object.values(profile.components).reduce((sum, component) => sum + component.expected, 0);
  const state = { 'not-attempted': 'Not attempted', running: 'Running', completed: 'Run finished', 'stopped-access': 'Stopped: access gap' }[profile.status];
  const cells = SELF_RUN_COMPONENTS.map(({ id, label }) => {
    const component = profile.components[id];
    return `<td class="selfrun-component"><span class="sr-only">${html(label)}: </span><strong>${scoreText(component.score)}</strong><span>${component.completed} / ${component.expected} measured</span></td>`;
  }).join('');
  const progress = profile.attempts ? `<span>${profile.attempts.completed} tasks finished · ${profile.attempts.gaps} recorded gaps</span><span>${profile.attempts.requestFinished} / ${profile.attempts.requestStarted} requests finished</span>` : '';
  return `<tr data-selfrun-row data-model="${html(profile.model)}" data-effort="${profile.effort}" data-status="${profile.status}" data-score="${profile.score ?? ''}" data-elapsed-ms="${profile.elapsedMs}" data-cost-usd="${profile.costUsd ?? ''}" class="${index % 3 === 0 ? 'selfrun-group-start' : ''}"><th scope="row" class="selfrun-model"><span>${html(profile.model)}</span><span class="selfrun-effort">${profile.effort} effort</span></th><td class="selfrun-result"><strong>${scoreText(profile.score)}${profile.score === null ? '' : ' / 100'}</strong><span class="selfrun-status status-${profile.status}">${state}</span><span>${measured} / ${expected} measured · ${(profile.coverage * 100).toFixed(0)}% task coverage</span>${progress}</td>${cells}<td class="selfrun-usage">${usageMarkup(profile.tokenUsage)}</td><td class="selfrun-usage">${usageMarkup(profile.judgeTokenUsage)}</td><td class="selfrun-time"><strong>${profile.status === 'not-attempted' ? 'Not attempted' : elapsedText(profile.elapsedMs)}</strong><span>Sum of request time</span><span>${profile.costUsd === null ? 'Cost unavailable' : `$${profile.costUsd.toFixed(2)} reported cost`}</span></td></tr>`;
}
export function renderSelfRunPage(input: unknown): string {
  const data = publicSelfRunData(input);
  const scored = data.profiles.filter(profile => profile.score !== null).length;
  const running = data.profiles.filter(profile => profile.status === 'running').length;
  const stopped = data.profiles.filter(profile => profile.status === 'stopped-access').length;
  const measured = data.profiles.reduce((sum, profile) => sum + Object.values(profile.components).reduce((count, component) => count + component.completed, 0), 0);
  const models = [...new Set(data.profiles.map(profile => profile.model))];
  const hasCost = data.profiles.some(profile => profile.costUsd !== null);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Matched self-run insurance benchmark profiles, with measured coverage, access gaps, and actual CLI token usage."><title>Insurance Bench — Matched self-runs</title><link rel="stylesheet" href="/assets/composite.css"><link rel="stylesheet" href="/assets/selfrun.css"></head><body class="selfrun-page"><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><a class="wordmark" href="/">INSURANCE <span>BENCH</span></a><nav aria-label="Primary navigation"><a href="/">Scores</a><a href="/benchmarks/">Benchmarks</a><a href="/self-runs/" aria-current="page">Self-runs</a><a href="/research.html">Research archive</a></nav></header><main id="main" class="page-shell"><section class="lead"><h1>Same tasks.<br>Measured at each effort.</h1><p class="lead-copy">Compare score and measured completion time across model effort settings, then inspect the component scores and run evidence below.</p></section><div class="data-ribbon" aria-label="Cohort progress"><div><span>Matched profiles</span><strong>${data.registeredProfiles.length}</strong></div><div><span>Admitted composites</span><strong>${scored} / ${data.profiles.length}</strong></div><div><span>Measured tasks</span><strong>${measured} / ${data.profiles.length * data.limits.candidateTasks}</strong></div><div><span>Run state</span><strong>${running} running · ${stopped} stopped</strong></div></div><p class="coverage-callout">${data.profiles.length - scored} profiles remain unscored. Missing, interrupted, and inaccessible tasks are gaps, never zeroes. A composite appears only after every required task has a measured score and the profile has finished.</p><section class="selfrun-scope" aria-labelledby="scope-heading"><h2 id="scope-heading">A new, adapted measurement</h2><p>This cohort combines a public LegalBench subset, adapted Harvey legal artifacts, original fictional OCR and professional tasks, and fresh synthetic stateful insurance episodes. It does not report original OmniDocBench, GDPval, full LegalBench, or native Harvey benchmark scores; it does not establish professional validity or an index rank.</p><p>The <a href="/">published-reference index</a> remains a separate research view. Other providers appear only when exact model identity, effort configuration, and full task coverage are verified.</p><p><strong>Model identity:</strong> rows name the model and effort configured in the run, with provider evidence where available.</p></section><section class="score-section selfrun-analysis" aria-labelledby="analysis-heading"><div class="section-heading"><div><h2 id="analysis-heading">Score and efficiency</h2></div><p>Only complete composite scores appear as points. Lines connect effort settings for the same model.</p></div><div class="selfrun-plot-controls"><label>Compare model<select data-selfrun-model><option value="all">All models</option>${models.map(model => `<option value="${html(model)}">${html(model)}</option>`).join('')}</select></label><fieldset class="effort-picker"><legend>Effort levels</legend>${EFFORTS.map(level => `<label><input type="checkbox" data-selfrun-effort value="${level}"${level === 'high' ? ' checked' : ''}>${level[0]!.toUpperCase()}${level.slice(1)}</label>`).join('')}</fieldset><label>Horizontal axis<select data-selfrun-axis><option value="time">Elapsed time</option><option value="cost"${hasCost ? '' : ' disabled'}>Reported API cost${hasCost ? '' : ' (not available)'}</option></select></label></div><div class="selfrun-chart-frame"><svg class="selfrun-chart" data-selfrun-chart role="img" aria-labelledby="chart-title chart-description" viewBox="0 0 1000 430"></svg><p class="selfrun-chart-empty" data-chart-empty hidden>No complete scores match these selections yet.</p></div><ul class="selfrun-legend" data-selfrun-legend aria-label="Model color legend"></ul><p class="chart-note" data-chart-note>High effort is selected for the initial cross-model view. Select Low and High together to show the score-effort path for each model.</p></section><section class="score-section" aria-labelledby="matrix-heading"><div class="section-heading"><div><h2 id="matrix-heading">Matched profile matrix</h2></div><p>Component scores use fixed ${SELF_RUN_COMPONENTS.map(({ id }) => data.weights[id]).join('/')} weights. No partial composite ranking.</p></div><form class="filters selfrun-filters" aria-label="Filter matched profiles"><label>Compare model<select data-selfrun-model-table><option value="all">All models</option>${models.map(model => `<option value="${html(model)}">${html(model)}</option>`).join('')}</select></label><fieldset class="effort-picker effort-filter"><legend>Effort levels</legend>${EFFORTS.map(level => `<label><input type="checkbox" data-selfrun-effort-table value="${level}"${level === 'high' ? ' checked' : ''}>${level[0]!.toUpperCase()}${level.slice(1)}</label>`).join('')}</fieldset><label>Run state<select data-selfrun-status><option value="all">All states</option><option value="not-attempted">Not attempted</option><option value="running">Running</option><option value="completed">Run finished</option><option value="stopped-access">Stopped: access gap</option></select></label></form><div class="table-scroll" tabindex="0" role="region" aria-label="Horizontally scrollable matched self-run table"><table class="score-table selfrun-table"><caption>Scores, measured task coverage, actual candidate and jury tokens, and elapsed request time by configured model and effort</caption><thead><tr><th scope="col" class="selfrun-model">Configured model / effort</th><th scope="col">Composite / progress</th>${SELF_RUN_COMPONENTS.map(({ label, description, id }) => `<th scope="col"><span>${html(label)}</span><small>${html(description)} · ${data.weights[id]}%</small></th>`).join('')}<th scope="col">Candidate tokens<small>Actual CLI usage</small></th><th scope="col">Jury tokens<small>Separate grading usage</small></th><th scope="col">Request time / cost</th></tr></thead><tbody>${data.profiles.map(row).join('')}<tr data-selfrun-empty hidden><td colspan="10">No profiles match these filters.</td></tr></tbody></table></div><p class="table-hint">Scroll horizontally to compare component coverage and token usage. Cached input is an included subset of input; reasoning is an included subset of output. Neither is added again to total tokens.</p><p class="matrix-count" data-selfrun-count aria-live="polite">Showing ${data.profiles.length} of ${data.profiles.length} profiles.</p><noscript><p>All ${data.profiles.length} profiles are shown. Filters require JavaScript.</p></noscript></section><section class="method-note selfrun-method" aria-labelledby="method-heading"><h2 id="method-heading">Frozen conditions and interpretation</h2><p>LegalBench uses one fresh batch in frozen order per profile. Other static tasks use a fresh request per task. Stateful episodes start fresh and carry the chronological public interaction history between turns. No retries or fallback models are admitted.</p><p>Two fixed blinded juries grade valid adapted Harvey artifacts; original criteria are evaluated with all-pass scoring per jury and their mean. Other tasks use all-pass grading. Task means form each component; fixed component weights form a complete composite. Expert validation remains open.</p><p>Each native episode permits ${data.limits.maxTurns} turns, with up to ${data.limits.maxActions} actions per response (${data.limits.maxTurns * data.limits.maxActions} actions maximum per episode). Request timeout: ${number(data.limits.requestTimeoutMs / 1000)} seconds. Maximum simultaneous profiles: ${data.limits.maxParallelProfiles}. Elapsed time sums candidate and jury request durations and is not cohort wall-clock time. Costs are unavailable unless an explicit numeric cost is reported.</p><p>Only public headline metrics are exported. Candidate transcripts, answers, expected outputs, hidden rubrics, source fixtures, and grader diagnostics remain outside this static site.</p><dl class="selfrun-provenance"><dt>Cohort</dt><dd>${html(data.cohortId)}</dd><dt>Protocol</dt><dd>${data.protocol}</dd><dt>Frozen source SHA-256</dt><dd>${data.sourceSha}</dd></dl><a href="/self-runs/selfrun-data.json">Download public summary JSON</a></section></main><footer class="site-footer"><p>Insurance Bench · Matched self-run cohort</p><p>These measurements describe this frozen synthetic/adapted subset under its recorded conditions.</p></footer><script src="/assets/selfrun.js" defer></script></body></html>`;
}
