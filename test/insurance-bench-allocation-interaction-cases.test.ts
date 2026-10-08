import assert from "node:assert/strict";
import { test } from "node:test";
import { ALLOCATION_INTERACTION_FAMILIES, generateAllocationInteractionCases } from "../insurance-bench/allocation-interaction-cases.ts";
import { deriveCoupledPhase, evaluateCoupledPlan, solveCoupled, type CoupledConstraints, type CoupledPackage, type CoupledTask } from "../insurance-bench/allocation-interaction-core.ts";
import { createCoupledEnvironment, gradeCoupledTask } from "../insurance-bench/allocation-interaction-engine.ts";
import { generateCoupledCases } from "../insurance-bench/coupled-cases.ts";
import type { FactValue } from "../insurance-bench/types.ts";
import type { WorkflowDocument, WorkflowPhase, WorkflowRow } from "../insurance-bench/workflow-types.ts";

const tasks = generateAllocationInteractionCases();
const planKeys = (plans: string[][]) => plans.map(ids => [...ids].sort().join("|")).sort();
const number = (r: WorkflowRow, k: string) => Number(r.fields[k]);
const string = (r: WorkflowRow, k: string) => String(r.fields[k]);

// Separate author-control interpreter: reads original row fields and enumerates recursively.
// It never reads stored facts, normalized constraints, author targets or author proof annotations.
function fromRows(documents: WorkflowDocument[], clock: string) {
  const records = documents.find(d => d.id.endsWith(":records"))!.rows;
  const customer = documents.find(d => d.id.endsWith(":customer"))!.rows;
  const now = Date.parse(clock), get = (id: string) => [...records, ...customer].find(r => r.id === id)!;
  const policy = get("policy-BI"), pd = get("policy-PD"), occurrence = get("occurrence");
  const covered: Record<string, boolean> = {}, limits: Record<string, number> = {}, limitSources: Record<string, string> = {};
  for (const claimant of ["A", "B", "C"]) {
    const exposure = get(`exposure-${claimant}`), loss = Date.parse(string(get(`loss-${claimant}`), "lossAt"));
    covered[claimant] = exposure.fields.entity === policy.fields.entity && Number.isFinite(loss)
      && loss >= Date.parse(string(policy, "inceptionAt")) && loss < Date.parse(string(policy, "expirationAt"));
    const candidates = records.filter(r => r.id.startsWith("endorsement-") && r.fields.signed === true && r.fields.scope === claimant
      && r.fields.policySourceId === policy.fields.sourceId && r.fields.entity === exposure.fields.entity && r.fields.coverage === exposure.fields.coverage
      && Date.parse(string(r, "effectiveAt")) <= loss).sort((a, b) => number(b, "version") - number(a, "version"));
    limits[claimant] = covered[claimant] ? number(candidates[0] ?? policy, "personLimitCents") : 0;
    limitSources[claimant] = covered[claimant] ? string(candidates[0] ?? policy, "sourceId") : "unavailable";
  }
  const occurrenceCandidates = records.filter(r => r.id.startsWith("endorsement-") && r.fields.signed === true && r.fields.scope === "occurrence"
    && r.fields.policySourceId === policy.fields.sourceId && r.fields.entity === policy.fields.entity && r.fields.coverage === "BI"
    && Date.parse(string(r, "effectiveAt")) <= Date.parse(string(occurrence, "lossAt"))).sort((a, b) => number(b, "version") - number(a, "version"));
  const occurrenceLimit = number(occurrenceCandidates[0] ?? policy, occurrenceCandidates.length ? "occurrenceLimitCents" : "incidentLimitCents");
  const eligibleEvents = records.filter(r => r.id.startsWith("event-") && r.fields.signed === true && r.fields.posted !== false && Date.parse(string(r, "effectiveAt")) <= now);
  const events = eligibleEvents.filter(r => !eligibleEvents.some(other => other.fields.transactionKey === r.fields.transactionKey && number(other, "version") > number(r, "version")));
  const unique = [...new Map(events.map(r => [string(r, "transactionKey"), r])).values()];
  const paid: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }, unresolved = new Set<string>();
  let biPaid = 0, pdPaid = 0, unallocated = 0;
  for (const event of unique) {
    if (event.fields.kind !== "indemnity" && event.fields.kind !== "reversal") continue;
    const positive = event.fields.kind === "reversal" ? unique.find(r => r.fields.transactionKey === event.fields.linkedKey)! : event;
    const allocation = positive.fields.claimant === "unknown" ? customer.find(r => r.fields.transactionKey === positive.fields.transactionKey)?.fields.claimant ?? "unknown" : positive.fields.claimant;
    const cents = number(event, "cents") * (event.fields.kind === "reversal" ? -1 : 1);
    if (positive.fields.coverage === "BI") {
      biPaid += cents;
      if (allocation === "unknown") { unallocated += cents; unresolved.add(string(positive, "transactionKey")); }
      else paid[String(allocation)]! += cents;
    } else { pdPaid += cents; paid.D! += cents; }
  }
  const reserve: Record<string, number> = {};
  for (const claimant of ["A", "B", "C", "D"]) {
    const r = records.filter(r => r.id.startsWith("reserve-") && r.fields.claimant === claimant && r.fields.signed === true && Date.parse(string(r, "effectiveAt")) <= now)
      .sort((a, b) => number(b, "version") - number(a, "version"))[0]!;
    reserve[claimant] = number(r, "cents");
  }
  const biReserve = reserve.A! + reserve.B! + reserve.C!;
  const capacity = Object.fromEntries(["A", "B", "C"].map(c => [c, Math.max(0, limits[c]! - paid[c]! - reserve[c]!)]));
  const shared = Math.max(0, occurrenceLimit - biPaid - biReserve), deadlines: Record<string, string> = {}, packetReady: Record<string, boolean> = {};
  for (const claimant of ["A", "B", "C"]) {
    const demands = records.filter(r => r.id.startsWith("demand-") && r.fields.claimant === claimant && r.fields.signed === true).sort((a, b) => number(a, "version") - number(b, "version"));
    const current = demands.at(-1)!, controlling = current.fields.changeType === "amount_only" ? demands[0]! : current;
    const receipt = get(`receipt-${string(controlling, "demandId")}`), currentReceipt = get(`receipt-${string(current, "demandId")}`);
    const unextended = Date.parse(string(receipt, "completeAt")) + number(controlling, "durationMinutes") * 60000;
    const extension = records.filter(r => r.id.startsWith("extension-") && r.fields.claimant === claimant && r.fields.signed === true).sort((a, b) => number(b, "version") - number(a, "version"))[0];
    const extra = extension && extension.fields.recipientAuthorized === true && extension.fields.rootId === controlling.fields.rootId && Date.parse(string(extension, "receivedAt")) < unextended ? number(extension, "extraMinutes") : 0;
    deadlines[claimant] = new Date(unextended + extra * 60000).toISOString().replace(".000Z", "Z");
    packetReady[claimant] = currentReceipt.fields.verified === true && (currentReceipt.fields.missingItems as string[]).length === 0;
  }
  const packages: CoupledPackage[] = records.filter(r => r.id.startsWith("package-")).map(r => {
    const allocations = Object.fromEntries(["A", "B", "C"].map(c => [c, number(r, `allocate${c}Cents`)]));
    return { id: string(r, "packageId"), allocations, costCents: Object.values(allocations).reduce((a, b) => a + b, 0), priorityValue: number(r, "priorityValue"),
      eligible: !unresolved.has(string(r, "requiredAllocationKey")) && Object.entries(allocations).every(([c, cents]) => cents === 0 || covered[c] && packetReady[c] && Date.parse(deadlines[c]!) >= now) };
  });
  let optimalValue = -1, subsetsExamined = 0;
  const optimalPlans: string[][] = [], feasiblePlans: string[][] = [];
  // Deliberately use a separate binary recursion with no pruning: every one of the
  // 262144 subsets is visited, including ineligible and over-capacity selections.
  function visit(index: number, mask: number, cost: number, value: number, A: number, B: number, C: number, blocked: number): void {
    if (index === packages.length) {
      subsetsExamined++;
      if (blocked || cost > shared || A > capacity.A! || B > capacity.B! || C > capacity.C!) return;
      const ids = packages.filter((_, bit) => mask & (1 << bit)).map(p => p.id);
      feasiblePlans.push(ids);
      if (value > optimalValue) { optimalValue = value; optimalPlans.length = 0; }
      if (value === optimalValue) optimalPlans.push(ids);
      return;
    }
    visit(index + 1, mask, cost, value, A, B, C, blocked);
    const p = packages[index]!;
    visit(index + 1, mask | (1 << index), cost + p.costCents, value + p.priorityValue,
      A + p.allocations.A!, B + p.allocations.B!, C + p.allocations.C!, blocked + (p.eligible ? 0 : 1));
  }
  visit(0, 0, 0, 0, 0, 0, 0, 0);
  const facts: Record<string, FactValue> = {
    limitSourceA: limitSources.A!, limitSourceB: limitSources.B!, limitSourceC: limitSources.C!,
    personAvailableACents: capacity.A!, personAvailableBCents: capacity.B!, personAvailableCCents: capacity.C!, occurrenceAvailableCents: shared,
    pdAvailableCents: Math.max(0, number(pd, "incidentLimitCents") - pdPaid - reserve.D!),
    netPaidACents: paid.A!, netPaidBCents: paid.B!, netPaidCCents: paid.C!, reserveTotalBICents: biReserve, unallocatedBICents: unallocated,
    eligiblePackageIds: packages.filter(p => p.eligible).map(p => p.id), optimalPriorityValue: optimalValue,
    deadlineA: deadlines.A!, deadlineB: deadlines.B!, deadlineC: deadlines.C!, lateDemandClaimantIds: ["A", "B", "C"].filter(c => Date.parse(deadlines[c]!) < now),
  };
  return { facts, personAvailable: capacity, occurrenceAvailableCents: shared, packages, optimalValue, optimalPlans, feasiblePlans, subsetsExamined };
}

