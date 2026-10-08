/** A reference index over recorded evidence, never an imputation or model ranking. */
export type ComponentId = 'legal-agent' | 'legal-reasoning' | 'documents' | 'knowledge-work' | 'insurance-workflows';
export type Weights = Record<ComponentId, number>;
export interface ComponentDefinition { id: ComponentId; label: string; weight: number; metric: string }
export const COMPONENTS: readonly ComponentDefinition[] = [
  { id: 'legal-agent', label: 'Legal agent work', weight: 25, metric: 'Harvey LAB task all-pass, averaged across two judges' },
  { id: 'legal-reasoning', label: 'Grounded legal reasoning', weight: 15, metric: 'LegalBench accuracy; retrieval diagnostics reported separately' },
  { id: 'documents', label: 'Document understanding', weight: 20, metric: 'OmniDocBench v1.6_full overall score' },
  { id: 'knowledge-work', label: 'Professional work', weight: 20, metric: 'GDPval public gold expert win-or-tie rate' },
  { id: 'insurance-workflows', label: 'Insurance workflows', weight: 20, metric: 'Frozen v0.12 completed-task success; current transport limits remain visible' },
];
export const DEFAULT_WEIGHTS: Weights = { 'legal-agent': 25, 'legal-reasoning': 15, documents: 20, 'knowledge-work': 20, 'insurance-workflows': 20 };
export interface ModelRecord { id: string; label: string; provider: string; profile: string; access: string }
export interface Observation {
  id: string; modelId: string; componentId: ComponentId; benchmark: string; benchmarkVersion: string;
  metric: string; score: number; origin: 'published' | 'local'; sourceUrl: string; sourceLabel: string;
  asOf: string; conditions: string; caveats: string[]; eligible: boolean;
}
export interface BenchmarkDoc {
  id: string; name: string; componentId: ComponentId; description: string; measures: string;
  runability: 'public' | 'subset' | 'local' | 'published-only'; runInstructions: string; grading: string;
  links: { label: string; url: string }[]; caveats: string[];
  observationBenchmarks?: string[];
}
export interface CompositeData { schemaVersion: 1; asOf: string; models: ModelRecord[]; observations: Observation[]; benchmarks: BenchmarkDoc[] }
export interface ComponentResult { score: number | null; observationId: string | null; status: 'scored' | 'missing' | 'ambiguous' | 'excluded' }
export interface CompositeResult {
  score: number | null; lowerBound: number; upperBound: number; coverage: number;
  missingComponents: ComponentId[]; components: Record<ComponentId, ComponentResult>;
}
const ids = new Set<string>(COMPONENTS.map(component => component.id));
export function normalizedWeights(weights: Weights): Weights {
  if (Object.keys(weights).length !== COMPONENTS.length || Object.keys(weights).some(id => !ids.has(id))) throw new Error('Provide exactly the five component weights.');
  const total = COMPONENTS.reduce((sum, { id }) => {
    const weight = weights[id];
    if (!Number.isFinite(weight) || weight < 0) throw new Error('Weights must be finite and nonnegative.');
    return sum + weight;
  }, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error('At least one component needs a positive weight.');
  return Object.fromEntries(COMPONENTS.map(({ id }) => {
    const normalized = weights[id] / total;
    if (weights[id] > 0 && normalized === 0) throw new Error('Positive weights are too small relative to the total to represent reliably.');
    return [id, normalized];
  })) as Weights;
}
export function computeComposite(modelId: string, observations: readonly Observation[], weights: Weights = DEFAULT_WEIGHTS): CompositeResult {
  const normalized = normalizedWeights(weights);
  const components = {} as Record<ComponentId, ComponentResult>;
  const missingComponents: ComponentId[] = [];
  let contribution = 0;
  let missingWeight = 0;
  let coverageWeight = 0;
  for (const { id } of COMPONENTS) {
    const candidates = observations.filter(observation => observation.modelId === modelId && observation.componentId === id);
    for (const candidate of candidates) {
      if (!Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 100) throw new Error('Observed scores must be finite percentages from zero to 100.');
    }
    const eligible = candidates.filter(candidate => candidate.eligible);
    const observed = eligible.length === 1 ? eligible[0] : undefined;
    components[id] = observed
      ? { score: observed.score, observationId: observed.id, status: 'scored' }
      : { score: null, observationId: null, status: eligible.length > 1 ? 'ambiguous' : candidates.length > 0 ? 'excluded' : 'missing' };
    if (normalized[id] === 0) continue;
    if (observed) {
      contribution += normalized[id] * observed.score;
      coverageWeight += normalized[id];
    } else {
      missingComponents.push(id);
      missingWeight += normalized[id];
    }
  }
  const lowerBound = Math.max(0, Math.min(100, contribution));
  const upperBound = Math.max(lowerBound, Math.min(100, contribution + 100 * missingWeight));
  return {
    score: missingComponents.length === 0 ? lowerBound : null,
    lowerBound, upperBound, coverage: Math.max(0, Math.min(100, coverageWeight * 100)), missingComponents, components,
  };
}
function safeUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash; } catch { return false; }
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
/** Fail before rendering malformed, duplicate, orphaned, or unattributed score evidence. */
export function validateCompositeData(input: unknown): asserts input is CompositeData {
  if (!input || typeof input !== 'object') throw new Error('Composite data must be an object.');
  const data = input as CompositeData;
  if (data.schemaVersion !== 1 || !validDate(data.asOf) || !Array.isArray(data.models) || !Array.isArray(data.observations) || !Array.isArray(data.benchmarks)) throw new Error('Invalid composite schema.');
  const modelIds = new Set<string>();
  for (const model of data.models) {
    if (!model || ![model.id, model.label, model.provider, model.profile, model.access].every(value => typeof value === 'string' && value.trim().length > 0) || modelIds.has(model.id)) throw new Error('Model identities must be unique and explicit.');
    modelIds.add(model.id);
  }
  const observationIds = new Set<string>();
  for (const observation of data.observations) {
    if (!observation || !modelIds.has(observation.modelId) || observationIds.has(observation.id) || !ids.has(observation.componentId)
      || ![observation.id, observation.benchmark, observation.benchmarkVersion, observation.metric, observation.sourceLabel, observation.conditions].every(value => typeof value === 'string' && value.trim().length > 0)
      || !Number.isFinite(observation.score) || observation.score < 0 || observation.score > 100
      || !['published', 'local'].includes(observation.origin) || typeof observation.eligible !== 'boolean'
      || !safeUrl(observation.sourceUrl) || !validDate(observation.asOf)
      || !Array.isArray(observation.caveats) || !observation.caveats.every(value => typeof value === 'string')) throw new Error('Invalid or unattributed score observation.');
    observationIds.add(observation.id);
  }
  const benchmarkIds = new Set<string>();
  for (const benchmark of data.benchmarks) {
    if (!benchmark || !ids.has(benchmark.componentId) || benchmarkIds.has(benchmark.id)
      || ![benchmark.id, benchmark.name, benchmark.description, benchmark.measures, benchmark.runInstructions, benchmark.grading].every(value => typeof value === 'string' && value.trim().length > 0)
      || !['public', 'subset', 'local', 'published-only'].includes(benchmark.runability)
      || !Array.isArray(benchmark.links) || benchmark.links.length === 0 || !benchmark.links.every(link => typeof link.label === 'string' && safeUrl(link.url))
      || (benchmark.observationBenchmarks !== undefined && (!Array.isArray(benchmark.observationBenchmarks) || !benchmark.observationBenchmarks.every(value => typeof value === 'string')))
      || !Array.isArray(benchmark.caveats) || !benchmark.caveats.every(value => typeof value === 'string')) throw new Error('Invalid benchmark documentation.');
    benchmarkIds.add(benchmark.id);
  }
}
