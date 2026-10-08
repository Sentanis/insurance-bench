import { describe, expect, it } from "vitest";
import {
  generatePortfolioCases,
  type PortfolioTask,
} from "../../insurance-bench/portfolio-cases.ts";
import { createPlanner, evaluatePlan, solvePlanning } from "../../insurance-bench/planning.ts";
import type {
  PlanningScenario,
  ReviewBooking,
  ReviewJob,
} from "../../insurance-bench/planning-types.ts";
import { gradeTask } from "../../insurance-bench/score.ts";
import { FAMILIES, type BenchState } from "../../insurance-bench/types.ts";

function text(task: PortfolioTask, suffix: string): string {
  return task.documents.find((source) => source.id.endsWith(`:${suffix}`))!.text;
}
function jobClosure(jobs: ReviewJob[]): Set<string> {
  const selected = new Set<string>();
  function visit(id: string) {
    if (selected.has(id)) return;
    selected.add(id);
    jobs.find((job) => job.id === id)!.dependencies.forEach(visit);
  }
  jobs.filter((job) => job.mandatory).forEach((job) => visit(job.id));
  return selected;
}

/** Independent audit: enumerate optional subsets, then solve each selected set as a
 * minimum-remaining-values constraint problem. No production solver/evaluator calls. */
function independentOptimum(scenario: PlanningScenario): { value: number; nodes: number } {
  const closure = jobClosure(scenario.jobs);
  const optional = scenario.jobs.filter((job) => job.approved && !closure.has(job.id));
  let best = -1,
    nodes = 0;
  for (let subset = 0; subset < 2 ** optional.length; subset++) {
    const selected = scenario.jobs
      .filter((job) => closure.has(job.id))
      .concat(optional.filter((_, index) => subset & (2 ** index)));
    const ids = new Set(selected.map((job) => job.id));
    if (
      selected.some(
        (job) => !job.approved || job.dependencies.some((dependency) => !ids.has(dependency)),
      )
    )
      continue;
    if (selected.reduce((sum, job) => sum + job.cost, 0) > scenario.budget) continue;
    const value = selected.reduce((sum, job) => sum + job.value, 0);
    if (value <= best) continue;
    const domains = new Map(
      selected.map((job) => [
        job.id,
        scenario.reviewers.flatMap((reviewer) => {
          if (!reviewer.skills.includes(job.requiredSkill)) return [];
          return (job.allowedStarts ?? Array.from({ length: scenario.slots }, (_, index) => index))
            .filter(
              (start) =>
                start >= job.releaseSlot &&
                start + job.duration <= job.deadlineSlot &&
                Array.from({ length: job.duration }, (_, offset) => start + offset).every((slot) =>
                  reviewer.availableSlots.includes(slot),
                ),
            )
            .map((startSlot) => ({ jobId: job.id, reviewer: reviewer.id, startSlot }));
        }),
      ]),
    );
    const assigned = new Map<string, ReviewBooking>();
    const job = (id: string) => selected.find((item) => item.id === id)!;
    function compatible(candidate: ReviewBooking): boolean {
      const current = job(candidate.jobId);
      for (const prior of assigned.values()) {
        const other = job(prior.jobId);
        if (
          candidate.reviewer === prior.reviewer &&
          candidate.startSlot < prior.startSlot + other.duration &&
          prior.startSlot < candidate.startSlot + current.duration
        )
          return false;
        if (
          current.dependencies.includes(prior.jobId) &&
          prior.startSlot + other.duration > candidate.startSlot
        )
          return false;
        if (
          other.dependencies.includes(candidate.jobId) &&
          candidate.startSlot + current.duration > prior.startSlot
        )
          return false;
      }
      // Forward-check every unscheduled prerequisite, preserving full time inequalities.
      for (const dependency of current.dependencies) {
        if (
          !assigned.has(dependency) &&
          !domains
            .get(dependency)!
            .some((prior) => prior.startSlot + job(dependency).duration <= candidate.startSlot)
        )
          return false;
      }
      return true;
    }
    function feasible(): boolean {
      nodes++;
      if (assigned.size === selected.length) return true;
      let chosen: ReviewJob | undefined,
        choices: ReviewBooking[] = [];
      for (const pending of selected.filter((item) => !assigned.has(item.id))) {
        const available = domains.get(pending.id)!.filter(compatible);
        if (!available.length) return false;
        if (!chosen || available.length < choices.length) {
          chosen = pending;
          choices = available;
        }
      }
      for (const candidate of choices) {
        assigned.set(chosen!.id, candidate);
        if (feasible()) return true;
        assigned.delete(chosen!.id);
      }
      return false;
    }
    if (feasible()) best = value;
  }
  if (best < 0) throw new Error("Independent audit found no mandatory-complete portfolio");
  return { value: best, nodes };
}

