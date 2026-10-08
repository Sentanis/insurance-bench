import assert from "node:assert/strict";
import { test } from "node:test";
import { createPlanner, evaluatePlan, solvePlanning } from "../insurance-bench/planning.ts";
import type { PlanningScenario, ReviewBooking, ReviewJob } from "../insurance-bench/planning-types.ts";

function job(id: string, fields: Partial<ReviewJob> = {}): ReviewJob {
  return { id, duration: 1, requiredSkill: "claim", cost: 1, value: 1, releaseSlot: 0, deadlineSlot: 4, dependencies: [], approved: true, mandatory: false, ...fields };
}
function scenario(jobs = [job("A", { mandatory: true }), job("B", { dependencies: ["A"], value: 5 })]): PlanningScenario {
  return { slots: 4, reviewers: [{ id: "r1", skills: ["claim"], availableSlots: [0, 1, 2, 3] }], jobs, budget: 2, optimalValue: 6 };
}
const plan: ReviewBooking[] = [{ jobId: "A", reviewer: "r1", startSlot: 0 }, { jobId: "B", reviewer: "r1", startSlot: 1 }];

// This oracle uses direct row/slot comparisons and never calls the production grader or solver.
function oracleValue(input: PlanningScenario, bookings: ReviewBooking[]): number | null {
  if (new Set(bookings.map(item => item.jobId)).size !== bookings.length) return null;
  let cost = 0, value = 0;
  for (const booking of bookings) {
    const row = input.jobs.find(item => item.id === booking.jobId);
    const staff = input.reviewers.find(item => item.id === booking.reviewer);
    if (!row || !row.approved || !staff || !staff.skills.includes(row.requiredSkill)) return null;
    const end = booking.startSlot + row.duration;
    if (!Number.isSafeInteger(booking.startSlot) || booking.startSlot < row.releaseSlot || end > row.deadlineSlot || (row.allowedStarts && !row.allowedStarts.includes(booking.startSlot))) return null;
    for (let time = booking.startSlot; time < end; time++) {
      if (!staff.availableSlots.includes(time)) return null;
      for (const other of bookings) {
        if (other === booking || other.reviewer !== booking.reviewer) continue;
        const otherRow = input.jobs.find(item => item.id === other.jobId);
        if (!otherRow) return null;
        if (time >= other.startSlot && time < other.startSlot + otherRow.duration) return null;
      }
    }
    for (const prerequisite of row.dependencies) {
      const reserved = bookings.find(item => item.jobId === prerequisite);
      const prerequisiteRow = input.jobs.find(item => item.id === prerequisite);
      if (!reserved || !prerequisiteRow || reserved.startSlot + prerequisiteRow.duration > booking.startSlot) return null;
    }
    cost += row.cost; value += row.value;
  }
  if (cost > input.budget || input.jobs.some(row => row.mandatory && !bookings.some(item => item.jobId === row.id))) return null;
  return value;
}

test("property grader accepts distinct equal-value optima and never depends on canonical booking order", () => {
  const input = scenario();
  assert.equal(evaluatePlan(input, plan).optimal, true);
  assert.equal(evaluatePlan(input, [{ jobId: "B", reviewer: "r1", startSlot: 3 }, { jobId: "A", reviewer: "r1", startSlot: 2 }]).optimal, true);
  assert.equal(evaluatePlan(input, [plan[0]!]).feasible, true);
  assert.equal(evaluatePlan(input, [plan[0]!]).optimal, false);
  assert.equal(evaluatePlan(input, []).mandatoryComplete, false);
});

test("grader rejects overlap, missing/late dependency, duplicate and unknown jobs", () => {
  const input = scenario();
  for (const bookings of [
    [plan[0]!, { ...plan[1]!, startSlot: 0 }],
    [plan[1]!],
    [{ ...plan[0]!, startSlot: 2 }, plan[1]!],
    [plan[0]!, plan[0]!],
    [{ ...plan[0]!, jobId: "unknown" }],
  ]) assert.equal(evaluatePlan(input, bookings).feasible, false);
});