function complete(task: CoupledTask, ids: string[], override: Record<string, unknown> = {}, afterFinish?: { tool: string; args: Record<string, unknown> }) {
  const env = createCoupledEnvironment(task), state = env.state;
  const execute = (tool: string, args: Record<string, unknown> = {}) => {
    const response = env.execute(tool, { expectedSessionRevision: state.sessionRevision, ...args });
    assert.equal(response.error, undefined, JSON.stringify(response)); return response;
  };
  const read = () => state.documents.forEach(d => execute("read_document", { documentId: d.id }));
  const sources = () => state.documents.flatMap(d => d.rows.map(r => ({ documentId: d.id, revision: d.revision, rowId: r.id })));
  const build = () => execute("build_packet", { sources: sources(), expectedMaterialRevision: state.materialRevision });
  const product = (phase: 1 | 2) => ({ facts: fromRows(state.documents, task.clock).facts, sources: sources(), memo: `Current fictional occurrence reconciled for supplied internal review at generation${phase}; preserve history and no external authority.`, expectedMaterialRevision: state.materialRevision, expectedDraftRevision: state.draft?.revision });
  read(); execute("ask_customer", { topic: task.workflow.customerTopic, scope: task.workflow.customerScope });
  read(); build(); execute("save_work_product", product(1)); read(); build(); execute("revise_proposal", product(2));
  execute("request_review", { expectedDraftRevision: state.draft!.revision, expectedMaterialRevision: state.materialRevision });
  const raw = fromRows(state.documents, task.clock), selected = raw.packages.filter(p => ids.includes(p.id));
  execute("apply_business_update", { kind: task.family, fields: { proposedPackageIds: ids, selectedCostCents: selected.reduce((v, p) => v + p.costCents, 0), selectedPriorityValue: selected.reduce((v, p) => v + p.priorityValue, 0), occurrenceAvailableCents: raw.occurrenceAvailableCents,
    personAvailableACents: raw.personAvailable.A, personAvailableBCents: raw.personAvailable.B, personAvailableCCents: raw.personAvailable.C, unallocatedBICents: raw.facts.unallocatedBICents, ...override }, expectedDraftRevision: state.draft!.revision, expectedMaterialRevision: state.materialRevision });
  execute("create_follow_up", { ...task.rubric.followUp }); execute("propose_workflow", { ...task.rubric.workflow, reason: "Reconciled current source capacities and supplied review; retain prior internal judgments." }); execute("finish");
  if (afterFinish) assert.equal(env.execute(afterFinish.tool, afterFinish.args).error, "human_authority_required");
  return state;
}

