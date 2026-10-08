import { COMPONENTS, DEFAULT_WEIGHTS, computeComposite } from './composite.js';
import type { BenchmarkDoc, ComponentId, CompositeData, Observation } from './composite.js';

const COMPONENT_COUNT = COMPONENTS.length;
const DEFAULT_WEIGHT_TOTAL = COMPONENTS.reduce((sum, { id }) => sum + DEFAULT_WEIGHTS[id], 0);

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function scoreText(score: number | null): string {
  return score === null ? 'Not scored' : `${score.toFixed(1)} / 100`;
}

function weightsPercent(weight: number): string {
  return `${(DEFAULT_WEIGHT_TOTAL > 0 ? (weight / DEFAULT_WEIGHT_TOTAL) * 100 : 0).toFixed(0)}%`;
}

function weightPoints(weight: number): number {
  return DEFAULT_WEIGHT_TOTAL > 0 ? Math.round((weight / DEFAULT_WEIGHT_TOTAL) * 100) : 0;
}

function statusText(status: 'scored' | 'missing' | 'ambiguous' | 'excluded'): string {
  switch (status) {
    case 'scored': return 'Scored';
    case 'ambiguous': return 'Ambiguous';
    case 'excluded': return 'Reference only';
    default: return 'Missing';
  }
}

function coveredCount(components: Record<ComponentId, { status: 'scored' | 'missing' | 'ambiguous' | 'excluded' }>): number {
  return COMPONENTS.filter(({ id }) => components[id]?.status === 'scored').length;
}

function resultSummary(score: number | null, lowerBound: number, upperBound: number, coverage: number, count: number): string {
  const coverageText = `${count} of ${COMPONENT_COUNT} components · ${coverage.toFixed(0)}% weighted coverage`;
  if (score !== null) return `${coverageText} · complete`;
  return `${coverageText} · possible range ${lowerBound.toFixed(1)}–${upperBound.toFixed(1)}`;
}

function evidenceMarkup(data: CompositeData, modelId: string): string {
  const observations = data.observations.filter((item) => item.modelId === modelId);
  if (observations.length === 0) return '<p class="empty-evidence">No observations are recorded for this configuration.</p>';

  const grouped = COMPONENTS.map((component) => {
    const matches = observations.filter((item) => item.componentId === component.id);
    const entries = matches.map((item) => observationMarkup(item)).join('');
    return `<section class="evidence-component"><h3>${escapeHtml(component.label)}</h3>${entries ? `<ul>${entries}</ul>` : '<p class="empty-evidence">No recorded observation.</p>'}</section>`;
  }).join('');
  return `<p class="evidence-intro">Recorded observations for this configuration. Only an eligible, unique observation contributes to a component score; reference-only records remain visible for provenance.</p><div class="evidence-grid">${grouped}</div>`;
}