test("grader checks every occupied slot, skills, approval, budget, window and allowedStarts", () => {
  const input = scenario([job("A", { duration: 2, mandatory: true, allowedStarts: [1] })]);
  input.optimalValue = 1;
  const legal = [{ jobId: "A", reviewer: "r1", startSlot: 1 }];
  assert.equal(evaluatePlan(input, legal).optimal, true);
  assert.equal(evaluatePlan(input, [{ ...legal[0]!, startSlot: 0 }]).feasible, false);
  assert.equal(evaluatePlan(input, [{ ...legal[0]!, startSlot: 1.5 }]).feasible, false);
  assert.equal(evaluatePlan(input, [{ ...legal[0]!, startSlot: 3 }]).feasible, false);
  assert.equal(evaluatePlan({ ...input, budget: 0 }, legal).feasible, false);
  assert.equal(evaluatePlan({ ...input, jobs: [{ ...input.jobs[0]!, approved: false }] }, legal).feasible, false);
  assert.equal(evaluatePlan({ ...input, reviewers: [{ ...input.reviewers[0]!, skills: ["legal"] }] }, legal).feasible, false);
  assert.equal(evaluatePlan({ ...input, reviewers: [{ ...input.reviewers[0]!, availableSlots: [0, 1, 3] }] }, legal).feasible, false);
});

test("planner is transactional, requires booked dependencies and cancels in reverse dependency order", () => {
  const bookings: ReviewBooking[] = [];
  const planner = createPlanner(scenario(), bookings);
  assert(planner.execute("schedule_review", { jobId: "B", reviewer: "r1", startSlot: 1 }).error);
  assert.deepEqual(bookings, []);
  assert(!planner.execute("schedule_review", plan[0]!).error);
  assert(planner.execute("schedule_review", plan[0]!).error);
  assert.equal(bookings.length, 1);
  assert(planner.execute("schedule_review", { ...plan[1]!, startSlot: 0 }).error);
  assert.equal(bookings.length, 1);
  assert(!planner.execute("schedule_review", plan[1]!).error);
  assert(planner.execute("cancel_review", { jobId: "A" }).error);
  assert.equal(bookings.length, 2);
  const output = planner.execute("list_schedule");
  assert.equal(output.value, 6); assert.equal(output.cost, 2);
  assert(!("optimalValue" in output)); assert(!("optimal" in output));
  assert(!planner.execute("cancel_review", { jobId: "B" }).error);
  assert(!planner.execute("cancel_review", { jobId: "A" }).error);
  assert.deepEqual(bookings, []);
  assert(planner.execute("cancel_review", { jobId: "A" }).error);
});

test("planner rejects unapproved jobs with violations and validates hidden target on construction", () => {
  const input = scenario([job("stale", { approved: false })]);
  const bookings: ReviewBooking[] = [];
  const rejected = createPlanner(input, bookings).execute("schedule_review", { jobId: "stale", reviewer: "r1", startSlot: 0 });
  assert.equal(rejected.error, "Booking rejected");
  assert.deepEqual(rejected.violations, ["Job stale lacks current approval"]);
  assert.deepEqual(bookings, []);
  for (const optimalValue of [-1, Number.NaN, 1.5, Number.POSITIVE_INFINITY]) assert.throws(() => createPlanner({ ...input, optimalValue }, []), /Planning target/);
  assert(createPlanner(input, []).execute("schedule_review", null).error);
});

test("solver finds manually computed budget optimum and enforces mandatory prerequisite closure", () => {
  const input = scenario([
    job("A", { mandatory: true, dependencies: ["intake"], value: 2 }),
    job("intake", { value: 0 }),
    job("big", { duration: 2, cost: 2, value: 8 }),
    job("small", { value: 7 }),
    job("stale", { value: 100, approved: false }),
  ]);
  input.budget = 3;
  // Intake+A consume 2 cost and 2 slots; only small fits remaining budget: 2+7=9.
  const result = solvePlanning(input);
  assert.equal(result.optimalValue, 9);
  assert.equal(evaluatePlan({ ...input, optimalValue: 9 }, result.bookings).optimal, true);
  assert(result.bookings.some(booking => booking.jobId === "intake"));
  assert(!result.bookings.some(booking => booking.jobId === "stale"));
  assert(result.searchNodes > 0 && result.searchNodes < 2_000_000);
});

test("solver rejects impossible mandatory plans instead of publishing guessed gold", () => {
  const unapproved = scenario([job("A", { mandatory: true, approved: false })]);
  assert.throws(() => solvePlanning(unapproved), /No mandatory-complete/);
  assert.throws(() => solvePlanning({ ...scenario(), budget: 0 }), /No mandatory-complete/);
  assert.throws(() => solvePlanning(scenario([job("A", { mandatory: true, dependencies: ["blocked"] }), job("blocked", { approved: false })])), /No mandatory-complete/);
  assert.throws(() => solvePlanning(scenario([job("A", { mandatory: true, duration: 4 }), job("B", { mandatory: true })])), /No mandatory-complete/);
});

