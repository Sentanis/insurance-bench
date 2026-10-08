import { createWorkflowEnvironment, gradeWorkflowTask } from './allocation-interaction-workflows.ts';
import { evaluateCoupledPlan, type CoupledTask } from './dependency-allocation-core.ts';
import type { WorkflowState } from './workflow-types.ts';
import type { TaskScore } from './types.ts';

// The common environment records the submitted business fields and real mutation history.
// The adapter never supplies the optimizer's answer to model-facing tools.
export const createCoupledEnvironment = (task: CoupledTask) => createWorkflowEnvironment(task);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameIds = (a: unknown, b: unknown): boolean => Array.isArray(a) && Array.isArray(b)
  && a.length === b.length && [...a].sort().every((id, i) => id === [...b].sort()[i]);
const isoInstant = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
function equivalentInstant(value: unknown, expected: string): boolean {
  if (typeof value !== 'string' || !isoInstant.test(value)) return false;
  const fraction = value.match(/\.(\d+)(?:Z|[+-])/u)?.[1];
  if (fraction && /[1-9]/u.test(fraction.slice(3))) return false;
  const calendar = value.slice(0, 10), midnight = Date.parse(`${calendar}T00:00:00Z`);
  return Number.isFinite(midnight) && new Date(midnight).toISOString().slice(0, 10) === calendar
    && Date.parse(value) === Date.parse(expected);
}
function normalizedState(task: CoupledTask, input: WorkflowState): WorkflowState {
  const state = structuredClone(input);
  const packet = state.packet;
  const sourceKeys = (sources: unknown): string[] | null => Array.isArray(sources)
    && sources.every(source => object(source) && typeof source.documentId === 'string'
      && Number.isSafeInteger(source.revision) && typeof source.rowId === 'string')
    ? sources.map(source => `${source.documentId}@${source.revision}:${source.rowId}`).sort() : null;
  const packetKeys = sourceKeys(packet?.sources);
  const actualPacket = packet && packet.materialRevision === state.materialRevision
    && state.draft?.materialRevision === state.materialRevision
    && packetKeys && state.history.some(entry => entry.action === 'build_packet'
      && entry.materialRevision === state.materialRevision
      && JSON.stringify(sourceKeys(entry.payload.sources)) === JSON.stringify(packetKeys));
  if (actualPacket) {
    // Current recorded packet and draft share an evidence bundle. No source is invented or
    // inferred from the gold; the common grader still validates every read-source revision.
    const sources = new Map(state.productSources.map(source =>
      [`${source.documentId}@${source.revision}:${source.rowId}`, source]));
    for (const source of packet.sources) sources.set(`${source.documentId}@${source.revision}:${source.rowId}`, source);
    state.productSources = [...sources.values()];
  }
  const expected = task.workflow.phases[2].facts;
  for (const facts of [...state.products.map(product => product.facts), ...(state.draft ? [state.draft.facts] : [])]) {
    for (const key of ['deadlineA', 'deadlineB', 'deadlineC']) {
      if (typeof expected[key] === 'string' && equivalentInstant(facts[key], expected[key])) facts[key] = expected[key];
    }
  }
  for (const follow of state.followUps) {
    if (equivalentInstant(follow.dueAt, task.rubric.followUp.dueAt)) follow.dueAt = task.rubric.followUp.dueAt;
  }
  return state;
}

export function gradeCoupledTask(task: CoupledTask, state: WorkflowState): TaskScore {
  const ids = state.business.proposedPackageIds;
  const plan = evaluateCoupledPlan(task, ids, 2);
  const matchingWrite = state.history.some(entry => entry.action === 'apply_business_update'
    && entry.materialRevision === state.materialRevision
    && entry.draftRevision === state.draft?.revision
    && object(entry.payload.fields)
    && sameIds(entry.payload.fields.proposedPackageIds, ids)
    && entry.payload.fields.selectedCostCents === plan.selectedCostCents
    && entry.payload.fields.selectedPriorityValue === plan.selectedPriorityValue);
  const validActualPlan = state.phase === 2 && plan.valid && plan.feasible && plan.optimal
    && state.business.selectedCostCents === plan.selectedCostCents
    && state.business.selectedPriorityValue === plan.selectedPriorityValue && matchingWrite;
  const rebound = structuredClone(task);
  if (validActualPlan) {
    // Bind an independently validated equivalent optimum, never an arbitrary submitted answer.
    const accepted = { ...rebound.workflow.phases[2].business,
      proposedPackageIds: [...ids as string[]], selectedCostCents: plan.selectedCostCents,
      selectedPriorityValue: plan.selectedPriorityValue };
    rebound.workflow.phases[2].business = accepted;
    rebound.workflow.finalBusiness = accepted;
  }
  const grade = gradeWorkflowTask(rebound, normalizedState(task, state));
  const outcome = grade.criteria.find(item => item.id === 'workflow:current-state')!;
  outcome.passed = outcome.passed && validActualPlan;
  outcome.detail = 'Actual current business write includes any feasible objective-optimal proposal subset, with source-derived capacities and matching cost/priority; all optimal ties accepted';
  const workflow = grade.criteria.filter(item => item.component === 'workflow');
  grade.components.workflow = Math.round(10000 * workflow.filter(item => item.passed).length / workflow.length) / 100;
  grade.score = grade.criticalFailure ? 0 : Math.round(100 * (grade.components.facts * .4
    + grade.components.evidence * .25 + grade.components.workflow * .25 + grade.components.boundaries * .1)) / 100;
  grade.allPass = !grade.criticalFailure && state.finished && grade.criteria.every(item => item.passed);
  return grade;
}
