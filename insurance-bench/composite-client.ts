import { COMPONENTS, DEFAULT_WEIGHTS, computeComposite } from './composite.js';
import type { ComponentId, CompositeData, CompositeResult, Weights } from './composite.js';

const WEIGHT_TOTAL = COMPONENTS.reduce((sum, { id }) => sum + DEFAULT_WEIGHTS[id], 0);

function canonicalShare(weight: number): number {
  return WEIGHT_TOTAL > 0 ? (weight / WEIGHT_TOTAL) * 100 : 0;
}

function displayScore(score: number | null): string {
  return score === null ? 'Not scored' : `${score.toFixed(1)} / 100`;
}

function displayStatus(status: 'scored' | 'missing' | 'ambiguous' | 'excluded'): string {
  if (status === 'scored') return 'Scored';
  if (status === 'ambiguous') return 'Ambiguous';
  if (status === 'excluded') return 'Reference only';
  return 'Missing';
}

function scoredCount(result: CompositeResult): number {
  return COMPONENTS.filter(({ id }) => result.components[id]?.status === 'scored').length;
}

function boundsText(result: CompositeResult, count: number): string {
  const coverage = `${count} of ${COMPONENTS.length} components · ${result.coverage.toFixed(0)}% weighted coverage`;
  return result.score === null
    ? `${coverage} · possible range ${result.lowerBound.toFixed(1)}–${result.upperBound.toFixed(1)}`
    : `${coverage} · complete`;
}

function node<T extends Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