test("scenario validation rejects cyclic/missing dependencies and malformed numeric bounds", () => {
  const invalid = [
    scenario([job("A", { dependencies: ["B"] }), job("B", { dependencies: ["A"] })]),
    scenario([job("A", { dependencies: ["missing"] })]),
    scenario([job("A"), job("A")]),
    scenario([job("A", { cost: 0.5 })]),
    scenario([job("A", { value: -1 })]),
    scenario([job("A", { duration: 0 })]),
    scenario([job("A", { duration: 3, releaseSlot: 0, deadlineSlot: 1 })]),
    scenario([job("A", { allowedStarts: [4] })]),
    { ...scenario(), budget: Number.NaN },
    { ...scenario(), slots: 9 },
    { ...scenario(), jobs: Array.from({ length: 21 }, (_, i) => job(String(i))) },
  ];
  for (const input of invalid) assert.throws(() => solvePlanning(input));
});

test("search ceiling fails explicitly without guessed gold and cannot exceed the hard bound", () => {
  assert.throws(() => solvePlanning(scenario(), { maxSearchNodes: 1 }), /exceeded 1 nodes; optimum remains unverified/);
  assert.throws(() => solvePlanning(scenario(), { maxSearchNodes: 2_000_001 }), /search ceiling/);
  assert.throws(() => solvePlanning(scenario(), { maxSearchNodes: 0 }), /search ceiling/);
});

test("small independent brute-force enumeration agrees with exact solver", () => {
  for (let seed = 0; seed < 12; seed++) {
    const input = scenario([
      job("A", { value: 2, mandatory: true, duration: 1 + seed % 2, allowedStarts: [0] }),
      job("B", { dependencies: ["A"], value: 3 + seed % 3 }),
      job("C", { cost: 2, value: 4 + seed % 5 }),
    ]);
    input.reviewers.push({ id: "r2", skills: ["claim"], availableSlots: [0, 1, 3] });
    input.budget = 2 + seed % 2;
    let best = -1;
    function enumerate(index: number, bookings: ReviewBooking[]): void {
      if (index === input.jobs.length) {
        const value = oracleValue(input, bookings);
        if (value !== null) best = Math.max(best, value);
        return;
      }
      enumerate(index + 1, bookings);
      for (const reviewer of input.reviewers) for (let slot = 0; slot < input.slots; slot++) enumerate(index + 1, [...bookings, { jobId: input.jobs[index]!.id, reviewer: reviewer.id, startSlot: slot }]);
    }
    enumerate(0, []);
    const exact = solvePlanning(input);
    assert.equal(exact.optimalValue, best, `seed ${seed}`);
    assert.equal(oracleValue(input, exact.bookings), best);
  }
});

test("independent enumeration covers eight slots, three reviewers and deeper prerequisite chains", () => {
  const input: PlanningScenario = {
    slots: 8,
    budget: 5,
    optimalValue: 0,
    reviewers: [
      { id: "records", skills: ["records"], availableSlots: [0, 1, 2, 3, 4, 5, 6, 7] },
      { id: "audit", skills: ["quantitative"], availableSlots: [2, 3, 4, 5] },
      { id: "legal", skills: ["specialist"], availableSlots: [5, 6, 7] },
    ],
    jobs: [
      job("intake", { requiredSkill: "records", duration: 2, deadlineSlot: 8, allowedStarts: [0, 1], value: 0 }),
      job("audit", { requiredSkill: "quantitative", duration: 3, deadlineSlot: 8, allowedStarts: [2, 3], dependencies: ["intake"], value: 2 }),
      job("counsel", { requiredSkill: "specialist", duration: 2, deadlineSlot: 8, allowedStarts: [5, 6], dependencies: ["audit"], mandatory: true, value: 4 }),
      job("optional", { requiredSkill: "records", duration: 3, deadlineSlot: 8, allowedStarts: [2, 4], cost: 2, value: 7 }),
    ],
  };
  let best = -1;
  function enumerate(index: number, bookings: ReviewBooking[]): void {
    if (index === input.jobs.length) {
      const value = oracleValue(input, bookings);
      if (value !== null) best = Math.max(best, value);
      return;
    }
    enumerate(index + 1, bookings);
    const row = input.jobs[index]!;
    for (const staff of input.reviewers) for (const startSlot of row.allowedStarts!) enumerate(index + 1, [...bookings, { jobId: row.id, reviewer: staff.id, startSlot }]);
  }
  enumerate(0, []);
  assert.equal(best, 13);
  const result = solvePlanning(input);
  assert.equal(result.optimalValue, best);
  assert.equal(oracleValue(input, result.bookings), best);
});
