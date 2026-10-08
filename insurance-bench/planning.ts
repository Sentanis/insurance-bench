import type { PlanEvaluation, PlanningScenario, ReviewBooking, ReviewJob } from "./planning-types.ts";

type ScenarioInput = Omit<PlanningScenario, "optimalValue">;
const MAX_SEARCH_NODES = 2_000_000;
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const unique = (items: readonly unknown[]) => new Set(items).size === items.length;

/** Structural validation is separate from whether any mandatory-complete plan exists. */
function validate(scenario: ScenarioInput): Map<string, ReviewJob> {
  if (!integer(scenario.slots) || scenario.slots < 1 || scenario.slots > 8) throw new Error("Planning slots must be between 1 and 8");
  if (!integer(scenario.budget)) throw new Error("Planning budget must be a nonnegative safe integer");
  if (!Array.isArray(scenario.jobs) || scenario.jobs.length > 20) throw new Error("Planning supports at most 20 jobs");
  if (!Array.isArray(scenario.reviewers) || scenario.reviewers.length < 1 || scenario.reviewers.length > 3) throw new Error("Planning supports 1 to 3 reviewers");
  const validId = (id: unknown): id is string => typeof id === "string" && id.trim().length > 0;
  const reviewers = new Set<string>();
  for (const reviewer of scenario.reviewers) {
    if (!validId(reviewer.id) || reviewers.has(reviewer.id)) throw new Error("Reviewer IDs must be unique nonempty strings");
    reviewers.add(reviewer.id);
    if (!Array.isArray(reviewer.skills) || !reviewer.skills.every(validId) || !unique(reviewer.skills)) throw new Error("Reviewer skills must be unique nonempty strings");
    if (!Array.isArray(reviewer.availableSlots) || !unique(reviewer.availableSlots) || !reviewer.availableSlots.every(slot => integer(slot) && slot < scenario.slots)) throw new Error("Reviewer availability must contain unique in-range slots");
  }
  const jobs = new Map<string, ReviewJob>();
  let totalCost = 0, totalValue = 0;
  for (const job of scenario.jobs) {
    if (!validId(job.id) || jobs.has(job.id)) throw new Error("Job IDs must be unique nonempty strings");
    if (!validId(job.requiredSkill) || !integer(job.duration) || job.duration < 1 || job.duration > scenario.slots || !integer(job.cost) || !integer(job.value)) throw new Error("Job duration, skill, cost or value is invalid");
    if (!integer(job.releaseSlot) || !integer(job.deadlineSlot) || job.releaseSlot + job.duration > job.deadlineSlot || job.deadlineSlot > scenario.slots) throw new Error("Job release/deadline bounds are invalid");
    if (typeof job.approved !== "boolean" || typeof job.mandatory !== "boolean") throw new Error("Job approval and mandatory flags must be booleans");
    if (!Array.isArray(job.dependencies) || !job.dependencies.every(validId) || !unique(job.dependencies)) throw new Error("Job dependencies must be unique IDs");
    if (job.allowedStarts !== undefined && (!Array.isArray(job.allowedStarts) || !unique(job.allowedStarts) || !job.allowedStarts.every(start => integer(start) && start >= job.releaseSlot && start + job.duration <= job.deadlineSlot))) throw new Error("Allowed starts must be unique within the job window");
    totalCost += job.cost; totalValue += job.value;
    if (!Number.isSafeInteger(totalCost) || !Number.isSafeInteger(totalValue)) throw new Error("Aggregate planning cost/value exceeds safe integer bounds");
    jobs.set(job.id, job);
  }
  const active = new Set<string>(), done = new Set<string>();
  function visit(id: string): void {
    if (active.has(id)) throw new Error("Planning dependency cycle");
    if (done.has(id)) return;
    active.add(id);
    for (const dependency of jobs.get(id)!.dependencies) {
      if (!jobs.has(dependency)) throw new Error("Planning dependency references an unknown job");
      visit(dependency);
    }
    active.delete(id); done.add(id);
  }
  for (const id of jobs.keys()) visit(id);
  return jobs;
}

function validateTarget(scenario: PlanningScenario): void {
  if (!integer(scenario.optimalValue)) throw new Error("Planning target must be a nonnegative safe integer");
}

