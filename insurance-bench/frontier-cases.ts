import { generatePortfolioCases, type PortfolioTask } from "./portfolio-cases.ts";
import { FAMILIES, type ExpectedFact, type Family } from "./types.ts";
import { evaluatePlan, solvePlanning } from "./planning.ts";
import type { ReviewBooking, ReviewJob, Reviewer } from "./planning-types.ts";

const CLOCK = "2026-06-24T16:00:00Z";
const QUALIFICATIONS: Record<Family, string[]> = {
  "deadline-triage": ["provenance", "clock-audit", "counsel-review"],
  "coverage-review": ["endorsement-chain", "limit-audit", "coverage-review"],
  "financial-reconciliation": ["transaction-chain", "ledger-audit", "authority-review"],
  "evidence-brief": ["custody-chain", "timeline-audit", "evidence-review"],
  "fraud-referral": ["signal-provenance", "missingness-audit", "referral-review"],
  "workflow-handoff": ["approval-chain", "consumption-audit", "release-review"],
};
const GATES: Record<Family, { fields: [string, string]; rule: string }> = {
  "deadline-triage": {
    fields: ["parallel_demand", "separate_delivery"],
    rule: "The two-credit parallel-clock debit applies only when parallel_demand=yes and separate_delivery=yes.",
  },
  "coverage-review": {
    fields: ["shared_aggregate", "other_occurrence"],
    rule: "The two-credit aggregate-review debit applies only when shared_aggregate=yes and other_occurrence=yes.",
  },
  "financial-reconciliation": {
    fields: ["foreign_currency", "unsettled_rate"],
    rule: "The two-credit currency-verification debit applies only when foreign_currency=yes and unsettled_rate=yes.",
  },
  "evidence-brief": {
    fields: ["multiple_devices", "unverified_offset"],
    rule: "The two-credit alignment debit applies only when multiple_devices=yes and unverified_offset=yes.",
  },
  "fraud-referral": {
    fields: ["linked_signal", "independent_origin_missing"],
    rule: "The two-credit independence debit applies only when linked_signal=yes and independent_origin_missing=yes.",
  },
  "workflow-handoff": {
    fields: ["delegated_approval", "scope_changed"],
    rule: "The two-credit scope-reconciliation debit applies only when delegated_approval=yes and scope_changed=yes.",
  },
};