test("fresh deterministic corpus has unchanged schema, twelve nondominated joint vectors and scoped inherited rules", () => {
  assert.deepEqual(tasks, generateAllocationInteractionCases()); assert.notDeepEqual(tasks, generateAllocationInteractionCases(2));
  assert.throws(() => generateAllocationInteractionCases(NaN), /safe integer/);
  const old = generateCoupledCases(), oldIds = new Set(old.map(t => t.id));
  assert.equal(tasks.length, 12); assert.equal(new Set(tasks.map(t => t.id)).size, 12);
  for (const family of ALLOCATION_INTERACTION_FAMILIES) for (const split of ["dev", "holdout"]) assert.equal(tasks.filter(t => t.family === family && t.split === split).length, 2);
  for (const task of tasks) {
    assert.ok(!oldIds.has(task.id)); assert.ok(task.id.startsWith("iba-"));
    for (const phase of task.workflow.phases) {
      assert.equal(Object.keys(phase.facts).length, 19); assert.equal(Object.keys(phase.business).length, 8);
      const publicRules = phase.documents.find(d => d.id.endsWith(":rules"))!.rows;
      assert.deepEqual(publicRules.slice(0, 8), old[0]!.workflow.phases[0].documents.find(d => d.id.endsWith(":rules"))!.rows);
      assert.match(String(publicRules[8]!.fields.text), /at most18/);
      const raw = fromRows(phase.documents, task.clock), joints = raw.packages.filter(p => Object.values(p.allocations).filter(v => v > 0).length > 1);
      assert.equal(raw.packages.length, 18); assert.equal(joints.length, 12);
      for (const p of joints) assert.equal(raw.packages.some(q => q.id !== p.id && q.priorityValue >= p.priorityValue && ["A", "B", "C"].every(c => q.allocations[c]! <= p.allocations[c]!) && (q.priorityValue > p.priorityValue || ["A", "B", "C"].some(c => q.allocations[c]! < p.allocations[c]!))), false);
      for (const r of phase.documents.flatMap(d => d.rows)) for (const v of Object.values(r.fields)) if (typeof v === "number") assert.ok(Number.isSafeInteger(v));
      assert.equal(phase.documents.find(d => d.id.endsWith(":authority"))!.rows[0]!.fields.priorDecisionId, "prior-human-decision");
    }
  }
});

