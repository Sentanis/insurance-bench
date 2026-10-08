/// <reference lib="dom" />
type Effort = 'low' | 'high' | 'max';
type Sample = { model: string; effort: Effort; score: number; elapsed: number; cost: number | null };

const rows = [...document.querySelectorAll<HTMLTableRowElement>('[data-selfrun-row]')];
const modelChart = document.querySelector<HTMLSelectElement>('[data-selfrun-model]');
const modelTable = document.querySelector<HTMLSelectElement>('[data-selfrun-model-table]');
const effortChart = [...document.querySelectorAll<HTMLInputElement>('[data-selfrun-effort]')];
const effortTable = [...document.querySelectorAll<HTMLInputElement>('[data-selfrun-effort-table]')];
const statusSelect = document.querySelector<HTMLSelectElement>('[data-selfrun-status]');
const axisSelect = document.querySelector<HTMLSelectElement>('[data-selfrun-axis]');
const chart = document.querySelector<SVGSVGElement>('[data-selfrun-chart]');
const legend = document.querySelector<HTMLUListElement>('[data-selfrun-legend]');
const emptyChart = document.querySelector<HTMLElement>('[data-chart-empty]');
const chartNote = document.querySelector<HTMLElement>('[data-chart-note]');
const COLORS = ['#146b8c', '#b45137', '#477a55', '#745aa5', '#aa7621', '#167b78', '#bb5477', '#515f6c', '#6a7d20', '#0073ad', '#bd6334', '#548d93', '#8f4d8f', '#6870a9', '#8f6b52', '#337653', '#c64d54', '#3d749d'];
const effortOrder: Effort[] = ['low', 'high', 'max'];
const svgNs = 'http://www.w3.org/2000/svg';
const number = (value: number, digits = 0): string => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const valueOf = (value: string | undefined): number | null => value && Number.isFinite(Number(value)) ? Number(value) : null;