function boot(): void {
  const dataNode = document.getElementById('composite-data');
  const statusNode = document.querySelector<HTMLElement>('[data-weight-status]');
  if (!dataNode || !statusNode) return;

  let data: CompositeData;
  try {
    data = JSON.parse(dataNode.textContent ?? '') as CompositeData;
  } catch {
    statusNode.textContent = 'The embedded score snapshot could not be read.';
    return;
  }

  const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('[data-model-row]'));
  const search = node<HTMLInputElement>(document, '[data-filter-search]');
  const providerFilter = node<HTMLSelectElement>(document, '[data-filter-provider]');
  const originFilter = node<HTMLSelectElement>(document, '[data-filter-origin]');
  const coverageFilter = node<HTMLSelectElement>(document, '[data-filter-coverage]');
  const emptyRow = node<HTMLTableRowElement>(document, '[data-empty-row]');
  const countNode = node<HTMLElement>(document, '[data-matrix-count]');
  const resetButton = node<HTMLButtonElement>(document, '[data-reset-weights]');
  const weightInputs = new Map<ComponentId, HTMLInputElement>();
  const previousValidValues = new Map<ComponentId, string>();
  let customTouched = false;
  let currentCustomWeights: Weights = { ...DEFAULT_WEIGHTS };

  for (const { id } of COMPONENTS) {
    const input = node<HTMLInputElement>(document, `[data-weight-input="${id}"]`);
    if (!input) continue;
    const initial = String(Math.round(canonicalShare(DEFAULT_WEIGHTS[id])));
    input.value = initial;
    input.setAttribute('aria-valuetext', `${initial}% relative weight`);
    weightInputs.set(id, input);
    previousValidValues.set(id, initial);
  }

  function selectedObservations(): CompositeData['observations'] {
    const origin = originFilter?.value ?? 'all';
    return origin === 'all' ? data.observations : data.observations.filter((item) => item.origin === origin);
  }

  function readCustomWeights(): Weights | null {
    const values = Object.fromEntries(COMPONENTS.map(({ id }) => [id, Number(weightInputs.get(id)?.value ?? '0')])) as Weights;
    const sum = COMPONENTS.reduce((total, { id }) => total + values[id], 0);
    return Number.isFinite(sum) && sum > 0 ? values : null;
  }

  function updateWeightsDisplay(weights: Weights): void {
    const total = COMPONENTS.reduce((sum, { id }) => sum + weights[id], 0);
    for (const { id } of COMPONENTS) {
      const share = total > 0 ? (weights[id] / total) * 100 : 0;
      const output = node<HTMLOutputElement>(document, `[data-weight-share="${id}"]`);
      if (output) output.textContent = `${share.toFixed(0)}%`;
      const input = weightInputs.get(id);
      if (input) input.setAttribute('aria-valuetext', `${share.toFixed(0)}% effective global weight`);
    }
  }

  function setCellText(row: HTMLTableRowElement, selector: string, value: string): void {
    const cell = node<HTMLElement>(row, selector);
    if (cell) cell.textContent = value;
  }

  function componentLabel(id: ComponentId): string {
    return COMPONENTS.find((component) => component.id === id)?.label ?? id;
  }

  function updateRow(modelId: string, row: HTMLTableRowElement, observations: CompositeData['observations'], customWeights: Weights): CompositeResult {
    const canonical = computeComposite(modelId, observations, DEFAULT_WEIGHTS);
    const custom = computeComposite(modelId, observations, customWeights);
    const canonicalCoverage = scoredCount(canonical);
    const customCoverage = scoredCount(custom);
    const selectedComponents = COMPONENTS.filter(({ id }) => customWeights[id] > 0);
    const includedCoverage = selectedComponents.filter(({ id }) => custom.components[id]?.status === 'scored').length;

    setCellText(row, '[data-cell="canonical-score"]', displayScore(canonical.score));
    setCellText(row, '[data-cell="canonical-note"]', boundsText(canonical, canonicalCoverage));
    const canonicalState = node<HTMLElement>(row, '[data-cell="canonical-state"]');
    if (canonicalState) {
      canonicalState.textContent = canonical.score === null ? 'Incomplete' : 'Complete';
      canonicalState.className = `result-state ${canonical.score === null ? 'state-incomplete' : 'state-complete'}`;
    }

    setCellText(row, '[data-cell="custom-score"]', displayScore(custom.score));
    const customNote = !customTouched
      ? 'Matches canonical weights'
      : `${includedCoverage} of ${selectedComponents.length} weighted components · ${custom.coverage.toFixed(0)}% weighted coverage · ${selectedComponents.length < COMPONENTS.length ? 'custom subset' : customCoverage === COMPONENTS.length ? 'all components included' : 'incomplete coverage'}`;
    setCellText(row, '[data-cell="custom-note"]', customNote);

    for (const { id } of COMPONENTS) {
      const component = canonical.components[id];
      const cell = node<HTMLElement>(row, `[data-component-cell="${id}"]`);
      if (!cell) continue;
      const reading = node<HTMLElement>(cell, '.component-reading');
      const state = node<HTMLElement>(cell, '.component-status');
      if (reading) reading.textContent = component.score === null ? '—' : component.score.toFixed(1);
      if (state) {
        state.textContent = displayStatus(component.status);
        state.className = `component-status status-${component.status}`;
      }
    }

    const customLabel = custom.score === null
      ? `No custom score · ${includedCoverage}/${selectedComponents.length} weighted components`
      : `Custom ${custom.score.toFixed(1)} / 100 · ${includedCoverage}/${selectedComponents.length} weighted components`;
    const customCell = node<HTMLElement>(row, '[data-cell="custom-score"]');
    if (customCell) customCell.setAttribute('aria-label', customLabel);
    return canonical;
  }

  function updateMatrix(): void {
    const observations = selectedObservations();
    const origin = originFilter?.value ?? 'all';
    const provider = providerFilter?.value ?? 'all';
    const query = (search?.value ?? '').trim().toLocaleLowerCase();
    const coverageMode = coverageFilter?.value ?? 'all';
    let visible = 0;
    let complete = 0;
    const customWeights = currentCustomWeights;

    for (const row of rows) {
      const modelId = row.dataset.modelId ?? '';
      const model = data.models.find((item) => item.id === modelId);
      if (!model) {
        row.hidden = true;
        continue;
      }
      const selectedForModel = observations.filter((item) => item.modelId === modelId);
      const originMatches = origin === 'all' || selectedForModel.length > 0;
      const providerMatches = provider === 'all' || model.provider === provider;
      const searchText = `${model.label} ${model.provider} ${model.profile}`.toLocaleLowerCase();
      const searchMatches = !query || searchText.includes(query);
      const canonical = updateRow(modelId, row, observations, customWeights);
      const coverageMatches = coverageMode === 'all'
        || (coverageMode === 'complete' && canonical.score !== null)
        || (coverageMode === 'incomplete' && canonical.score === null);
      const visibleRow = originMatches && providerMatches && searchMatches && coverageMatches;
      row.hidden = !visibleRow;
      const detail = document.getElementById(node<HTMLButtonElement>(row, '.evidence-toggle')?.getAttribute('aria-controls') ?? '');
      if (detail) detail.hidden = !visibleRow || !node<HTMLButtonElement>(row, '.evidence-toggle')?.getAttribute('aria-expanded')?.includes('true');
      if (visibleRow) {
        visible += 1;
        if (canonical.score !== null) complete += 1;
      }
    }

    if (emptyRow) emptyRow.hidden = visible !== 0;
    if (countNode) {
      const originName = origin === 'all' ? 'all origins' : origin === 'local' ? 'our runs' : 'published sources';
      countNode.textContent = `Showing ${visible} of ${data.models.length} configurations · ${complete} complete at ${originName}.`;
    }
  }

  for (const row of rows) {
    const button = node<HTMLButtonElement>(row, '.evidence-toggle');
    if (!button) continue;
    button.addEventListener('click', () => {
      const detailId = button.getAttribute('aria-controls');
      const detail = detailId ? document.getElementById(detailId) : null;
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      button.textContent = expanded ? 'Inspect evidence' : 'Close evidence';
      if (detail) detail.hidden = expanded;
    });
  }

  for (const control of [search, providerFilter, originFilter, coverageFilter]) {
    control?.addEventListener('input', updateMatrix);
    control?.addEventListener('change', updateMatrix);
  }

  for (const { id, label } of COMPONENTS) {
    const input = weightInputs.get(id);
    if (!input) continue;
    input.addEventListener('input', () => {
      const candidate = readCustomWeights();
      if (!candidate) {
        input.value = previousValidValues.get(id) ?? '0';
        statusNode.textContent = 'At least one component must keep a positive weight.';
        return;
      }
      currentCustomWeights = candidate;
      previousValidValues.set(id, input.value);
      customTouched = true;
      updateWeightsDisplay(currentCustomWeights);
      statusNode.textContent = `${label} weight changed. The displayed custom view uses globally normalized weights across every configuration.`;
      updateMatrix();
    });
  }

  resetButton?.addEventListener('click', () => {
    currentCustomWeights = { ...DEFAULT_WEIGHTS };
    customTouched = false;
    for (const { id } of COMPONENTS) {
      const input = weightInputs.get(id);
      if (!input) continue;
      const value = String(Math.round(canonicalShare(DEFAULT_WEIGHTS[id])));
      input.value = value;
      previousValidValues.set(id, value);
    }
    updateWeightsDisplay(currentCustomWeights);
    statusNode.textContent = 'Canonical weights are active. Custom views use the same selected weights for every configuration.';
    updateMatrix();
  });

  updateWeightsDisplay(DEFAULT_WEIGHTS);
  updateMatrix();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