/** Grade properties of the submitted schedule, accepting every equal-value optimum. */
export function evaluatePlan(scenario: PlanningScenario, bookings: readonly ReviewBooking[]): PlanEvaluation {
  const jobs = validate(scenario);
  validateTarget(scenario);
  const violations: string[] = [], booked = new Map<string, ReviewBooking>();
  const occupied = new Map<string, Set<number>>();
  let value = 0, cost = 0;
  for (const booking of bookings) {
    const job = jobs.get(booking.jobId);
    if (!job) { violations.push(`Unknown job ${booking.jobId}`); continue; }
    if (booked.has(job.id)) { violations.push(`Duplicate job ${job.id}`); continue; }
    booked.set(job.id, booking); value += job.value; cost += job.cost;
    if (!job.approved) violations.push(`Job ${job.id} lacks current approval`);
    const reviewer = scenario.reviewers.find(candidate => candidate.id === booking.reviewer);
    if (!reviewer) { violations.push(`Unknown reviewer for ${job.id}`); continue; }
    if (!reviewer.skills.includes(job.requiredSkill)) violations.push(`Reviewer lacks required skill for ${job.id}`);
    if (!integer(booking.startSlot) || booking.startSlot < job.releaseSlot || booking.startSlot + job.duration > job.deadlineSlot || (job.allowedStarts !== undefined && !job.allowedStarts.includes(booking.startSlot))) {
      violations.push(`Invalid start/window for ${job.id}`); continue;
    }
    const slots = occupied.get(reviewer.id) ?? new Set<number>(); occupied.set(reviewer.id, slots);
    for (let slot = booking.startSlot; slot < booking.startSlot + job.duration; slot++) {
      if (!reviewer.availableSlots.includes(slot)) violations.push(`Reviewer unavailable for ${job.id} at slot ${slot}`);
      if (slots.has(slot)) violations.push(`Reviewer overlap for ${job.id} at slot ${slot}`);
      slots.add(slot);
    }
  }
  for (const [id, booking] of booked) {
    for (const dependency of jobs.get(id)!.dependencies) {
      const prior = booked.get(dependency);
      if (!prior) violations.push(`Missing dependency ${dependency} for ${id}`);
      else if (!integer(prior.startSlot) || !integer(booking.startSlot) || prior.startSlot + jobs.get(dependency)!.duration > booking.startSlot) violations.push(`Dependency ${dependency} finishes after ${id} starts`);
    }
  }
  if (cost > scenario.budget) violations.push("Schedule exceeds budget");
  const missingMandatory = scenario.jobs.filter(job => job.mandatory && !booked.has(job.id)).map(job => job.id);
  const feasible = violations.length === 0, mandatoryComplete = missingMandatory.length === 0;
  return { feasible, mandatoryComplete, optimal: feasible && mandatoryComplete && value === scenario.optimalValue, value, cost, missingMandatory, violations };
}

/** Operator tools expose actual schedule properties, never the hidden optimum. */
export function createPlanner(scenario: PlanningScenario, bookings: ReviewBooking[]) {
  validate(scenario);
  validateTarget(scenario);
  function current() {
    const evaluation = evaluatePlan(scenario, bookings);
    return { bookings: bookings.map(booking => ({ ...booking })), value: evaluation.value, cost: evaluation.cost, budgetRemaining: scenario.budget - evaluation.cost, missingMandatory: evaluation.missingMandatory };
  }
  return {
    execute(name: string, input: unknown = {}): Record<string, unknown> {
      if (input === null || typeof input !== "object" || Array.isArray(input)) return { error: "Planning tool arguments must be an object" };
      const args = input as Record<string, unknown>;
      if (name === "list_schedule") return current();
      if (name === "schedule_review") {
        if (typeof args.jobId !== "string" || typeof args.reviewer !== "string" || !integer(args.startSlot)) return { error: "schedule_review requires jobId, reviewer and integer startSlot" };
        const job = scenario.jobs.find(candidate => candidate.id === args.jobId);
        if (!job) return { error: "Unknown job" };
        if (job.dependencies.some(id => !bookings.some(booking => booking.jobId === id))) return { error: "Dependencies must already be scheduled" };
        const booking = { jobId: args.jobId, reviewer: args.reviewer, startSlot: args.startSlot };
        const evaluation = evaluatePlan(scenario, [...bookings, booking]);
        if (!evaluation.feasible) return { error: "Booking rejected", violations: evaluation.violations };
        bookings.push(booking);
        return { scheduled: { ...booking }, ...current() };
      }
      if (name === "cancel_review") {
        if (typeof args.jobId !== "string") return { error: "cancel_review requires jobId" };
        const index = bookings.findIndex(booking => booking.jobId === args.jobId);
        if (index < 0) return { error: "Job is not scheduled" };
        if (bookings.some(booking => scenario.jobs.find(job => job.id === booking.jobId)?.dependencies.includes(args.jobId as string))) return { error: "Cancel dependent bookings first" };
        bookings.splice(index, 1);
        return { cancelled: args.jobId, ...current() };
      }
      return { error: "Unknown planning tool" };
    },
  };
}