function selectedEfforts(inputs: HTMLInputElement[]): Set<string> {
  return new Set(inputs.filter(input => input.checked).map(input => input.value));
}
function currentRows(model: string | null, efforts: Set<string>, requireScore = false): HTMLTableRowElement[] {
  return rows.filter(row => (model === null || row.dataset.model === model) && efforts.has(row.dataset.effort ?? '') &&
    (!requireScore || (row.dataset.status === 'completed' && valueOf(row.dataset.score) !== null)));
}
function filterTable(): void {
  const model = modelTable?.value ?? 'all';
  const efforts = selectedEfforts(effortTable);
  let visible = 0;
  for (const row of rows) {
    const matches = (model === 'all' || row.dataset.model === model) && efforts.has(row.dataset.effort ?? '') &&
      (!statusSelect || statusSelect.value === 'all' || row.dataset.status === statusSelect.value);
    row.hidden = !matches;
    if (matches) visible++;
  }
  const empty = document.querySelector<HTMLTableRowElement>('[data-selfrun-empty]');
  if (empty) empty.hidden = visible !== 0;
  const count = document.querySelector('[data-selfrun-count]');
  if (count) count.textContent = `Showing ${visible} of ${rows.length} profiles.`;
}
function node(name: string, attrs: Record<string, string>, parent: SVGElement): SVGElement {
  const item = document.createElementNS(svgNs, name);
  for (const [key, value] of Object.entries(attrs)) item.setAttribute(key, value);
  parent.append(item);
  return item;
}
function text(parent: SVGElement, content: string, attrs: Record<string, string>): void {
  const item = node('text', attrs, parent);
  item.textContent = content;
}
function drawChart(): void {
  if (!chart) return;
  chart.replaceChildren();
  const model = modelChart?.value ?? 'all';
  const efforts = selectedEfforts(effortChart);
  const axis = axisSelect?.value === 'cost' ? 'cost' : 'time';
  const samples: Sample[] = currentRows(model === 'all' ? null : model, efforts, true).flatMap(row => {
    const score = valueOf(row.dataset.score);
    const elapsed = valueOf(row.dataset.elapsedMs);
    const cost = valueOf(row.dataset.costUsd);
    const x = axis === 'cost' ? cost : elapsed;
    if (score === null || x === null) return [];
    return [{ model: row.dataset.model ?? '', effort: (row.dataset.effort ?? 'low') as Effort, score, elapsed: elapsed ?? 0, cost }];
  });
  node('title', { id: 'chart-title' }, chart).textContent = 'Composite score by measured efficiency';
  node('desc', { id: 'chart-description' }, chart).textContent = `Complete model profiles only. Horizontal axis: ${axis === 'time' ? 'sum of request time in minutes' : 'reported API cost in dollars'}. Vertical axis: composite score from zero to one hundred. Colors identify models; marker shapes identify effort.`;
  if (!samples.length) {
    if (emptyChart) emptyChart.hidden = false;
    if (legend) legend.replaceChildren();
    return;
  }
  if (emptyChart) emptyChart.hidden = true;
  const width = 1000, height = 430, left = 86, right = 34, top = 28, bottom = 70;
  const plotW = width - left - right, plotH = height - top - bottom;
  const maxXRaw = Math.max(...samples.map(sample => axis === 'time' ? sample.elapsed / 60000 : sample.cost ?? 0));
  const maxX = maxXRaw <= 0 ? 1 : Math.ceil(maxXRaw / 5) * 5;
  const x = (sample: Sample): number => left + ((axis === 'time' ? sample.elapsed / 60000 : sample.cost ?? 0) / maxX) * plotW;
  const y = (sample: Sample): number => top + ((100 - sample.score) / 100) * plotH;
  const grid = node('g', { class: 'chart-grid' }, chart);
  for (let tick = 0; tick <= 5; tick++) {
    const px = left + (tick / 5) * plotW;
    node('line', { x1: `${px}`, y1: `${top}`, x2: `${px}`, y2: `${top + plotH}` }, grid);
    text(grid, number(maxX * tick / 5, 1), { x: `${px}`, y: `${top + plotH + 23}`, 'text-anchor': 'middle' });
  }
  for (let score = 0; score <= 100; score += 20) {
    const py = top + ((100 - score) / 100) * plotH;
    node('line', { x1: `${left}`, y1: `${py}`, x2: `${left + plotW}`, y2: `${py}` }, grid);
    text(grid, `${score}`, { x: `${left - 18}`, y: `${py + 4}`, 'text-anchor': 'end' });
  }
  node('line', { x1: `${left}`, y1: `${top + plotH}`, x2: `${left + plotW}`, y2: `${top + plotH}`, class: 'chart-axis' }, chart);
  node('line', { x1: `${left}`, y1: `${top}`, x2: `${left}`, y2: `${top + plotH}`, class: 'chart-axis' }, chart);
  text(chart, axis === 'time' ? 'Sum of request time (minutes)' : 'Reported API cost (USD)', { x: `${left + plotW / 2}`, y: `${height - 14}`, class: 'chart-axis-label', 'text-anchor': 'middle' });
  text(chart, 'Composite score', { transform: `translate(24 ${top + plotH / 2}) rotate(-90)`, class: 'chart-axis-label', 'text-anchor': 'middle' });

  const byModel = new Map<string, Sample[]>();
  for (const sample of samples) byModel.set(sample.model, [...(byModel.get(sample.model) ?? []), sample]);
  const modelNames = [...byModel.keys()].sort((a, b) => a.localeCompare(b));
  const colors = new Map(modelNames.map((name, index) => [name, COLORS[index % COLORS.length]!]));
  const series = node('g', { class: 'chart-series' }, chart);
  for (const name of modelNames) {
    const modelSamples = byModel.get(name)!.sort((a, b) => effortOrder.indexOf(a.effort) - effortOrder.indexOf(b.effort));
    if (modelSamples.length > 1) {
      node('polyline', { points: modelSamples.map(sample => `${x(sample)},${y(sample)}`).join(' '), stroke: colors.get(name)!, class: 'chart-connection' }, series);
    }
    for (const sample of modelSamples) {
      const group = node('g', { class: 'chart-point', tabindex: '0', role: 'img', 'aria-label': `${name}, ${sample.effort} effort, score ${sample.score.toFixed(1)}, ${axis === 'time' ? `${(sample.elapsed / 60000).toFixed(1)} minutes` : `$${(sample.cost ?? 0).toFixed(2)}`}` }, series);
      const cx = `${x(sample)}`, cy = `${y(sample)}`, color = colors.get(name)!;
      if (sample.effort === 'high') node('rect', { x: `${x(sample) - 6}`, y: `${y(sample) - 6}`, width: '12', height: '12', fill: color, class: 'chart-marker' }, group);
      else if (sample.effort === 'max') node('path', { d: `M ${cx} ${y(sample) - 7} L ${x(sample) + 7} ${cy} L ${cx} ${y(sample) + 7} L ${x(sample) - 7} ${cy} Z`, fill: color, class: 'chart-marker' }, group);
      else node('circle', { cx, cy, r: '6', fill: color, class: 'chart-marker' }, group);
      const title = node('title', {}, group);
      title.textContent = `${name} · ${sample.effort} · ${sample.score.toFixed(1)} · ${axis === 'time' ? `${(sample.elapsed / 60000).toFixed(1)} min` : `$${(sample.cost ?? 0).toFixed(2)}`}`;
    }
  }
  if (legend) {
    legend.replaceChildren();
    for (const name of modelNames) {
      const item = document.createElement('li');
      const swatch = document.createElement('span'); swatch.className = 'legend-swatch'; swatch.style.backgroundColor = colors.get(name)!; swatch.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.textContent = name;
      item.append(swatch, label); legend.append(item);
    }
  }
  if (chartNote) chartNote.textContent = efforts.size === 1
    ? `${[...efforts][0]!.replace(/^./, character => character.toUpperCase())} effort is selected. Add another effort to show model lines.`
    : 'Each model has its own color; circle, square, and diamond markers represent low, high, and max effort. Lines join the selected effort levels.';
}

for (const input of [...effortChart, ...effortTable]) input.addEventListener('change', () => {
  const from = input.hasAttribute('data-selfrun-effort') ? effortChart : effortTable;
  const to = from === effortChart ? effortTable : effortChart;
  const selected = selectedEfforts(from);
  for (const peer of to) peer.checked = selected.has(peer.value);
  filterTable(); drawChart();
});
modelChart?.addEventListener('change', () => { if (modelTable) modelTable.value = modelChart.value; filterTable(); drawChart(); });
modelTable?.addEventListener('change', () => { if (modelChart) modelChart.value = modelTable.value; filterTable(); drawChart(); });
statusSelect?.addEventListener('change', filterTable);
axisSelect?.addEventListener('change', drawChart);
document.querySelector<HTMLFormElement>('.selfrun-filters')?.addEventListener('submit', event => event.preventDefault());
filterTable(); drawChart();

export {};