function observationMarkup(item: Observation): string {
  const url = item.sourceUrl ? safeUrl(item.sourceUrl) : null;
  const source = url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.sourceLabel || item.benchmark)}</a>`
    : escapeHtml(item.sourceLabel || item.benchmark);
  const caveats = item.caveats?.length
    ? `<ul class="caveat-list">${item.caveats.map((caveat) => `<li>${escapeHtml(caveat)}</li>`).join('')}</ul>`
    : '';
  return `<li class="evidence-item"><div class="evidence-item-head"><strong>${source}</strong><span class="origin-tag origin-${escapeHtml(item.origin)}">${item.origin === 'local' ? 'Our run' : 'Published'}</span>${item.eligible ? '<span class="eligibility-tag">Eligible · contributes</span>' : '<span class="reference-tag">Reference only · excluded from composite</span>'}</div><p>${escapeHtml(item.benchmark)} · ${escapeHtml(item.benchmarkVersion)} · ${escapeHtml(item.metric)}: <b>${item.score.toFixed(1)}</b></p><p class="evidence-meta">As of ${escapeHtml(item.asOf)}${item.conditions ? ` · ${escapeHtml(item.conditions)}` : ''}</p>${caveats}</li>`;
}

function shell(title: string, description: string, content: string, active: 'scores' | 'benchmarks', data: CompositeData): string {
  const activeScores = active === 'scores' ? ' aria-current="page"' : '';
  const activeBenchmarks = active === 'benchmarks' ? ' aria-current="page"' : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${escapeHtml(description)}"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/assets/composite.css"></head><body><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><a class="wordmark" href="/" aria-label="Insurance Bench scores">INSURANCE <span>BENCH</span></a><nav aria-label="Primary navigation"><a href="/"${activeScores}>Scores</a><a href="/benchmarks/"${activeBenchmarks}>Benchmarks</a><a href="/self-runs/">Self-runs</a><a href="/research.html">Research archive</a></nav></header>${content}<footer class="site-footer"><p>Insurance Bench · Research snapshot as of ${escapeHtml(data.asOf)}</p><p><a href="/research.html">Research archive</a> · Observations are scoped to their named benchmark, version, origin, and recorded conditions. They do not establish insurance suitability or general model capability.</p></footer><script id="composite-data" type="application/json">${jsonForScript(data)}</script>${active === 'scores' ? '<script src="/assets/composite.js" defer></script>' : ''}</body></html>`;
}

function snapshotCounts(data: CompositeData): { complete: number; eligible: number } {
  const complete = data.models.reduce((total, model) => {
    return total + (computeComposite(model.id, data.observations, DEFAULT_WEIGHTS).score === null ? 0 : 1);
  }, 0);
  return {
    complete,
    eligible: data.observations.filter((item) => item.eligible).length,
  };
}

function modelRow(data: CompositeData, modelIndex: number): string {
  const model = data.models[modelIndex];
  if (!model) return '';
  const result = computeComposite(model.id, data.observations, DEFAULT_WEIGHTS);
  const count = coveredCount(result.components);
  const detailId = `evidence-${modelIndex}`;
  const componentCells = COMPONENTS.map(({ id }) => {
    const component = result.components[id];
    const score = component?.score === null || component?.score === undefined ? '—' : component.score.toFixed(1);
    return `<td class="component-cell" data-component-cell="${escapeHtml(id)}"><span class="component-reading">${score}</span><span class="component-status status-${escapeHtml(component?.status ?? 'missing')}">${escapeHtml(statusText(component?.status ?? 'missing'))}</span></td>`;
  }).join('');
  const state = result.score === null ? 'Incomplete' : 'Complete';
  return `<tr class="model-row" data-model-row data-model-id="${escapeHtml(model.id)}" data-provider="${escapeHtml(model.provider)}"><th scope="row" class="model-name"><span>${escapeHtml(model.label)}</span><span class="model-profile">${escapeHtml(model.profile)}</span><button class="evidence-toggle" type="button" aria-expanded="false" aria-controls="${detailId}">Inspect evidence</button></th><td class="provider-cell"><strong>${escapeHtml(model.provider)}</strong><span>${escapeHtml(model.access)}</span></td><td class="composite-cell"><strong data-cell="canonical-score">${escapeHtml(scoreText(result.score))}</strong><span class="result-note" data-cell="canonical-note">${escapeHtml(resultSummary(result.score, result.lowerBound, result.upperBound, result.coverage, count))}</span><span class="result-state ${result.score === null ? 'state-incomplete' : 'state-complete'}" data-cell="canonical-state">${state}</span></td><td class="custom-cell"><strong data-cell="custom-score">${escapeHtml(scoreText(result.score))}</strong><span class="result-note" data-cell="custom-note">Matches canonical weights</span></td>${componentCells}</tr><tr class="detail-row" id="${detailId}" hidden><td colspan="${4 + COMPONENT_COUNT}"><div class="evidence-panel"><h2>Observation record · ${escapeHtml(model.label)}</h2>${evidenceMarkup(data, model.id)}</div></td></tr>`;
}