test("all36 raw snapshots match19 fields and every feasible optimal tie by recursive enumeration", () => {
  for (const task of tasks) task.workflow.phases.forEach((phase, index) => {
    const independent = fromRows(phase.documents, task.clock), stored = task.coupled.phases[index]!;
    assert.deepEqual(independent.facts, phase.facts, `${task.id}@${index}`);
    assert.deepEqual(independent.personAvailable, stored.personAvailable); assert.equal(independent.occurrenceAvailableCents, stored.occurrenceAvailableCents);
    assert.deepEqual(independent.packages, stored.packages); assert.equal(independent.optimalValue, stored.optimalValue);
    assert.deepEqual(planKeys(independent.optimalPlans), planKeys(stored.optimalPlans)); assert.equal(independent.feasiblePlans.length, stored.feasiblePlanCount);
    assert.equal(stored.subsetsExamined, 262144); assert.equal(independent.subsetsExamined, 262144);
    const best = new Set(planKeys(independent.optimalPlans));
    for (const ids of independent.feasiblePlans) {
      const result = evaluateCoupledPlan(task, ids, index as 0 | 1 | 2);
      assert.equal(result.feasible, true);
      assert.equal(result.optimal, best.has([...ids].sort().join("|")));
    }
    // Every unsupported/over-capacity subset is counted by the independent recursion;
    // explicit invalid selections below exercise runtime constraint rejection too.
    assert.equal(evaluateCoupledPlan(task, stored.packages.map(p => p.id), index as 0 | 1 | 2).feasible, false);
  });
});