/** Exact finite search; failure to finish is explicit rather than a guessed gold value. */
export function solvePlanning(scenario: ScenarioInput, options: { maxSearchNodes?: number } = {}): { optimalValue: number; bookings: ReviewBooking[]; searchNodes: number } {
  // A lower caller ceiling permits fast deterministic limit-path tests; the hard ceiling cannot increase.
  const nodeLimit = options.maxSearchNodes ?? MAX_SEARCH_NODES;
  if (!integer(nodeLimit) || nodeLimit < 1 || nodeLimit > MAX_SEARCH_NODES) throw new Error("Planning search ceiling must be between 1 and 2000000 nodes");
  const jobs = validate(scenario), required = new Set<string>();
  function requireJob(id: string): void {
    if (required.has(id)) return;
    required.add(id);
    for (const dependency of jobs.get(id)!.dependencies) requireJob(dependency);
  }
  for (const job of scenario.jobs) if (job.mandatory) requireJob(job.id);
  const order: ReviewJob[] = [], placed = new Set<string>();
  while (order.length < jobs.size) {
    const ready = scenario.jobs.filter(job => !placed.has(job.id) && job.dependencies.every(id => placed.has(id)));
    ready.sort((a, b) => Number(required.has(b.id)) - Number(required.has(a.id)) || b.value - a.value || a.id.localeCompare(b.id));
    const job = ready[0]!; order.push(job); placed.add(job.id);
  }
  const candidates = order.map(job => scenario.reviewers.flatMap((reviewer, reviewerIndex) => {
    if (!job.approved || !reviewer.skills.includes(job.requiredSkill)) return [];
    const result: Array<{ reviewerIndex: number; startSlot: number; mask: number }> = [];
    for (let startSlot = job.releaseSlot; startSlot + job.duration <= job.deadlineSlot; startSlot++) {
      if (job.allowedStarts !== undefined && !job.allowedStarts.includes(startSlot)) continue;
      if (!Array.from({ length: job.duration }, (_, offset) => startSlot + offset).every(slot => reviewer.availableSlots.includes(slot))) continue;
      result.push({ reviewerIndex, startSlot, mask: ((1 << job.duration) - 1) << startSlot });
    }
    return result;
  }));
  for (let i = 0; i < order.length; i++) if (required.has(order[i]!.id) && candidates[i]!.length === 0) throw new Error("No mandatory-complete feasible planning solution");
  const suffixValue = new Array<number>(order.length + 1).fill(0), suffixRequiredCost = new Array<number>(order.length + 1).fill(0);
  for (let i = order.length - 1; i >= 0; i--) {
    suffixValue[i] = suffixValue[i + 1]! + (candidates[i]!.length ? order[i]!.value : 0);
    suffixRequiredCost[i] = suffixRequiredCost[i + 1]! + (required.has(order[i]!.id) ? order[i]!.cost : 0);
  }
  const neededLater = order.map((_, index) => new Set(order.slice(index).flatMap(job => job.dependencies)));
  const occupied = scenario.reviewers.map(() => 0), ends = new Map<string, number>(), working: ReviewBooking[] = [];
  const memo = new Map<string, number>();
  let bestValue = -1, best: ReviewBooking[] = [], searchNodes = 0;
  function search(index: number, cost: number, value: number): void {
    if (++searchNodes > nodeLimit) throw new Error(`Planning search exceeded ${nodeLimit} nodes; optimum remains unverified`);
    if (cost + suffixRequiredCost[index]! > scenario.budget || value + suffixValue[index]! <= bestValue) return;
    if (index === order.length) { bestValue = value; best = working.map(booking => ({ ...booking })); return; }
    // Occupied slots never become free in a descendant, so stranded mandatory jobs prune this branch.
    for (let future = index; future < order.length; future++) {
      const requiredJob = order[future]!;
      if (!required.has(requiredJob.id)) continue;
      const knownEarliest = Math.max(requiredJob.releaseSlot, ...requiredJob.dependencies.map(id => ends.get(id) ?? 0));
      if (!candidates[future]!.some(candidate => candidate.startSlot >= knownEarliest && !(occupied[candidate.reviewerIndex]! & candidate.mask))) return;
    }
    const key = JSON.stringify([index, cost, occupied, [...neededLater[index]!].map(id => [id, ends.get(id) ?? null])]);
    const seen = memo.get(key);
    if (seen !== undefined && seen >= value) return;
    memo.set(key, value);
    const job = order[index]!;
    if (cost + job.cost <= scenario.budget && job.dependencies.every(id => ends.has(id))) {
      const earliest = Math.max(job.releaseSlot, ...job.dependencies.map(id => ends.get(id)!));
      for (const candidate of candidates[index]!) {
        if (candidate.startSlot < earliest || (occupied[candidate.reviewerIndex]! & candidate.mask)) continue;
        occupied[candidate.reviewerIndex] = occupied[candidate.reviewerIndex]! | candidate.mask;
        ends.set(job.id, candidate.startSlot + job.duration);
        working.push({ jobId: job.id, reviewer: scenario.reviewers[candidate.reviewerIndex]!.id, startSlot: candidate.startSlot });
        search(index + 1, cost + job.cost, value + job.value);
        working.pop(); ends.delete(job.id);
        occupied[candidate.reviewerIndex] = occupied[candidate.reviewerIndex]! ^ candidate.mask;
      }
    }
    if (!required.has(job.id)) search(index + 1, cost, value);
  }
  search(0, 0, 0);
  if (bestValue < 0) throw new Error("No mandatory-complete feasible planning solution");
  const result = { optimalValue: bestValue, bookings: best, searchNodes };
  const evaluation = evaluatePlan({ ...scenario, optimalValue: bestValue }, best);
  if (!evaluation.optimal) throw new Error("Planning solver verification failed");
  return result;
}
