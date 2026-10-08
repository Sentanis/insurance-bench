import { describe, expect, it } from "vitest";
import {
  COUPLED_FAMILIES,
  deriveCoupledPhase,
  evaluateCoupledPlan,
  generateCoupledCases,
  solveCoupled,
  type CoupledConstraints,
  type CoupledTask,
} from "../../insurance-bench/coupled-cases.ts";
import {
  createCoupledEnvironment,
  gradeCoupledTask,
} from "../../insurance-bench/coupled-engine.ts";
import type { WorkflowDocument, WorkflowState } from "../../insurance-bench/workflow-types.ts";
import { publicWorkflowTask } from "../../insurance-bench/workflows.ts";

function sources(state: WorkflowState) {
  return state.documents.flatMap((doc) =>
    doc.rows.map((row) => ({ documentId: doc.id, revision: doc.revision, rowId: row.id })),
  );
}
function oracle(task: CoupledTask, chosen?: string[], minimal = false) {
  const env = createCoupledEnvironment(task),
    state = env.state;
  const run = (tool: string, args: Record<string, unknown> = {}) =>
    env.execute(tool, {
      expectedSessionRevision: state.sessionRevision,
      expectedMaterialRevision: state.materialRevision,
      expectedDraftRevision: state.draft?.revision,
      ...args,
    });
  const read = () =>
    state.documents.forEach((doc) =>
      expect(run("read_document", { documentId: doc.id })).not.toHaveProperty("error"),
    );
  const cited = () => {
    const required = new Set(Object.values(task.workflow.phases[state.phase].evidence).flat());
    return sources(state).filter((source) => !minimal || required.has(source.rowId));
  };
  const packet = () =>
    expect(run("build_packet", { sources: cited() })).not.toHaveProperty("error");
  read();
  expect(
    run("ask_customer", { topic: task.workflow.customerTopic, scope: task.workflow.customerScope }),
  ).not.toHaveProperty("error");
  read();
  packet();
  expect(
    run("save_work_product", {
      facts: task.workflow.phases[1].facts,
      sources: cited(),
      memo: "Current synthetic occurrence packet reconciles all exposure, receipt and allocation records for internal review.",
    }),
  ).not.toHaveProperty("error");
  expect(state.phase).toBe(2);
  read();
  packet();
  expect(
    run("revise_proposal", {
      facts: task.workflow.phases[2].facts,
      sources: cited(),
      memo: "Amended synthetic occurrence packet reconciles current policy limits, corrected posted allocations, reserve replacements and current demands.",
    }),
  ).not.toHaveProperty("error");
  expect(run("request_review")).not.toHaveProperty("error");
  const ids = chosen ?? task.coupled.phases[2].optimalPlans[0]!;
  const plan = evaluateCoupledPlan(task, ids);
  expect(
    run("apply_business_update", {
      kind: task.workflow.updateKind,
      fields: {
        ...task.workflow.finalBusiness,
        proposedPackageIds: ids,
        selectedCostCents: plan.selectedCostCents,
        selectedPriorityValue: plan.selectedPriorityValue,
      },
    }),
  ).not.toHaveProperty("error");
  expect(
    run("create_follow_up", task.rubric.followUp as unknown as Record<string, unknown>),
  ).not.toHaveProperty("error");
  expect(
    run("propose_workflow", {
      ...task.rubric.workflow,
      reason:
        "Current occurrence exposure constraints and package allocations support this reviewed internal handoff.",
    }),
  ).not.toHaveProperty("error");
  run("finish");
  return env;
}
// Recursive independent subset checker: no production solve/evaluate calls.
function independentMaximum(constraints: CoupledConstraints) {
  let maximum = -1,
    feasible = 0;
  function visit(i: number, cost: number, a: number, b: number, c: number, value: number) {
    if (
      cost > constraints.occurrenceAvailableCents ||
      a > constraints.personAvailable.A! ||
      b > constraints.personAvailable.B! ||
      c > constraints.personAvailable.C!
    )
      return;
    if (i === constraints.packages.length) {
      maximum = Math.max(maximum, value);
      feasible++;
      return;
    }
    visit(i + 1, cost, a, b, c, value);
    const item = constraints.packages[i]!;
    if (item.eligible)
      visit(
        i + 1,
        cost + item.costCents,
        a + item.allocations.A!,
        b + item.allocations.B!,
        c + item.allocations.C!,
        value + item.priorityValue,
      );
  }
  visit(0, 0, 0, 0, 0, 0);
  return { maximum, feasible };
}
function raw(docs: WorkflowDocument[], id: string) {
  return docs.flatMap((doc) => doc.rows).find((row) => row.id === id)!.fields;
}