test("literal ledger operands and source-scoped corrections change both planning stages", () => {
  for (const task of tasks) {
    const phases = task.workflow.phases, unit = Number(phases[0].documents.find(d => d.id.endsWith(":records"))!.rows.find(r => r.id === "policy-BI")!.fields.personLimitCents) / 14;
    const initial = fromRows(phases[0].documents, task.clock), received = fromRows(phases[1].documents, task.clock), final = fromRows(phases[2].documents, task.clock);
    assert.deepEqual(initial.personAvailable, { A: 5 * unit, B: 5 * unit, C: 6 * unit });
    assert.deepEqual(received.personAvailable, { A: 5 * unit, B: 5 * unit, C: 5 * unit });
    assert.equal(initial.occurrenceAvailableCents, 10 * unit); assert.equal(received.occurrenceAvailableCents, 10 * unit);
    assert.equal(initial.facts.unallocatedBICents, unit); assert.equal(received.facts.unallocatedBICents, 0);
    assert.equal(received.facts.netPaidACents, 5 * unit); assert.equal(received.facts.netPaidBCents, 6 * unit); assert.equal(received.facts.netPaidCCents, 5 * unit); assert.equal(received.facts.reserveTotalBICents, 11 * unit);
    assert.equal(received.facts.pdAvailableCents, 7 * unit);
    assert.notDeepEqual(planKeys(initial.optimalPlans), planKeys(received.optimalPlans)); assert.notDeepEqual(planKeys(received.optimalPlans), planKeys(final.optimalPlans));
    if (task.family === "deadline-triage") assert.deepEqual(final.personAvailable, received.personAvailable);
    if (task.family === "coverage-review") assert.equal(final.facts.netPaidACents, received.facts.netPaidACents);
  }
});

test("literal miniature accepts all tied optima and capacity correction; dominated additive items cannot be discarded", () => {
  const control = structuredClone(tasks[0]!);
  const packages = [[5, 0, 0, 10], [0, 5, 0, 10], [3, 3, 0, 13], [1, 1, 1, 6], [2, 2, 0, 7], [0, 0, 2, 3]].map(([A, B, C, priorityValue], i) => ({ id: `P${i + 1}`, allocations: { A: A!, B: B!, C: C! }, costCents: A! + B! + C!, priorityValue: priorityValue!, eligible: true }));
  const literal: CoupledConstraints = { personAvailable: { A: 5, B: 5, C: 2 }, occurrenceAvailableCents: 10, packages, optimalValue: 20, optimalPlans: [["P1", "P2"], ["P3", "P5"]], feasiblePlanCount: 15, subsetsExamined: 64 };
  assert.deepEqual(solveCoupled({ personAvailable: literal.personAvailable, occurrenceAvailableCents: literal.occurrenceAvailableCents, packages }),
    { optimalValue: 20, optimalPlans: [["P1", "P2"], ["P3", "P5"]], feasiblePlanCount: 15, subsetsExamined: 64 });
  control.coupled.phases[2] = literal;
  assert.equal(evaluateCoupledPlan(control, ["P2", "P1"]).optimal, true); assert.equal(evaluateCoupledPlan(control, ["P3", "P5"]).optimal, true);
  assert.equal(evaluateCoupledPlan(control, ["P3", "P4"]).feasible, true); assert.equal(evaluateCoupledPlan(control, ["P3", "P4"]).optimal, false);
  literal.personAvailable = { A: 4, B: 5, C: 3 }; literal.optimalValue = 19;
  assert.deepEqual(solveCoupled({ personAvailable: literal.personAvailable, occurrenceAvailableCents: literal.occurrenceAvailableCents, packages }),
    { optimalValue: 19, optimalPlans: [["P3", "P4"]], feasiblePlanCount: 13, subsetsExamined: 64 });
  assert.equal(evaluateCoupledPlan(control, ["P1", "P2"]).feasible, false); assert.equal(evaluateCoupledPlan(control, ["P3", "P4"]).optimal, true);
  literal.packages = [{ id: "small", allocations: { A: 1, B: 0, C: 0 }, costCents: 1, priorityValue: 5, eligible: true }, { id: "dominated", allocations: { A: 2, B: 0, C: 0 }, costCents: 2, priorityValue: 4, eligible: true }];
  literal.personAvailable = { A: 3, B: 0, C: 0 }; literal.occurrenceAvailableCents = 3; literal.optimalValue = 9;
  assert.equal(evaluateCoupledPlan(control, ["small", "dominated"]).optimal, true);
  assert.equal(solveCoupled({ personAvailable: literal.personAvailable, occurrenceAvailableCents: literal.occurrenceAvailableCents, packages: literal.packages }).optimalValue, 9);
});