export function renderCompositePage(data: CompositeData): string {
  const counts = snapshotCounts(data);
  const blocked = data.models.length - counts.complete;
  const completeText = counts.complete === 0
    ? `No configuration has complete eligible coverage in this snapshot; all ${data.models.length} remain unscored.`
    : `${counts.complete} of ${data.models.length} configurations have complete eligible coverage; ${blocked} remain unscored.`;
  const providers = [...new Set(data.models.map((model) => model.provider))].sort((a, b) => a.localeCompare(b));
  const rows = data.models.map((_, index) => modelRow(data, index)).join('');
  const componentHeaders = COMPONENTS.map(({ id, label, metric }) => `<th scope="col" title="${escapeHtml(metric)}"><span>${escapeHtml(label)}</span><small>${escapeHtml(metric)}</small></th>`).join('');
  const componentWeights = COMPONENTS.map(({ id, label }) => `<div class="weight-control"><label for="weight-${escapeHtml(id)}">${escapeHtml(label)} <output data-weight-share="${escapeHtml(id)}">${weightsPercent(DEFAULT_WEIGHTS[id])}</output></label><input id="weight-${escapeHtml(id)}" type="range" min="0" max="100" step="1" value="${weightPoints(DEFAULT_WEIGHTS[id])}" data-weight-input="${escapeHtml(id)}" aria-label="${escapeHtml(label)} relative weight"><span class="weight-unit">relative points</span></div>`).join('');

  const content = `<main id="main" class="page-shell"><section class="lead" aria-labelledby="page-title"><p class="eyebrow">A measured view of insurance work</p><h1 id="page-title">Model scores, with their evidence attached.</h1><p class="lead-copy">A composite across five insurance-work components, built from versioned observations and explicit coverage rules. Every score can be traced to its source and conditions.</p></section><section class="data-ribbon" aria-label="Snapshot status"><div><span>Configurations</span><strong>${data.models.length}</strong></div><div><span>Complete composites</span><strong>${counts.complete} / ${data.models.length}</strong></div><div><span>Eligible observations</span><strong>${counts.eligible}</strong></div><div class="ribbon-date"><span>Snapshot as of</span><strong>${escapeHtml(data.asOf)}</strong></div></section><p class="coverage-callout" role="status">${escapeHtml(completeText)}</p><section class="weight-workbench" aria-labelledby="weight-heading"><div class="workbench-intro"><div><p class="eyebrow">Transparent calculation</p><h2 id="weight-heading">Adjust the global weights</h2><p>Positive weights are normalized once across the selected components and stay fixed across models. A custom view is a sensitivity check; the canonical score remains beside it.</p></div><button type="button" class="quiet-button" data-reset-weights>Reset to canonical</button></div><div class="weight-controls">${componentWeights}</div><p class="weight-status" data-weight-status aria-live="polite">Canonical weights are active. Custom views use the same selected weights for every configuration.</p><ul class="canonical-key" aria-label="Canonical component weights">${COMPONENTS.map(({ id, label }) => `<li><span>${escapeHtml(label)}</span><strong>${weightsPercent(DEFAULT_WEIGHTS[id])}</strong></li>`).join('')}</ul></section><section class="score-section" aria-labelledby="score-heading"><div class="section-heading"><div><p class="eyebrow">Score matrix</p><h2 id="score-heading">Observed configurations</h2></div><p>${escapeHtml(completeText)}</p></div><form class="filters" aria-label="Filter score matrix" onsubmit="return false"><label class="search-filter">Search configurations<input type="search" data-filter-search placeholder="Model, provider, or profile"></label><label>Provider<select data-filter-provider><option value="all">All providers</option>${providers.map((provider) => `<option value="${escapeHtml(provider)}">${escapeHtml(provider)}</option>`).join('')}</select></label><label>Observation origin<select data-filter-origin><option value="all">All origins</option><option value="published">Published sources</option><option value="local">Our runs</option></select></label><label>Coverage<select data-filter-coverage><option value="all">Any coverage</option><option value="complete">Complete composite</option><option value="incomplete">Incomplete or ambiguous</option></select></label></form><p class="filter-explanation">Changing the origin filter recomputes coverage from the matching observations. The evidence panel retains all recorded references.</p><div class="table-scroll" tabindex="0" role="region" aria-label="Horizontally scrollable insurance model score table"><table class="score-table"><caption>Composite scores and component observations by model configuration</caption><thead><tr><th scope="col" class="model-heading">Model configuration</th><th scope="col">Provider / access</th><th scope="col">Canonical composite</th><th scope="col">Custom view</th>${componentHeaders}</tr></thead><tbody>${rows}<tr class="empty-row" data-empty-row hidden><td colspan="${4 + COMPONENT_COUNT}">No configurations match these filters.</td></tr></tbody></table></div><p class="table-hint">On a narrow screen, scroll the table horizontally to inspect the component columns.</p><p class="matrix-count" data-matrix-count aria-live="polite">Showing ${data.models.length} of ${data.models.length} configurations.</p></section><section class="method-note" aria-labelledby="method-heading"><h2 id="method-heading">How to read these scores</h2><p>A complete composite requires one eligible, unique observation for every positive-weight component. Missing observations are not zeroes. Incomplete rows show mathematical bounds on a possible composite; those bounds are not confidence intervals and do not support a full-score ranking.</p><p>Scores summarize the named observation under its benchmark version and recorded conditions. They do not establish provider-wide capability, product readiness, or insurance suitability.</p><a href="/benchmarks/">Read benchmark definitions and run instructions <span aria-hidden="true">→</span></a></section></main>`;
  return shell('Insurance Bench — Composite scores', 'Inspectable insurance benchmark composites with coverage, provenance, and adjustable global weights.', content, 'scores', data);
}