describe("Occurrence-coupled synthetic proposal cases", () => {
  const tasks = generateCoupledCases();
  it("generates12 deterministic balanced cases with bounded nonforced alternatives", () => {
    expect(tasks).toHaveLength(12);
    expect(generateCoupledCases()).toEqual(tasks);
    expect(generateCoupledCases(8)).not.toEqual(tasks);
    expect(() => generateCoupledCases(Infinity)).toThrow("safe integer");
    for (const family of COUPLED_FAMILIES) {
      expect(tasks.filter((t) => t.family === family && t.split === "dev")).toHaveLength(2);
      expect(tasks.filter((t) => t.family === family && t.split === "holdout")).toHaveLength(2);
    }
    for (const task of tasks) {
      expect(Object.keys(task.workflow.phases[2].facts)).toHaveLength(19);
      expect(
        task.workflow.phases[2].documents.reduce((sum, doc) => sum + doc.rows.length, 0),
      ).toBeLessThanOrEqual(100);
      expect(task.coupled.phases[2].packages).toHaveLength(12);
      expect(task.coupled.phases[2].subsetsExamined).toBe(4096);
      expect(task.coupled.phases[2].feasiblePlanCount).toBeGreaterThan(40);
      expect(
        task.coupled.phases[2].packages.filter((p) => p.eligible).length,
      ).toBeGreaterThanOrEqual(7);
      expect(task.coupled.phases[2].optimalValue).toBeGreaterThan(0);
    }
    expect(tasks.some((t) => t.coupled.phases[2].optimalPlans.length > 1)).toBe(true);
  });
  it("independently enumerates all36 phase optima and verifies every gold feasible set", () => {
    for (const task of tasks)
      for (const phase of [0, 1, 2] as const) {
        const constraints = task.coupled.phases[phase];
        expect(independentMaximum(constraints)).toEqual({
          maximum: constraints.optimalValue,
          feasible: constraints.feasiblePlanCount,
        });
        const derived = deriveCoupledPhase(task.workflow.phases[phase].documents, task.clock);
        expect(derived.facts).toEqual(task.workflow.phases[phase].facts);
        for (const ids of constraints.optimalPlans)
          expect(evaluateCoupledPlan(task, ids, phase)).toMatchObject({
            valid: true,
            feasible: true,
            optimal: true,
          });
      }
  });
  it("completes all12 cases with100 and accepts distinct tied optima", () => {
    for (const task of tasks)
      expect(gradeCoupledTask(task, oracle(task).state)).toMatchObject({
        score: 100,
        allPass: true,
        criticalFailure: false,
      });
    const tied = tasks.find((t) => t.coupled.phases[2].optimalPlans.length > 1)!;
    const plans = tied.coupled.phases[2].optimalPlans;
    expect(plans[0]).not.toEqual(plans[1]);
    expect(gradeCoupledTask(tied, oracle(tied, [...plans[1]!].reverse()).state).allPass).toBe(true);
  });
  it("accepts a compact relevant-operand source bundle without distractor citations", () => {
    for (const task of tasks) {
      const state = oracle(task, undefined, true).state;
      expect(gradeCoupledTask(task, state)).toMatchObject({ score: 100, allPass: true });
      for (const rowId of [
        "event-expense",
        "event-recovery",
        "event-A-duplicate",
        "event-B-future",
        "event-C-unposted",
        "event-unsigned",
        "event-PD-expense",
      ]) {
        expect(state.productSources.some((source) => source.rowId === rowId)).toBe(false);
      }
      expect(state.productSources.length).toBeLessThan(60);
    }
  });
  it("does not expose hidden optimization answers or future records through public tools", () => {
    for (const task of tasks) {
      expect(Object.keys(publicWorkflowTask(task)).sort()).toEqual([
        "clock",
        "family",
        "id",
        "instruction",
      ]);
      const env = createCoupledEnvironment(task);
      const visible =
        JSON.stringify(env.execute("read_record")) + JSON.stringify(env.execute("list_documents"));
      expect(visible).not.toContain("optimalPlans");
      expect(visible).not.toContain("optimalValue");
      expect(
        env.execute("read_document", { documentId: `${task.id}:records`, revision: 3 }),
      ).toMatchObject({ error: "source_unavailable" });
      for (const doc of task.workflow.phases[0].documents)
        expect(doc.text).not.toContain('"eligible"');
      expect(task.instruction).not.toContain("optimalPlans");
    }
  });
  it("has consequential material coupling but preserves unrelated PD capacity", () => {
    for (const task of tasks) {
      const before = task.workflow.phases[1].facts,
        after = task.workflow.phases[2].facts;
      expect(after.personAvailableACents).not.toBe(before.personAvailableACents);
      expect(after.personAvailableCCents).not.toBe(before.personAvailableCCents);
      expect(after.occurrenceAvailableCents).not.toBe(before.occurrenceAvailableCents);
      expect(after.pdAvailableCents).toBe(before.pdAvailableCents);
      expect(task.coupled.phases[2].optimalPlans).not.toEqual(task.coupled.phases[1].optimalPlans);
    }
  });
  it("hand-checks linked partial reversal, duplicate version, expenses, recoveries and replacement reserves", () => {
    const task = tasks[0]!,
      docs = structuredClone(task.workflow.phases[2].documents);
    const jitter = Number(raw(docs, "policy-BI").personLimitCents) - 20000;
    const baseline = deriveCoupledPhase(docs, task.clock).facts;
    // A selected corrected payment6200+jitter minus its linked reversal1200;
    // B5700; C3400 plus allocated T-U2600 minus its linked reversal600.
    expect(baseline).toMatchObject({
      netPaidACents: 5000 + jitter,
      netPaidBCents: 5700,
      netPaidCCents: 5400,
      reserveTotalBICents: 9100,
      occurrenceAvailableCents: 15300,
      pdAvailableCents: 6100,
      unallocatedBICents: 0,
    });
    raw(docs, "event-expense").cents = 10000000;
    raw(docs, "event-recovery").cents = 5000000;
    expect(deriveCoupledPhase(docs, task.clock).facts).toEqual(baseline);
    raw(docs, "event-A-reversal-v2").cents = 1201;
    const penny = deriveCoupledPhase(docs, task.clock).facts;
    expect(penny.netPaidACents).toBe(4999 + jitter);
    expect(penny.personAvailableACents).toBe(Number(baseline.personAvailableACents) + 1);
    expect(penny.occurrenceAvailableCents).toBe(15301);
    expect(penny.pdAvailableCents).toBe(6100);
    raw(docs, "reserve-A-v2").effectiveAt = "2026-06-24T16:00:01Z";
    expect(deriveCoupledPhase(docs, task.clock).facts.reserveTotalBICents).toBe(7900);
  });
  it("hand-checks scope, policy expiration, upload irrelevance and unknown allocation blocking", () => {
    const task = tasks[0]!,
      docs = structuredClone(task.workflow.phases[2].documents);
    expect(deriveCoupledPhase(docs, task.clock).facts.limitSourceA).toBe("E-A2");
    raw(docs, "endorsement-A-v2").uploadedAt = "2030-01-01T00:00:00Z";
    expect(deriveCoupledPhase(docs, task.clock).facts.limitSourceA).toBe("E-A2");
    raw(docs, "endorsement-A-v2").policySourceId = "unrelated-policy";
    expect(deriveCoupledPhase(docs, task.clock).facts.limitSourceA).toBe("E-A1");
    raw(docs, "endorsement-A-v2").policySourceId = "P-BI";
    raw(docs, "endorsement-A-v2").effectiveAt = "2026-06-24T16:00:00Z";
    expect(deriveCoupledPhase(docs, task.clock).facts.limitSourceA).toBe("E-A1");
    raw(docs, "loss-B").lossAt = raw(docs, "policy-BI").expirationAt!;
    expect(deriveCoupledPhase(docs, task.clock).facts).toMatchObject({
      limitSourceB: "unavailable",
      personAvailableBCents: 0,
    });
    raw(docs, "allocation-U").claimant = "unknown";
    const unknown = deriveCoupledPhase(docs, task.clock);
    expect(unknown.facts.unallocatedBICents).toBe(2000);
    expect(unknown.facts.netPaidCCents).toBe(3400);
    expect(unknown.constraints.packages.find((p) => p.id.endsWith("-Q8"))!.eligible).toBe(false);
    expect(unknown.constraints.packages.find((p) => p.id.endsWith("-Q7"))!.eligible).toBe(true);
  });
  it("hand-checks amount-only inherited duration, replacement root, exact deadline and strict extension cutoff", () => {
    const amount = tasks.find((t) => t.family === "deadline-triage" && t.id.includes("dev-2"))!;
    const before = amount.workflow.phases[1].facts,
      after = amount.workflow.phases[2].facts;
    expect(after.deadlineA).toBe(before.deadlineA); //999-minute amendment duration must be ignored.
    const docs = structuredClone(tasks[0]!.workflow.phases[2].documents);
    expect(deriveCoupledPhase(docs, tasks[0]!.clock).facts.deadlineB).toBe("2026-06-24T17:15:00Z"); //replacement receipt15:45+90; old-root extension ignored.
    raw(docs, "receipt-D-A1").completeAt = "2026-06-24T12:00:00Z";
    raw(docs, "extension-A").receivedAt = "2026-06-24T16:00:00Z";
    const equal = deriveCoupledPhase(docs, tasks[0]!.clock);
    expect(equal.facts.deadlineA).toBe("2026-06-24T16:00:00Z");
    expect(equal.facts.lateDemandClaimantIds).not.toContain("A");
    raw(docs, "extension-A").receivedAt = "2026-06-24T15:59:59Z";
    expect(deriveCoupledPhase(docs, tasks[0]!.clock).facts.deadlineA).toBe("2026-06-24T16:30:00Z");
  });
  it("hand-checks competing combinations and binds both person and shared capacity including one cent", () => {
    const base = {
      personAvailable: { A: 100, B: 100, C: 100 },
      occurrenceAvailableCents: 20,
      packages: [
        {
          id: "a",
          allocations: { A: 14, B: 0, C: 0 },
          costCents: 14,
          priorityValue: 9,
          eligible: true,
        },
        {
          id: "b",
          allocations: { A: 0, B: 11, C: 0 },
          costCents: 11,
          priorityValue: 7,
          eligible: true,
        },
        {
          id: "c",
          allocations: { A: 0, B: 0, C: 9 },
          costCents: 9,
          priorityValue: 6,
          eligible: true,
        },
      ],
    };
    expect(solveCoupled(base)).toMatchObject({ optimalValue: 13, optimalPlans: [["b", "c"]] });
    expect(solveCoupled({ ...base, occurrenceAvailableCents: 19 })).toMatchObject({
      optimalValue: 9,
      optimalPlans: [["a"]],
    });
    expect(
      solveCoupled({ ...base, personAvailable: { ...base.personAvailable, B: 10 } }),
    ).toMatchObject({ optimalValue: 9 });
  });
  it("rejects optimum-only claims, infeasible/nonoptimal plans, duplicates, unrecorded or corrupt outcomes", () => {
    const task = tasks[0]!;
    expect(gradeCoupledTask(task, createCoupledEnvironment(task).state)).toMatchObject({
      score: 0,
      allPass: false,
    });
    expect(evaluateCoupledPlan(task, ["unknown"])).toMatchObject({ valid: false, feasible: false });
    expect(
      evaluateCoupledPlan(task, [
        task.coupled.phases[2].packages[0]!.id,
        task.coupled.phases[2].packages[0]!.id,
      ]),
    ).toMatchObject({ valid: false });
    expect(gradeCoupledTask(task, oracle(task, []).state).allPass).toBe(false);
    expect(
      evaluateCoupledPlan(
        task,
        task.coupled.phases[2].packages.map((p) => p.id),
      ),
    ).toMatchObject({ feasible: false });
    const good = oracle(task).state;
    const corrupted = structuredClone(good);
    corrupted.business.selectedCostCents = Number(corrupted.business.selectedCostCents) + 1;
    expect(gradeCoupledTask(task, corrupted).allPass).toBe(false);
    const noWrite = structuredClone(good);
    noWrite.history = noWrite.history.filter((entry) => entry.action !== "apply_business_update");
    expect(gradeCoupledTask(task, noWrite).allPass).toBe(false);
  });
});