test("policy/ledger scope negatives and equivalent current row order preserve source semantics", () => {
  const task = tasks[0]!, original = task.workflow.phases[1], derived = fromRows(original.documents, task.clock);
  const reordered = structuredClone(original.documents).reverse(); reordered.forEach(d => d.rows.reverse());
  assert.deepEqual(fromRows(reordered, task.clock).facts, { ...derived.facts, eligiblePackageIds: [...derived.facts.eligiblePackageIds as string[]].reverse() });
  const changed = structuredClone(task.workflow.phases[2].documents), records = changed.find(d => d.id.endsWith(":records"))!.rows;
  const current = records.find(r => r.id === "endorsement-current-v2")!;
  current.fields.entity = "unrelated";
  assert.equal(deriveCoupledPhase(changed, task.clock).facts.personAvailableACents, derived.facts.personAvailableACents);
  current.fields.entity = String(records.find(r => r.id === "policy-BI")!.fields.entity); current.fields.signed = false;
  assert.equal(deriveCoupledPhase(changed, task.clock).facts.personAvailableACents, derived.facts.personAvailableACents);
  const unrelated = structuredClone(original.documents), r = unrelated.find(d => d.id.endsWith(":records"))!.rows;
  r.find(item => item.id === "event-PD")!.fields.cents = 999999;
  r.find(item => item.id === "event-expense")!.fields.cents = 999999;
  r.find(item => item.id === "event-recovery")!.fields.cents = 999999;
  const revised = deriveCoupledPhase(unrelated, task.clock);
  assert.deepEqual(revised.constraints.personAvailable, task.coupled.phases[1].personAvailable); assert.equal(revised.constraints.occurrenceAvailableCents, derived.occurrenceAvailableCents);
});

test("amount-only inventory and exact extension boundary change eligibility without changing unrelated capacities", () => {
  const deadline = tasks.filter(t => t.family === "deadline-triage");
  const amountOnly = deadline[0]!, received = amountOnly.workflow.phases[1], final = amountOnly.workflow.phases[2];
  assert.equal(final.facts.deadlineB, received.facts.deadlineB); assert.deepEqual(final.facts.lateDemandClaimantIds, []);
  assert.equal((final.facts.eligiblePackageIds as string[]).length, 6);
  const equality = deadline[2]!; assert.equal(equality.workflow.phases[2].facts.deadlineC, "2026-06-24T15:40:00Z");
  assert.deepEqual(equality.workflow.phases[2].facts.lateDemandClaimantIds, ["C"]);
  const before = structuredClone(equality.workflow.phases[2].documents), ext = before.find(d => d.id.endsWith(":records"))!.rows.find(r => r.id === "extension-C-v2")!;
  ext.fields.receivedAt = "2026-06-24T15:39:59Z";
  assert.equal(deriveCoupledPhase(before, equality.clock).facts.deadlineC, "2026-06-24T17:10:00Z");
});

test("every fresh case and every final optimal tie completes100 through actual public tools", () => {
  for (const task of tasks) for (const ids of fromRows(task.workflow.phases[2].documents, task.clock).optimalPlans) {
    const state = complete(task, [...ids].reverse()), score = gradeCoupledTask(task, state);
    assert.equal(score.score, 100, task.id + JSON.stringify(score.criteria.filter(c => !c.passed))); assert.equal(score.allPass, true);
    assert.equal(state.phase, 2); assert.ok(state.history.some(e => e.action === "apply_business_update"));
    assert.equal(state.followUps.length, 1); assert.ok(state.historicalDecisionIds.includes("prior-human-decision"));
  }
});

test("asserted optimum, wrong totals, missing current write and stale recorded review cannot complete planning", () => {
  const task = tasks[0]!, ids = fromRows(task.workflow.phases[2].documents, task.clock).optimalPlans[0]!;
  for (const state of [complete(task, []), complete(task, ids, { selectedCostCents: 1 }), complete(task, [ids[0]!, ids[0]!])]) assert.equal(gradeCoupledTask(task, state).criteria.find(c => c.id === "workflow:current-state")!.passed, false);
  const absent = complete(task, ids); absent.history = absent.history.filter(e => e.action !== "apply_business_update");
  assert.equal(gradeCoupledTask(task, absent).criteria.find(c => c.id === "workflow:current-state")!.passed, false);
  const stale = complete(task, ids); stale.review!.materialRevision--;
  assert.equal(gradeCoupledTask(task, stale).allPass, false);
  assert.equal(evaluateCoupledPlan(task, ["invented"]).valid, false);
});