function listContent(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  return value ? [value] : [];
}

function benchmarkMarkup(doc: BenchmarkDoc, data: CompositeData, index: number): string {
  const component = COMPONENTS.find((item) => item.id === doc.componentId);
  const observedBenchmarks = new Set(doc.observationBenchmarks ?? []);
  const eligibleCount = data.observations.filter((item) => observedBenchmarks.has(item.benchmark) && item.eligible).length;
  const importedCount = eligibleCount > 0
    ? `${eligibleCount} eligible imported observation${eligibleCount === 1 ? '' : 's'}`
    : 'No imported scores';
  const measures = listContent(doc.measures);
  const links = doc.links.map((link) => {
    const url = safeUrl(link.url);
    return url ? `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)} <span aria-hidden="true">↗</span></a></li>` : `<li>${escapeHtml(link.label)} · link unavailable</li>`;
  }).join('');
  const caveats = doc.caveats.length ? `<ul class="caveats">${doc.caveats.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>No additional caveats are recorded.</p>';
  return `<article class="benchmark-entry" id="benchmark-${index + 1}"><div class="benchmark-index">${String(index + 1).padStart(2, '0')}</div><div class="benchmark-body"><div class="benchmark-meta"><span>${escapeHtml(component?.label ?? doc.componentId)}</span><span class="runability runability-${escapeHtml(doc.runability)}">${escapeHtml(doc.runability.replaceAll('-', ' '))}</span><span>${importedCount}</span></div><h2>${escapeHtml(doc.name)}</h2><p class="benchmark-description">${escapeHtml(doc.description)}</p><div class="benchmark-details"><section><h3>What it measures</h3>${measures.length ? `<ul>${measures.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>No measure description is recorded.</p>'}</section><section><h3>How to run</h3><p>${escapeHtml(doc.runInstructions)}</p></section><section><h3>Native grading</h3><p>${escapeHtml(doc.grading)}</p></section><section><h3>Access and interpretation</h3>${caveats}</section></div>${links ? `<div class="benchmark-links"><h3>Source materials</h3><ul>${links}</ul></div>` : ''}</div></article>`;
}

export function renderBenchmarkDocs(data: CompositeData): string {
  const counts = snapshotCounts(data);
  const blocked = data.models.length - counts.complete;
  const summary = counts.complete === 0
    ? `This snapshot contains ${data.models.length} configurations and ${counts.eligible} eligible observations. None has complete eligible coverage across all positive-weight components, so no canonical composite is scored.`
    : `This snapshot contains ${data.models.length} configurations and ${counts.eligible} eligible observations. ${counts.complete} configurations have complete eligible coverage; ${blocked} do not receive a canonical score.`;
  const coverageRows = COMPONENTS.map((component) => {
    const eligible = data.observations.filter((item) => item.componentId === component.id && item.eligible).length;
    const recorded = data.observations.filter((item) => item.componentId === component.id).length;
    return `<tr><th scope="row">${escapeHtml(component.label)}</th><td>${weightsPercent(DEFAULT_WEIGHTS[component.id])}</td><td>${escapeHtml(component.metric)}</td><td>${eligible} eligible / ${recorded} recorded</td></tr>`;
  }).join('');
  const entries = data.benchmarks.map((doc, index) => benchmarkMarkup(doc, data, index)).join('');
  const content = `<main id="main" class="page-shell docs-page"><section class="lead" aria-labelledby="page-title"><p class="eyebrow">Methods and source catalog</p><h1 id="page-title">What each benchmark measures.</h1><p class="lead-copy">Definitions, native grading, run access, and known limits for the five components in the composite.</p></section><p class="coverage-callout" role="status">${escapeHtml(summary)}</p><section class="scope-explainer" aria-labelledby="scope-heading"><div><p class="eyebrow">Scope boundary</p><h2 id="scope-heading">A model observation is not a whole-system verdict.</h2></div><p>Each score is tied to a named benchmark, version, origin, and recorded conditions. A model result describes that observation. A configured system may also include tools, prompts, retrieval, or workflow controls; those are only measured when the observation expressly includes them. Access labels describe whether a benchmark is public, available as a subset, locally run, or published-only; they do not imply provider endpoint access.</p></section><section class="coverage-section" aria-labelledby="coverage-heading"><div class="section-heading"><div><p class="eyebrow">Composite specification</p><h2 id="coverage-heading">Components and canonical weights</h2></div><p>Weights are global and normalized once. Per-model gaps do not redistribute weight.</p></div><div class="coverage-table-wrap"><table class="coverage-table"><caption>Canonical component weights and eligible observation counts in this snapshot</caption><thead><tr><th scope="col">Component</th><th scope="col">Weight</th><th scope="col">Native measure</th><th scope="col">Coverage</th></tr></thead><tbody>${coverageRows}</tbody></table></div></section><section class="benchmark-catalog" aria-labelledby="catalog-heading"><div class="section-heading"><div><p class="eyebrow">Benchmark catalog</p><h2 id="catalog-heading">Protocols and access notes</h2></div><p>${data.benchmarks.length} benchmark definition${data.benchmarks.length === 1 ? '' : 's'}</p></div>${entries || '<p>No benchmark definitions are recorded in this snapshot.</p>'}</section><section class="method-note"><h2>Composite scoring rules</h2><p>A component contributes only when exactly one eligible observation exists. Missing components are not zeroes; ambiguous duplicates are unscored. Incomplete composites receive mathematical lower and upper bounds, not confidence intervals. The canonical score remains blocked until every positive-weight component has eligible, unique coverage.</p><a href="/">Return to the score matrix <span aria-hidden="true">→</span></a></section></main>`;
  return shell('Insurance Bench — Benchmark methods', 'Insurance benchmark component definitions, protocols, grading, access limits, and composite methodology.', content, 'benchmarks', data);
}