/** Entirely invented candidate-3 cases. No canonical plan or optimum is public. */
export function generateFrontierCases(seed = 1729): PortfolioTask[] {
  if (!Number.isSafeInteger(seed)) throw new Error("Frontier seed must be a safe integer");
  return generatePortfolioCases(seed).map((base, index) =>
    buildFrontier(base, index % 4, FAMILIES.indexOf(base.family)),
  );
}
function buildFrontier(base: PortfolioTask, variant: number, familyIndex: number): PortfolioTask {
  const id = base.id.replace("ibp-", "ibf-");
  const salt = parseInt(id.split("-").at(-1)!, 16) >>> 0;
  const rename = (value: string) => value.replaceAll(base.id, id);
  const jobId = (number: number) => `${id}:J${String(number).padStart(2, "0")}`;
  const documents = base.documents.map((document) => ({
    ...document,
    id: rename(document.id),
    text: rename(document.text),
  }));
  const source = (suffix: string) =>
    documents.find((document) => document.id.endsWith(`:${suffix}`))!;
  const qualifications = QUALIFICATIONS[base.family];
  const laneRotation = (familyIndex + variant + (salt % 3)) % 3;
  const reviewers: Reviewer[] = Array.from({ length: 3 }, (_, lane) => ({
    id: `${id}:reviewer-${lane + 1}`,
    skills: [
      qualifications[(lane + laneRotation) % 3]!,
      qualifications[(lane + laneRotation + 1) % 3]!,
    ],
    availableSlots: Array.from({ length: 8 }, (_, slot) => slot),
  }));
  const jobs = base.planning.jobs.map((job) => ({
    ...job,
    id: rename(job.id),
    dependencies: job.dependencies.map(rename),
    allowedStarts: [...job.allowedStarts!],
  }));
  const planted: ReviewBooking[] = [];
  const early = [1, 5, 9],
    middle = [7, 8, 10],
    primary = [2, 3, 4];
  const finish = new Map<number, number>();
  const set = (
    number: number,
    lane: number,
    start: number,
    duration: number,
    dependencies: number[],
    mandatory: boolean,
  ) => {
    const job = jobs[number - 1]!;
    const requiredSkill = reviewers[lane]!.skills[(salt >>> ((number + familyIndex) % 24)) % 2]!;
    const slack = (salt >>> ((number + variant) % 24)) & 1;
    const deadlineSlot = Math.min(8, start + duration + slack);
    const candidates = [start - 1, start, start + 1].filter(
      (value) => value >= 0 && value + duration <= deadlineSlot,
    );
    Object.assign(job, {
      duration,
      requiredSkill,
      cost: 1 + ((number + familyIndex + variant) % 3),
      value: 2 + ((salt >>> (number % 20)) % 13),
      releaseSlot: 0,
      deadlineSlot,
      dependencies: dependencies.map(jobId),
      mandatory,
      approved: true,
      allowedStarts: candidates,
    });
    finish.set(number, start + duration);
    planted.push({ jobId: job.id, reviewer: reviewers[lane]!.id, startSlot: start });
  };
  // Each case has a distinct qualification permutation, temporal chain, and cross-lane edges.
  for (let lane = 0; lane < 3; lane++) {
    const duration = 1 + (((salt >>> (lane * 4)) + familyIndex + variant) % 3);
    set(early[lane]!, lane, 0, duration, [], false);
  }
  for (let lane = 0; lane < 3; lane++) {
    const start = finish.get(early[lane]!)!;
    const possible = early.filter(
      (number) => finish.get(number)! <= start && number !== early[lane],
    );
    const extra =
      possible.length && (familyIndex + variant + lane) % 2 === 0
        ? [possible[(salt + lane) % possible.length]!]
        : [];
    set(middle[lane]!, lane, start, 4 - start, [early[lane]!, ...extra], false);
  }
  const primaryDuration = variant === 2 ? [2, 2, 3] : variant === 3 ? [1, 3, 2] : [2, 2, 2];
  for (let lane = 0; lane < 3; lane++) {
    const other = middle[(lane + 1 + (familyIndex % 2)) % 3]!;
    const dependencies = [
      ...new Set([middle[lane]!, ...((variant + familyIndex + lane) % 3 !== 0 ? [other] : [])]),
    ];
    set(primary[lane]!, lane, 4, primaryDuration[lane]!, dependencies, true);
  }
  const last0 = variant === 1 ? 1 : variant === 3 ? 3 : 2;
  const last1 = variant === 0 || variant === 3 ? 1 : 2;
  const end0 = finish.get(2)!,
    end1 = finish.get(3)!;
  set(
    11,
    0,
    end0,
    last0,
    [
      2,
      ...primary.filter(
        (number) =>
          number !== 2 && finish.get(number)! <= end0 && (number + familyIndex + variant) % 2 === 0,
      ),
    ],
    true,
  );
  set(
    12,
    1,
    end1,
    last1,
    [
      3,
      ...primary.filter(
        (number) =>
          number !== 3 && finish.get(number)! <= end1 && (number + familyIndex + variant) % 2 !== 0,
      ),
    ],
    true,
  );
  // Approved optional reviews compete for the few remaining staff slots and credits.
  const optional = [6, 19, 20];
  for (const number of optional) {
    let job = jobs[number - 1];
    if (!job) {
      job = { ...jobs[5]!, id: jobId(number), dependencies: [] };
      jobs.push(job);
    }
    const duration = number === 6 ? 2 : number === 19 ? 1 : 2;
    Object.assign(job, {
      duration,
      approved: number === 6 ? job.approved : true,
      requiredSkill: qualifications[(familyIndex + number + variant) % 3]!,
      cost: number === 19 ? 1 : 2,
      value: 18 + ((salt >>> (number % 16)) % 17),
      releaseSlot: number === 20 && variant >= 2 ? 5 : 3,
      deadlineSlot: 8,
      dependencies: [jobId(middle[(familyIndex + number + variant) % 3]!)],
      mandatory: false,
      allowedStarts: number === 19 ? [5, 6, 7] : number === 20 && variant >= 2 ? [5, 6] : [4, 5, 6],
    });
  }
  // Restricted jobs retain raw signed-version/scope/effective/receipt conditions, never become critical.
  for (let number = 13; number <= 18; number++) {
    const job = jobs[number - 1]!;
    Object.assign(job, {
      requiredSkill: qualifications[(number + familyIndex) % 3]!,
      releaseSlot: 3,
      deadlineSlot: 8,
      duration: 2,
      dependencies: [jobId(early[(number + variant) % 3]!)],
      allowedStarts: [4, 5, 6],
    });
  }
  const closureNumbers = [...early, ...middle, ...primary, 11, 12];
  // Register order is an ordinary import order, not a scheduling hint.
  const importRank = (job: ReviewJob) =>
    Math.imul(Number(job.id.split(":J")[1]) ^ salt, 2654435761) >>> 0;
  jobs.sort((left, right) => importRank(left) - importRank(right));
  const closure = jobs.filter((job) => closureNumbers.some((number) => job.id === jobId(number)));
  const closureCost = closure.reduce((sum, job) => sum + job.cost, 0);
  const closureWork = closure.reduce((sum, job) => sum + job.duration, 0);
  const gate = GATES[base.family];
  const firstFlag = ((salt >>> 5) & 1) === 1;
  const secondFlag = variant >= 2 ? !firstFlag : ((salt >>> 11) & 1) === 1;
  const debit = firstFlag && secondFlag ? 2 : 0;
  const allowance = 1 + ((familyIndex + variant) % 3);
  const gross = closureCost + allowance + 2;
  const cap = closureCost + allowance + 1;
  const budget = Math.min(gross - debit, cap);
  const solved = solvePlanning({ slots: 8, jobs, reviewers, budget });
  const planning = { slots: 8, jobs, reviewers, budget, optimalValue: solved.optimalValue };
  if (
    !evaluatePlan(planning, planted).feasible ||
    !evaluatePlan(planning, planted).mandatoryComplete
  )
    throw new Error("Frontier construction lost its feasible witness");
  const oldRows = source("jobs").text.split("\n");
  const titles = new Map(
    oldRows.slice(1).map((line) => {
      const columns = line.split(",");
      return [columns[0]!, columns[1]!];
    }),
  );
  source("jobs").text = [
    oldRows[0],
    ...jobs.map((job) =>
      [
        job.id,
        titles.get(job.id) ?? "optional portfolio capacity review",
        job.duration,
        job.requiredSkill,
        job.cost,
        job.value,
        job.releaseSlot,
        job.deadlineSlot,
        job.dependencies.join("|"),
        job.mandatory ? "yes" : "no",
        job.allowedStarts!.join("|"),
        `A${Number(job.id.split(":J")[1])}`,
      ].join(","),
    ),
  ].join("\n");
  source("staff").text = [
    "reviewer_id,skills,credential_start,credential_end,available_slots",
    ...reviewers.map((reviewer) =>
      [
        reviewer.id,
        reviewer.skills.join("|"),
        "2026-06-23T00:00:00Z",
        "2026-06-25T00:00:00Z",
        reviewer.availableSlots.join("|"),
      ].join(","),
    ),
  ].join("\n");
  source("appointment-notice").text = [
    "The current job register's appointment_starts field contains permitted start boundaries, not a recommended schedule. Every occupied duration slot must be available in the current reviewer register.",
    "Current required_skill and prerequisite_ids fields govern this portfolio. A dependency must be reserved before its dependent booking and finish no later than that booking's start; different qualified reviewers may perform a prerequisite and its dependent.",
    "There are three current reviewers. No prior two-person roster, cached completion, implicit overtime, borrowed credential, or old appointment supplies capacity or a booked prerequisite.",
  ].join("\n");
  source("grants").text +=
    `\n${jobId(19)},A19-v1,${base.family},2026-06-24T15:00:00Z,signed-grant,none\n${jobId(20)},A20-v1,${base.family},2026-06-24T15:00:00Z,signed-grant,none`;
  source("budget").text = [
    "record,scope,credits,effective_at,signed,condition_ref",
    `B-base,${base.family},${gross},2026-06-23T00:00:00Z,yes,none`,
    `CAP,${base.family},${cap},2026-06-24T15:00:00Z,yes,BC`,
    "BC requires verified same-family review-cap approval before the fixed reading clock. Apply the source-defined family debit to the authorized base, then take the lower of that amount and the satisfied cap. All units are artificial internal review credits.",
  ].join("\n");
  documents.push({
    id: `${id}:family-capacity`,
    title: "Scoped capacity debit contract and raw intake flags",
    text: [
      gate.rule,
      `matter_id,scope,${gate.fields[0]},${gate.fields[1]}`,
      `${id}:matter,${base.family},${firstFlag ? "yes" : "no"},${secondFlag ? "yes" : "no"}`,
      "Apply the debit exactly once only if both predicates hold in this same matter/scope. These fictional capacity rules do not define coverage, legal deadlines, or claim payments.",
    ].join("\n"),
  });
  const earliest = Math.min(...jobs.filter((job) => job.mandatory).map((job) => job.deadlineSlot));
  const deadlineAt = new Date(Date.parse(CLOCK) + earliest * 30 * 60000)
    .toISOString()
    .replace(".000Z", "Z");
  source("routing").text = [
    `This portfolio has its own internal routing policy. A portfolio with three current reviewers routes as follows: kind=frontier-${base.family}; owner=${id}:capacity-supervisor; status=capacity-review.`,
    `Set dueAt to the earliest completion deadline of any mandatory job, converted from the reading-clock half-hour grid. A draft is not external authority.`,
  ].join("\n");
  source("rules").text +=
    "\nThe scoped family capacity debit document is authoritative for budget adjustment. Old cached capacity or approval summaries have no authority. Record IDs begin each CSV row; cite relevant identity/field spans, with current credentials and grounded prerequisite facts sufficient for derived certificates.";
  const facts: Record<string, ExpectedFact> = {};
  const row = (suffix: string, anchor: string, ...rowContains: string[]) => ({
    documentId: source(suffix).id,
    anchor,
    rowContains,
  });
  const plain = (suffix: string, anchor: string) => ({ documentId: source(suffix).id, anchor });
  const f = (
    key: string,
    value: ExpectedFact["value"],
    sources: ExpectedFact["evidence"],
    dependencies: string[] = [],
    optimalSchedule = false,
  ) => {
    facts[key] = {
      value,
      evidence: sources,
      evidencePlans: [
        {
          sources,
          ...(dependencies.length ? { facts: dependencies } : {}),
          ...(optimalSchedule ? { optimalSchedule: true } : {}),
        },
      ],
    };
  };
  const critical = jobs.filter((job) => job.mandatory);
  f(
    "mandatoryJobIds",
    critical.map((job) => job.id),
    critical.map((job) => row("jobs", job.id, ",yes,")),
  );
  f(
    "mandatoryPrerequisiteIds",
    closure.filter((job) => !job.mandatory).map((job) => job.id),
    closure
      .filter((job) => job.dependencies.length)
      .map((job) => row("jobs", job.id, job.dependencies.join("|"))),
    ["mandatoryJobIds"],
  );
  f(
    "mandatoryClosureCost",
    closureCost,
    closure.map((job) => row("jobs", job.id, `,${job.requiredSkill},${job.cost},`)),
    ["mandatoryJobIds", "mandatoryPrerequisiteIds"],
  );
  f(
    "mandatoryClosureWorkSlots",
    closureWork,
    closure.map((job) => row("jobs", job.id, `,${job.duration},${job.requiredSkill},`)),
    ["mandatoryJobIds", "mandatoryPrerequisiteIds"],
  );
  const locked = jobs.filter((job) => !job.approved);
  const remapProof = (proof: ExpectedFact["evidence"][number]) => ({
    ...proof,
    documentId: rename(proof.documentId),
    anchor: rename(proof.anchor),
    ...(proof.rowContains ? { rowContains: proof.rowContains.map(rename) } : {}),
  });
  f(
    "lockedJobIds",
    locked.map((job) => job.id),
    base.rubric.facts.lockedJobIds!.evidence.map(remapProof),
  );
  f(
    "approvedJobCount",
    jobs.filter((job) => job.approved).length,
    jobs.map((job) => plain("jobs", job.id)),
    ["lockedJobIds"],
  );
  facts.approvedJobCount!.evidencePlans!.push({
    sources: jobs.map((job) => plain("grants", job.id)),
    facts: ["lockedJobIds"],
  });
  f("reviewBudgetCredits", budget, [
    row("budget", "B-base", `${base.family},${gross},`),
    row("budget", "CAP", `${base.family},${cap},`),
    plain("budget-receipt", `BC,${base.family},2026-06-24T15:45:00Z,verified`),
    {
      documentId: `${id}:family-capacity`,
      anchor: `${id}:matter`,
      rowContains: [`${base.family},${firstFlag ? "yes" : "no"},${secondFlag ? "yes" : "no"}`],
    },
    { documentId: `${id}:family-capacity`, anchor: gate.rule },
  ]);
  f("earliestMandatoryDeadlineAt", deadlineAt, [], ["mandatoryJobIds"]);
  facts.earliestMandatoryDeadlineAt!.evidencePlans = critical
    .filter((job) => job.deadlineSlot === earliest)
    .map((job) => ({
      sources: [row("jobs", job.id, `,${job.releaseSlot},${job.deadlineSlot},`)],
      facts: ["mandatoryJobIds"],
    }));
  facts.earliestMandatoryDeadlineAt!.evidence =
    facts.earliestMandatoryDeadlineAt!.evidencePlans[0]!.sources;
  f(
    "criticalQualifiedReviewerIds",
    reviewers
      .filter((reviewer) => critical.some((job) => reviewer.skills.includes(job.requiredSkill)))
      .map((reviewer) => reviewer.id),
    reviewers.map((reviewer) => row("staff", reviewer.id, reviewer.skills.join("|"))),
    ["mandatoryJobIds"],
  );
  f(
    "optimalPriorityValue",
    solved.optimalValue,
    [plain("rules", "maximize the sum of priority_units")],
    ["lockedJobIds", "reviewBudgetCredits"],
    true,
  );
  const instruction = base.instruction
    .replaceAll(base.id, id)
    .replace("Insurance Bench portfolio", "Insurance Bench frontier portfolio")
    .replace(
      "usable shared review credits after the authorized additive budget, receipt condition, and cap",
      "usable shared review credits after the scoped conditional family debit and verified cap are applied to the signed base",
    )
    .replace(
      "under current approvals, staff credentials/availability, appointments, dependencies, and shared budget.",
      "under current approvals, staff credentials/availability, appointments, dependencies, and the scoped adjusted shared budget.",
    );
  return {
    id,
    family: base.family,
    split: base.split,
    clock: CLOCK,
    documents,
    planning,
    instruction,
    rubric: {
      facts,
      followUp: {
        kind: `frontier-${base.family}`,
        owner: `${id}:capacity-supervisor`,
        dueAt: deadlineAt,
      },
      workflow: { status: "capacity-review", owner: `${id}:capacity-supervisor` },
      memoAnchors: base.rubric.memoAnchors,
    },
  };
}