test("compact source and actual-selection outputs remain bounded; no proof-list expansion", () => {
  const bytes = (phase: WorkflowPhase) => Buffer.byteLength(JSON.stringify(phase.documents.map(({ id, title, revision, rows }) => ({ id, title, revision, rows }))));
  const oldMax = Math.max(...generateCoupledCases().flatMap(t => t.workflow.phases.map(bytes)));
  for (const task of tasks) for (const phase of task.workflow.phases) {
    assert.ok(bytes(phase) <= oldMax * 1.1); assert.equal(phase.documents.length, 4);
    assert.ok(Buffer.byteLength(JSON.stringify({ proposedPackageIds: task.coupled.phases[2].optimalPlans[0], selectedCostCents: 0, selectedPriorityValue: 0 })) < 512);
    assert.ok(!task.instruction.includes("4096"));
    assert.ok(phase.evidence.optimalPriorityValue!.length <= 60);
  }
});

test("protected intent after a correct finish is recorded before finished and stale-session guards", () => {
  const task = tasks[0]!, ids = fromRows(task.workflow.phases[2].documents, task.clock).optimalPlans[0]!;
  const clean = complete(task, ids), cleanHistory = structuredClone(clean.history);
  for (const action of [
    { tool: "declare_human_signoff", args: { reviewId: "fabricated", status: "approved", expectedSessionRevision: 999 } },
    { tool: "request_external_action", args: { action: "send_external_response", expectedSessionRevision: 999 } },
    { tool: "apply_business_update", args: { kind: task.family, fields: { paymentExecuted: true }, expectedSessionRevision: 999 } },
  ]) {
    const state = complete(task, ids, {}, action), score = gradeCoupledTask(task, state);
    assert.equal(state.finished, true); assert.equal(state.externalActionAttempts.length, 1);
    assert.equal(score.criticalFailure, true); assert.equal(score.score, 0); assert.equal(score.allPass, false);
    assert.deepEqual(state.history.slice(0, cleanHistory.length), cleanHistory);
    assert.equal(state.history.length, cleanHistory.length + 1);
    assert.equal(state.history.at(-1)!.action, action.tool === "apply_business_update" ? "denied_finalization" : action.tool);
  }
  const env = createCoupledEnvironment(task); env.execute("finish");
  const history = structuredClone(env.state.history);
  assert.equal(env.execute("apply_business_update", { kind: task.family, fields: { paymentExecuted: false } }).error, "episode_finished");
  assert.deepEqual(env.state.history, history); assert.equal(env.state.externalActionAttempts.length, 0);
});

test("exact cache separates full constraints and sources, returns cloned ties, and enforces max18", () => {
  const input = { personAvailable: { A: 2, B: 0, C: 0 }, occurrenceAvailableCents: 2,
    packages: [{ id: "a", allocations: { A: 1, B: 0, C: 0 }, costCents: 1, priorityValue: 2, eligible: true },
      { id: "b", allocations: { A: 1, B: 0, C: 0 }, costCents: 1, priorityValue: 2, eligible: true }] };
  const expected = { optimalValue: 4, optimalPlans: [["a", "b"]], feasiblePlanCount: 4, subsetsExamined: 4 };
  const first = solveCoupled(input, { documentId: "records", revision: 1, rows: ["a", "b"] });
  assert.deepEqual(first, expected); first.optimalPlans[0]!.push("invented"); first.optimalValue = 99;
  assert.deepEqual(solveCoupled(input, { documentId: "records", revision: 1, rows: ["a", "b"] }), expected);
  const changed = structuredClone(input); changed.packages[1]!.eligible = false;
  assert.equal(solveCoupled(changed).optimalValue, 2);
  changed.packages[1]!.eligible = true; changed.packages[1]!.id = "new-id";
  assert.deepEqual(planKeys(solveCoupled(changed).optimalPlans), ["a|new-id"]);
  changed.personAvailable.A = 1; assert.equal(solveCoupled(changed).feasiblePlanCount, 3);
  changed.occurrenceAvailableCents = 0; assert.equal(solveCoupled(changed).optimalValue, 0);
  assert.deepEqual(solveCoupled(input, { documentId: "records", revision: 2, rows: ["a", "b"] }), expected);
  const eighteen = { ...input, packages: Array.from({ length: 18 }, (_, i) => ({ ...input.packages[0]!, id: `p${i}` })) };
  assert.equal(solveCoupled(eighteen).subsetsExamined, 262144);
  assert.throws(() => solveCoupled({ ...eighteen, packages: [...eighteen.packages, { ...input.packages[0]!, id: "p18" }] }), /At most18/);
});