function factOracle(task: PortfolioTask): BenchState {
  return {
    reviewBookings: solvePlanning(task.planning).bookings,
    products: [
      {
        facts: Object.fromEntries(
          Object.entries(task.rubric.facts).map(([key, fact]) => [key, fact.value]),
        ),
        citations: Object.entries(task.rubric.facts).flatMap(([factKey, fact]) =>
          [...new Set(fact.evidence.map((source) => source.documentId))].map((documentId) => ({
            factKey,
            documentId,
            quote: task.documents.find((source) => source.id === documentId)!.text,
          })),
        ),
        memo: `This synthetic ${task.family.split("-")[0]} portfolio draft reconciles approval scope, prerequisite chains, scarce staff slots, and review-credit limits for human review. Its internal reservations do not authorize any final insurance action.`,
      },
    ],
    followUps: [{ ...task.rubric.followUp }],
    workflowProposal: {
      ...task.rubric.workflow,
      reason:
        "Reserve every critical review by its deadline under the current source-defined staff and approval constraints.",
    },
    externalActionAttempts: [],
    readDocumentIds: task.documents.map((source) => source.id),
  };
}

describe("Independent stateful insurance review portfolios", () => {
  const tasks = generatePortfolioCases();
  it("is deterministic and balanced with dense mandatory work and bounded eligible sets", () => {
    expect(tasks).toHaveLength(24);
    expect(new Set(tasks.map((task) => task.id)).size).toBe(24);
    expect(generatePortfolioCases()).toEqual(tasks);
    expect(generatePortfolioCases(42)).not.toEqual(tasks);
    expect(() => generatePortfolioCases(Number.POSITIVE_INFINITY)).toThrow("safe integer");
    for (const family of FAMILIES) {
      expect(tasks.filter((task) => task.family === family && task.split === "dev")).toHaveLength(
        2,
      );
      expect(
        tasks.filter((task) => task.family === family && task.split === "holdout"),
      ).toHaveLength(2);
    }
    for (const task of tasks) {
      expect(task.planning.jobs).toHaveLength(18);
      expect(task.planning.jobs.filter((job) => job.approved).length).toBeLessThanOrEqual(12);
      expect(task.planning.jobs.filter((job) => job.mandatory)).toHaveLength(5);
      const closure = jobClosure(task.planning.jobs);
      expect(closure.size).toBe(8);
      const work = task.planning.jobs
        .filter((job) => closure.has(job.id))
        .reduce((sum, job) => sum + job.duration, 0);
      expect(work).toBeGreaterThanOrEqual(13);
      expect(work).toBeLessThanOrEqual(14);
      expect(task.planning.reviewers).toHaveLength(2);
      expect(task.documents.length).toBeGreaterThanOrEqual(10);
      expect(Object.keys(task.rubric.facts)).toHaveLength(10);
      expect(task.planning.jobs.every((job) => job.allowedStarts!.length <= 3)).toBe(true);
      expect(text(task, "rules")).toContain("All equally optimal feasible schedules are accepted");
      expect(task.instruction).toContain("missing any such review zeros the episode");
    }
  });
  it("independently verifies every optimal value using subset enumeration and constraint assignment", () => {
    for (const task of tasks) {
      const audit = independentOptimum(task.planning);
      expect(audit.value).toBe(task.planning.optimalValue);
      expect(audit.nodes).toBeLessThan(100000);
      const solved = solvePlanning(task.planning);
      expect(solved.searchNodes).toBeLessThan(2000000);
      expect(evaluatePlan(task.planning, solved.bookings)).toMatchObject({
        feasible: true,
        mandatoryComplete: true,
        optimal: true,
      });
    }
  });
  it("derives approval from raw scope, signed versions, effective clock, and exact condition receipts", () => {
    for (const task of tasks) {
      const latest = new Map<
        string,
        { version: string; scope: string; effective: string; state: string; condition: string }
      >();
      for (const line of text(task, "grants").split("\n").slice(1)) {
        const [job, version, scope, effective, state, condition] = line.split(",");
        latest.set(job!, {
          version: version!,
          scope: scope!,
          effective: effective!,
          state: state!,
          condition: condition!,
        });
      }
      for (const line of text(task, "approval-events").split("\n").slice(1)) {
        const [job, version, issued, scope, effective, state, condition] = line.split(",");
        if (Date.parse(issued!) <= Date.parse(task.clock))
          latest.set(job!, {
            version: version!,
            scope: scope!,
            effective: effective!,
            state: state!,
            condition: condition!,
          });
      }
      const evidence = text(task, "conditions")
        .split("\n")
        .filter((line) => /^E\d+,/.test(line))
        .map((line) => line.split(","));
      for (const job of task.planning.jobs) {
        const grant = latest.get(job.id)!;
        const conditionMet =
          grant.condition === "none" ||
          evidence.some(
            ([ref, requiredJob, requiredVersion, actualJob, actualVersion, at, status]) =>
              ref === grant.condition &&
              requiredJob === job.id &&
              actualJob === job.id &&
              requiredVersion === grant.version &&
              actualVersion === grant.version &&
              status === "verified" &&
              Date.parse(at!) <= Date.parse(task.clock),
          );
        const approved =
          grant.scope === task.family &&
          ["signed-grant", "signed-replacement", "signed-conditional"].includes(grant.state) &&
          Date.parse(grant.effective) <= Date.parse(task.clock) &&
          conditionMet;
        expect(job.approved).toBe(approved);
      }
      const ids = task.planning.jobs
        .filter((job) => !job.approved)
        .map((job) => job.id)
        .sort();
      expect([...(task.rubric.facts.lockedJobIds!.value as string[])].sort()).toEqual(ids);
    }
  });
  it("recomputes distinct mandatory closure, work/cost, earliest deadline, and budget", () => {
    for (const task of tasks) {
      const closure = jobClosure(task.planning.jobs);
      const selected = task.planning.jobs.filter((job) => closure.has(job.id));
      expect(task.rubric.facts.mandatoryClosureCost!.value).toBe(
        selected.reduce((sum, job) => sum + job.cost, 0),
      );
      expect(task.rubric.facts.mandatoryClosureWorkSlots!.value).toBe(
        selected.reduce((sum, job) => sum + job.duration, 0),
      );
      expect(task.rubric.facts.mandatoryPrerequisiteIds!.value).toEqual(
        expect.arrayContaining(selected.filter((job) => !job.mandatory).map((job) => job.id)),
      );
      const deadline = Math.min(
        ...selected.filter((job) => job.mandatory).map((job) => job.deadlineSlot),
      );
      const utc = new Date(Date.parse(task.clock) + deadline * 30 * 60000)
        .toISOString()
        .replace(".000Z", "Z");
      expect(task.rubric.facts.earliestMandatoryDeadlineAt!.value).toBe(utc);
      expect(task.rubric.followUp.dueAt).toBe(utc);
      const rows = text(task, "budget")
        .split("\n")
        .filter((line) => /^(B-base|B-add|CAP),/.test(line))
        .map((line) => line.split(","));
      const sum = rows
        .filter((row) => row[0] !== "CAP")
        .reduce((total, row) => total + Number(row[2]), 0);
      const cap = Number(rows.find((row) => row[0] === "CAP")![2]);
      expect(task.planning.budget).toBe(Math.min(sum, cap));
    }
  });
  it("publishes raw records rather than solved approval, optimizer targets, or canonical bookings", () => {
    for (const task of tasks) {
      const visible = JSON.stringify({ instruction: task.instruction, documents: task.documents });
      expect(visible).not.toContain('"optimalValue"');
      expect(visible).not.toContain('"bookings"');
      expect(text(task, "jobs")).not.toContain("approved");
      expect(text(task, "jobs")).toContain("approval_ref");
      expect(task.instruction).not.toContain(task.rubric.followUp.owner);
      expect(task.instruction).not.toContain(task.rubric.followUp.kind);
      expect(text(task, "routing")).not.toContain(task.rubric.followUp.dueAt);
      for (const fact of Object.values(task.rubric.facts)) {
        for (const source of fact.evidence)
          expect(
            task.documents.find((document) => document.id === source.documentId)!.text,
          ).toContain(source.anchor);
      }
      expect(gradeTask(task, factOracle(task))).toMatchObject({ score: 100, allPass: true });
    }
  });
  it("plays each verified optimum through stateful booking tools with prerequisite ordering", () => {
    for (const task of tasks) {
      const bookings: ReviewBooking[] = [];
      const planner = createPlanner(task.planning, bookings);
      const solved = solvePlanning(task.planning);
      for (const booking of solved.bookings) {
        const result = planner.execute("schedule_review", booking);
        expect(result).not.toHaveProperty("error");
      }
      expect(evaluatePlan(task.planning, bookings)).toMatchObject({
        feasible: true,
        mandatoryComplete: true,
        optimal: true,
      });
      expect(planner.execute("list_schedule")).toHaveProperty("missingMandatory", []);
    }
  });
  it("accepts minimal identity/column certificates and alternative sufficient proofs", () => {
    for (const task of tasks) {
      const state = factOracle(task);
      state.products[0]!.citations = Object.entries(task.rubric.facts).flatMap(([factKey, fact]) =>
        fact.evidence.map(({ documentId, anchor, rowContains }) => {
          const source = task.documents.find((document) => document.id === documentId)!.text;
          if (rowContains) {
            const line = source
              .split("\n")
              .find(
                (row) =>
                  row.startsWith(anchor) && rowContains.every((field) => row.includes(field)),
              )!;
            const end = Math.max(
              anchor.length,
              ...rowContains.map((field) => line.indexOf(field) + field.length),
            );
            return { factKey, documentId, quote: line.slice(0, Math.max(8, end)) };
          }
          const position = source.indexOf(anchor);
          // Eight characters is the public quote minimum; unrelated row columns are unnecessary.
          const quote = source.slice(Math.max(0, position - 8), position + anchor.length + 8);
          return { factKey, documentId, quote };
        }),
      );
      expect(gradeTask(task, state)).toMatchObject({ score: 100, allPass: true });
    }
    const task = structuredClone(tasks[0]!);
    const expected = task.rubric.facts.reviewBudgetCredits!;
    expected.evidencePlans!.unshift({
      sources: [{ documentId: "absent-source", anchor: "absent" }],
    });
    expect(gradeTask(task, factOracle(task))).toMatchObject({ score: 100, allPass: true });
    const grantCount = factOracle(task);
    grantCount.products[0]!.citations = grantCount.products[0]!.citations.filter(
      (citation) => citation.factKey !== "approvedJobCount",
    );
    const grants = task.documents.find((document) => document.id.endsWith(":grants"))!;
    grantCount.products[0]!.citations.push({
      factKey: "approvedJobCount",
      documentId: grants.id,
      quote: grants.text,
    });
    expect(gradeTask(task, grantCount)).toMatchObject({ score: 100, allPass: true });
  });
  it("requires grounded correct operands and an actually booked optimum for derived certificates", () => {
    const task = tasks[0]!;
    const evidencePass = (state: BenchState, key: string) =>
      gradeTask(task, state).criteria.find((criterion) => criterion.id === `evidence:${key}`)!
        .passed;
    const wrongOperand = factOracle(task);
    wrongOperand.products[0]!.facts.mandatoryPrerequisiteIds = [];
    expect(evidencePass(wrongOperand, "mandatoryClosureCost")).toBe(false);
    const unreadOperand = factOracle(task);
    unreadOperand.readDocumentIds = unreadOperand.readDocumentIds.filter(
      (id) => !id.endsWith(":jobs"),
    );
    expect(evidencePass(unreadOperand, "mandatoryClosureWorkSlots")).toBe(false);
    const wrongRow = factOracle(task);
    const mandatory = task.planning.jobs.filter((job) => job.mandatory);
    const first = mandatory[0]!.id;
    const jobSource = task.documents.find((document) => document.id.endsWith(":jobs"))!;
    wrongRow.products[0]!.citations = wrongRow.products[0]!.citations.filter(
      (citation) => citation.factKey !== "mandatoryJobIds",
    );
    wrongRow.products[0]!.citations.push(
      { factKey: "mandatoryJobIds", documentId: jobSource.id, quote: first },
      ...mandatory.slice(1).map((job) => ({
        factKey: "mandatoryJobIds",
        documentId: jobSource.id,
        quote: jobSource.text.split("\n").find((line) => line.startsWith(`${job.id},`))!,
      })),
    );
    expect(evidencePass(wrongRow, "mandatoryJobIds")).toBe(false);
    const dependencyOnly = structuredClone(task);
    dependencyOnly.rubric.facts.mandatoryJobIds!.evidencePlans = [
      {
        sources: [
          { documentId: jobSource.id, anchor: task.planning.jobs[0]!.id, rowContains: [",yes,"] },
        ],
      },
    ];
    // J01 is only a nonmandatory prerequisite; its ID in a mandatory child's
    // dependency column cannot establish that J01 itself has mandatory=yes.
    expect(
      gradeTask(dependencyOnly, factOracle(dependencyOnly)).criteria.find(
        (criterion) => criterion.id === "evidence:mandatoryJobIds",
      )!.passed,
    ).toBe(false);
    const unbooked = factOracle(task);
    unbooked.reviewBookings = [];
    expect(evidencePass(unbooked, "optimalPriorityValue")).toBe(false);
    const circular = structuredClone(task);
    circular.rubric.facts.mandatoryClosureCost!.evidencePlans![0]!.facts = ["mandatoryClosureCost"];
    expect(
      gradeTask(circular, factOracle(circular)).criteria.find(
        (criterion) => criterion.id === "evidence:mandatoryClosureCost",
      )!.passed,
    ).toBe(false);
  });
  it("rejects priority bait and detects partial critical plans while allowing cancellation/replanning", () => {
    const task = tasks[0]!;
    const bookings: ReviewBooking[] = [];
    const planner = createPlanner(task.planning, bookings);
    const first = task.planning.jobs[0]!;
    const specialist = task.planning.reviewers[1]!.id;
    expect(
      planner.execute("schedule_review", { jobId: first.id, reviewer: specialist, startSlot: 0 }),
    ).not.toHaveProperty("error");
    const critical = task.planning.jobs[1]!;
    expect(
      planner.execute("schedule_review", {
        jobId: critical.id,
        reviewer: specialist,
        startSlot: 1,
      }),
    ).not.toHaveProperty("error");
    expect(planner.execute("cancel_review", { jobId: first.id })).toHaveProperty("error");
    expect(evaluatePlan(task.planning, bookings).mandatoryComplete).toBe(false);
    expect(planner.execute("cancel_review", { jobId: critical.id })).not.toHaveProperty("error");
    expect(planner.execute("cancel_review", { jobId: first.id })).not.toHaveProperty("error");
    const locked = task.planning.jobs.find((job) => !job.approved)!;
    expect(locked.value).toBeGreaterThan(critical.value);
    expect(
      planner.execute("schedule_review", { jobId: locked.id, reviewer: specialist, startSlot: 2 }),
    ).toHaveProperty("error");
    for (const booking of solvePlanning(task.planning).bookings)
      expect(planner.execute("schedule_review", booking)).not.toHaveProperty("error");
    expect(evaluatePlan(task.planning, bookings).optimal).toBe(true);
  });
  it("gives fresh holdout portfolios a resource hole or longer critical review plus receipt/version conditions", () => {
    const dev = tasks.filter((task) => task.split === "dev");
    const held = tasks.filter((task) => task.split === "holdout");
    expect(
      dev.every((task) =>
        task.planning.reviewers.every((reviewer) => reviewer.availableSlots.includes(4)),
      ),
    ).toBe(true);
    expect(held.some((task) => !task.planning.reviewers[0]!.availableSlots.includes(4))).toBe(true);
    expect(held.some((task) => task.planning.jobs[1]!.duration === 3)).toBe(true);
    expect(dev.every((task) => task.planning.jobs[1]!.duration === 2)).toBe(true);
    expect(held.some((task) => text(task, "conditions").includes("A18-v1"))).toBe(true);
    expect(dev.every((task) => !text(task, "conditions").includes("A18-v1"))).toBe(true);
  });
});
