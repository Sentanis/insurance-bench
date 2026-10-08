import { describe, expect, it } from "vitest";
import { generateFrontierCases } from "../../insurance-bench/frontier-cases.ts";
import { createPlanner, evaluatePlan, solvePlanning } from "../../insurance-bench/planning.ts";
import { FAMILIES, type BenchState } from "../../insurance-bench/types.ts";
import type {
  PlanningScenario,
  ReviewBooking,
  ReviewJob,
} from "../../insurance-bench/planning-types.ts";
import type { PortfolioTask } from "../../insurance-bench/portfolio-cases.ts";
import { gradeTask } from "../../insurance-bench/score.ts";
function text(task: PortfolioTask, suffix: string) {
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

function oracle(task: PortfolioTask): BenchState {
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
        memo: `Synthetic ${task.family.split("-")[0]} capacity and prerequisite schedule for human review. The review portfolio reserves internal work under source-defined qualifications and approvals.`,
      },
    ],
    followUps: [{ ...task.rubric.followUp }],
    workflowProposal: {
      ...task.rubric.workflow,
      reason:
        "Reserve the critical review chains under current authority, staff appointments, and adjusted review-credit limits.",
    },
    externalActionAttempts: [],
    readDocumentIds: task.documents.map((source) => source.id),
  };
}
function rawScenario(task: PortfolioTask): Omit<PlanningScenario, "optimalValue"> {
  const latest = new Map<string, string[]>();
  for (const line of text(task, "grants").split("\n").slice(1)) {
    const [id, ...rest] = line.split(",");
    latest.set(id!, rest);
  }
  for (const line of text(task, "approval-events").split("\n").slice(1)) {
    const [id, version, issued, ...rest] = line.split(",");
    if (Date.parse(issued!) <= Date.parse(task.clock)) latest.set(id!, [version!, ...rest]);
  }
  const conditions = text(task, "conditions")
    .split("\n")
    .filter((line) => /^E\d+,/.test(line))
    .map((line) => line.split(","));
  const jobs: ReviewJob[] = text(task, "jobs")
    .split("\n")
    .slice(1)
    .map((line) => {
      const [id, , duration, skill, cost, value, release, deadline, deps, mandatory, starts] =
        line.split(",");
      const [version, scope, effective, state, condition] = latest.get(id!)!;
      const met =
        condition === "none" ||
        conditions.some(
          ([ref, requiredJob, requiredVersion, evidenceJob, evidenceVersion, at, status]) =>
            ref === condition &&
            requiredJob === id &&
            evidenceJob === id &&
            requiredVersion === version &&
            evidenceVersion === version &&
            status === "verified" &&
            Date.parse(at!) <= Date.parse(task.clock),
        );
      return {
        id: id!,
        duration: Number(duration),
        requiredSkill: skill!,
        cost: Number(cost),
        value: Number(value),
        releaseSlot: Number(release),
        deadlineSlot: Number(deadline),
        dependencies: deps ? deps.split("|") : [],
        mandatory: mandatory === "yes",
        allowedStarts: starts!.split("|").map(Number),
        approved:
          scope === task.family &&
          ["signed-grant", "signed-replacement", "signed-conditional"].includes(state!) &&
          Date.parse(effective!) <= Date.parse(task.clock) &&
          met,
      };
    });
  const reviewers = text(task, "staff")
    .split("\n")
    .slice(1)
    .map((line) => {
      const [id, skills, start, end, slots] = line.split(",");
      return {
        id: id!,
        skills:
          Date.parse(start!) <= Date.parse(task.clock) && Date.parse(task.clock) < Date.parse(end!)
            ? skills!.split("|")
            : [],
        availableSlots: slots!.split("|").map(Number),
      };
    });
  const ledger = text(task, "budget")
    .split("\n")
    .filter((line) => /^(B-base|CAP),/.test(line))
    .map((line) => line.split(","));
  const capacity = text(task, "family-capacity").split("\n")[2]!.split(",");
  const debit = capacity[2] === "yes" && capacity[3] === "yes" ? 2 : 0;
  const budget = Math.min(
    Number(ledger.find((row) => row[0] === "B-base")![2]) - debit,
    Number(ledger.find((row) => row[0] === "CAP")![2]),
  );
  return { slots: 8, jobs, reviewers, budget };
}
describe("Frontier candidate three raw insurance portfolios", () => {
  const cases = generateFrontierCases();
  it("is deterministic, balanced, dense, and uses fresh family/seed-specific graphs", () => {
    expect(cases).toHaveLength(24);
    expect(generateFrontierCases()).toEqual(cases);
    expect(generateFrontierCases(42)).not.toEqual(cases);
    for (const family of FAMILIES) {
      expect(cases.filter((task) => task.family === family && task.split === "dev")).toHaveLength(
        2,
      );
      expect(
        cases.filter((task) => task.family === family && task.split === "holdout"),
      ).toHaveLength(2);
    }
    const shapes = new Set<string>();
    for (const task of cases) {
      expect(task.id.startsWith("ibf-")).toBe(true);
      expect(task.planning.jobs).toHaveLength(20);
      expect(task.planning.reviewers).toHaveLength(3);
      expect(task.planning.jobs.filter((job) => job.mandatory)).toHaveLength(5);
      expect(jobClosure(task.planning.jobs).size).toBe(11);
      expect(task.rubric.facts.mandatoryClosureWorkSlots!.value).toBeGreaterThanOrEqual(21);
      expect(task.rubric.facts.mandatoryClosureWorkSlots!.value).toBeLessThanOrEqual(23);
      expect(task.instruction).toContain("missing any such review zeros the episode");
      shapes.add(
        JSON.stringify(
          task.planning.jobs.map((job) => [
            job.duration,
            job.requiredSkill,
            job.dependencies.map((id) => id.split(":J")[1]),
            job.allowedStarts,
          ]),
        ),
      );
    }
    expect(shapes.size).toBe(24);
  });
  it("reconstructs every hidden operational job/staff/approval/budget value from raw sources", () => {
    for (const task of cases) {
      const raw = rawScenario(task);
      expect(raw.jobs).toEqual(task.planning.jobs);
      expect(raw.reviewers).toEqual(task.planning.reviewers);
      expect(raw.budget).toBe(task.planning.budget);
      const capacity = text(task, "family-capacity").split("\n")[2]!.split(",");
      if (capacity[2] === "yes" && capacity[3] === "yes") {
        const ledger = text(task, "budget")
          .split("\n")
          .filter((line) => /^(B-base|CAP),/.test(line))
          .map((line) => line.split(","));
        const noDebit = Math.min(...ledger.map((row) => Number(row[2])));
        expect(raw.budget).toBeLessThan(noDebit);
      }
      const solved = solvePlanning(raw);
      expect(solved.optimalValue).toBe(task.planning.optimalValue);
      expect(solved.searchNodes).toBeLessThan(2000000);
      const critical = raw.jobs.filter((job) => job.mandatory);
      const closureIds = jobClosure(raw.jobs);
      const closure = raw.jobs.filter((job) => closureIds.has(job.id));
      const expected = {
        mandatoryJobIds: critical.map((job) => job.id),
        mandatoryPrerequisiteIds: closure.filter((job) => !job.mandatory).map((job) => job.id),
        mandatoryClosureCost: closure.reduce((sum, job) => sum + job.cost, 0),
        mandatoryClosureWorkSlots: closure.reduce((sum, job) => sum + job.duration, 0),
        lockedJobIds: raw.jobs.filter((job) => !job.approved).map((job) => job.id),
        approvedJobCount: raw.jobs.filter((job) => job.approved).length,
        reviewBudgetCredits: raw.budget,
        earliestMandatoryDeadlineAt: new Date(
          Date.parse(task.clock) +
            Math.min(...critical.map((job) => job.deadlineSlot)) * 30 * 60000,
        )
          .toISOString()
          .replace(".000Z", "Z"),
        criticalQualifiedReviewerIds: raw.reviewers
          .filter((reviewer) => critical.some((job) => reviewer.skills.includes(job.requiredSkill)))
          .map((reviewer) => reviewer.id),
        optimalPriorityValue: solved.optimalValue,
      };
      for (const [key, value] of Object.entries(expected)) {
        const gold = task.rubric.facts[key]!.value;
        expect(Array.isArray(value) ? [...value].sort() : value).toEqual(
          Array.isArray(gold) ? [...gold].sort() : gold,
        );
      }
    }
    expect(
      cases.some((task) => text(task, "family-capacity").split("\n")[2]!.endsWith(",yes,yes")),
    ).toBe(true);
  });
  it("independently proves every optimum by subset enumeration and MRV constraint assignment", () => {
    for (const task of cases) {
      const independent = independentOptimum(task.planning);
      expect(independent.value).toBe(task.planning.optimalValue);
      expect(independent.nodes).toBeLessThan(1000000);
    }
  });
  it("gives actual booked oracles 100 and zeros missing critical reservations", () => {
    for (const task of cases) {
      const state = oracle(task);
      expect(gradeTask(task, state)).toMatchObject({ score: 100, allPass: true });
      state.reviewBookings = [];
      expect(gradeTask(task, state)).toMatchObject({ score: 0, criticalFailure: true });
    }
  });
  it("accepts credentials alone with grounded mandatory IDs and any winning earliest-deadline witness", () => {
    for (const task of cases) {
      const state = oracle(task);
      const reviewerKey = "criticalQualifiedReviewerIds";
      state.products[0]!.citations = state.products[0]!.citations.filter(
        (citation) => citation.factKey !== reviewerKey,
      );
      const staff = task.documents.find((source) => source.id.endsWith(":staff"))!;
      state.products[0]!.citations.push({
        factKey: reviewerKey,
        documentId: staff.id,
        quote: staff.text,
      });
      expect(
        gradeTask(task, state).criteria.find(
          (criterion) => criterion.id === `evidence:${reviewerKey}`,
        )!.passed,
      ).toBe(true);
      const deadlineKey = "earliestMandatoryDeadlineAt";
      state.products[0]!.citations = state.products[0]!.citations.filter(
        (citation) => citation.factKey !== deadlineKey,
      );
      const proof = task.rubric.facts[deadlineKey]!.evidencePlans!.at(-1)!.sources[0]!;
      const jobDocument = task.documents.find((document) => document.id === proof.documentId)!;
      const winningRow = jobDocument.text
        .split("\n")
        .find((line) => line.startsWith(`${proof.anchor},`))!;
      state.products[0]!.citations.push({
        factKey: deadlineKey,
        documentId: proof.documentId,
        quote: winningRow,
      });
      expect(
        gradeTask(task, state).criteria.find(
          (criterion) => criterion.id === `evidence:${deadlineKey}`,
        )!.passed,
      ).toBe(true);
    }
  });
  it("uses property-based optimum acceptance and stateful dependency-first tools", () => {
    for (const task of cases) {
      const bookings: ReviewBooking[] = [];
      const planner = createPlanner(task.planning, bookings);
      for (const booking of solvePlanning(task.planning).bookings)
        expect(planner.execute("schedule_review", booking)).not.toHaveProperty("error");
      expect(evaluatePlan(task.planning, bookings)).toMatchObject({
        feasible: true,
        mandatoryComplete: true,
        optimal: true,
      });
    }
  });
  it("keeps hidden optimum, witness schedule, and normalized approval out of visible documents", () => {
    for (const task of cases) {
      const visible = JSON.stringify({ documents: task.documents, instruction: task.instruction });
      expect(visible).not.toContain("optimalValue");
      expect(visible).not.toContain('startSlot":');
      expect(text(task, "jobs").split("\n")[0]).not.toContain("approved");
      expect(task.instruction).not.toContain(task.rubric.followUp.owner);
      for (const fact of Object.values(task.rubric.facts))
        for (const proof of fact.evidence) {
          const source = task.documents.find((document) => document.id === proof.documentId)!;
          expect(source.text).toContain(proof.anchor);
          if (proof.rowContains)
            expect(
              source.text
                .split("\n")
                .some(
                  (line) =>
                    line.startsWith(proof.anchor) &&
                    proof.rowContains!.every((field) => line.includes(field)),
                ),
            ).toBe(true);
        }
    }
  });
});
