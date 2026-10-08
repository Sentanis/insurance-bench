import type { FactValue } from "./types.ts";
import type {
  WorkflowDocument,
  WorkflowPhase,
  WorkflowRow,
  WorkflowTask,
} from "./workflow-types.ts";

export const COUPLED_FAMILIES = [
  "coverage-review",
  "financial-reconciliation",
  "deadline-triage",
] as const;
const CLOCK = "2026-06-24T16:00:00Z";
const at = (minutes: number) =>
  new Date(Date.parse(CLOCK) + minutes * 60000).toISOString().replace(".000Z", "Z");
export interface CoupledPackage {
  id: string;
  allocations: Record<string, number>;
  costCents: number;
  priorityValue: number;
  eligible: boolean;
}
export interface CoupledConstraints {
  personAvailable: Record<string, number>;
  occurrenceAvailableCents: number;
  packages: CoupledPackage[];
  optimalValue: number;
  optimalPlans: string[][];
  feasiblePlanCount: number;
  subsetsExamined: number;
}
export interface CoupledTask extends WorkflowTask {
  /** Hidden normalized constraints independently derivable from public raw records. */
  coupled: { phases: [CoupledConstraints, CoupledConstraints, CoupledConstraints] };
}
const row = (id: string, fields: Record<string, FactValue>): WorkflowRow => ({ id, fields });
const RULES = [
  "All money is integer cents. These are invented internal planning policies, not insurance law or actual payment authority. Every proposal package is a distinct incremental compensable component; packages do not replace reserves and their allocations must be added to current incurred commitments. Priority units are an explicit synthetic operational objective, not dollar loss or claimant deservingness.",
  "For each exposure, the base policy must match entity and coverage, with inception inclusive and expiration exclusive at that exposure's clarified loss instant. Unknown loss time, out-of-period loss or unmatched policy means no usable capacity and no package for that claimant; report its limitSource as unavailable. Choose the highest signed revision endorsement whose entity, coverage and claimant scope match and whose own effective instant is no later than loss. Its per-person limit replaces the base per-person limit. Upload time is irrelevant. Choose the shared BI occurrence limit separately: highest signed revision with scope=occurrence, matching policy/entity/coverage, effective no later than the occurrence instant. A person-scoped endorsement never changes the shared occurrence limit.",
  "Read signed posted financial events effective no later than reading clock. Deduplicate by transactionKey, keeping its highest eligible revision; repeated identical revision records are duplicates. unsigned/unposted/future-effective revisions do not replace a current eligible version. Expense and recovery events do not erode capacity. Positive indemnity events consume their own coverage. An allocation response assigns only its named transactionKey; unknown allocation stays unknown and never becomes zero.",
  "A reversal is a separate positive reversal amount linked by linkedKey to the selected positive indemnity transaction. Subtract its cents using that linked transaction's current coverage and claimant allocation, ignoring the reversal row's claimant and coverage labels. It must not exceed its linked positive amount. Unknown linked allocation remains an unknown negative adjustment. Reversal event versions are deduplicated by their own transactionKey. Keep reserve estimates separate from posted money.",
  "For each claimant/coverage, select the highest signed reserve version effective no later than reading clock; a new estimate replaces rather than adds its predecessor. BI per-person available=max(0,controllingPersonLimit-netKnownPaid-reserve). Shared BI occurrence available=max(0,controllingOccurrenceLimit-all BI net paid including unallocated net paid-all BI reserves). PD uses its separate incident limit and never consumes BI. Unallocated BI is included in occurrence erosion, reported separately, and blocks only packages naming that unresolved transactionKey as requiredAllocationKey.",
  "Select the highest signed demand version for each claimant. A replacement uses its own complete verified delivery receipt instant and duration; amount_only inherits the original demand's complete receipt, root and duration. For extensions select the highest signed extension revision for that claimant; it applies only if recipientAuthorized=true, root matches the operative root, and received strictly before the unextended deadline. Add extraMinutes only when it applies. The delivery receipt starts the response clock; its missingItems inventory describes additional internal proposal-packet enclosures, not clock-start delivery prerequisites. Missing required packet items block packages for that claimant. A deadline earlier than reading clock blocks packages; equality is on time. Receipt and a human review are different.",
  "A proposal package is eligible only if every positive claimant allocation is covered, has a current complete receipt packet, has an operative deadline no earlier than reading clock, and its named requiredAllocationKey is resolved or empty. Select any subset of eligible packages with no duplicate IDs. Its per-claimant allocations may not exceed the corresponding available per-person capacity; its total cost may not exceed shared BI occurrence capacity. Maximize the sum of priorityValue. All feasible tied optimal subsets are accepted, without ordering or lexicographic tie breaking. A reported optimum without an actually recorded feasible optimal package selection does not complete the business task.",
  "Package cost is the sum of allocateACents, allocateBCents and allocateCCents. Internal business fields selectedCostCents and selectedPriorityValue must equal the actual selected package sums, and proposedPackageIds must identify the selected subset. No payment, external response, coverage determination or human signoff is authorized. Material updates invalidate prior packet review; retain historical decisions and obtain the supplied current internal reviewer response.",
  "This allocation interaction track permits at most18 distinct additive packages. Its per-person, shared-capacity, eligibility and all-optimal-ties rules are otherwise unchanged.",
];
function makeDocs(
  id: string,
  phase: number,
  records: WorkflowRow[],
  customers: WorkflowRow[],
): WorkflowDocument[] {
  const doc = (suffix: string, revision: number, rows: WorkflowRow[]): WorkflowDocument => ({
    id: `${id}:${suffix}`,
    title: `${suffix}: invented occurrence records`,
    revision,
    rows,
    text: JSON.stringify(rows),
  });
  return [
    doc(
      "rules",
      1,
      RULES.map((text, i) => row(`rule-${i + 1}`, { text })),
    ),
    doc("records", phase + 1, records),
    doc("customer", phase + 1, customers),
    doc("authority", 1, [
      row("authority", {
        scope: "internal_draft_only",
        priorDecisionId: "prior-human-decision",
        priorApprovalMaterialRevision: 1,
        allowExternalFinalization: false,
      }),
    ]),
  ];
}
function n(item: WorkflowRow, key: string): number {
  return Number(item.fields[key]);
}
function s(item: WorkflowRow, key: string): string {
  return String(item.fields[key]);
}
function selected(rows: WorkflowRow[], prefix: string, clock: number): WorkflowRow[] {
  const map = new Map<string, WorkflowRow>();
  for (const item of rows.filter((item) => item.id.startsWith(prefix))) {
    if (
      item.fields.signed !== true ||
      item.fields.posted === false ||
      Date.parse(s(item, "effectiveAt")) > clock
    )
      continue;
    const key = String(
      item.fields.transactionKey ??
        `${String(item.fields.claimant)}:${String(item.fields.coverage)}`,
    );
    const previous = map.get(key);
    if (!previous || n(item, "version") > n(previous, "version")) map.set(key, item);
  }
  return [...map.values()];
}
type SolverResult = Pick<CoupledConstraints, "optimalValue" | "optimalPlans" | "feasiblePlanCount" | "subsetsExamined">;
// Include every normalized constraint and the complete current raw source identity. Cache
// entries are private, bounded and cloned; repeated source reads cannot mutate an optimum.
const optimizationCache = new Map<string, SolverResult>();
const CACHE_LIMIT = 64;
export function solveCoupled(
  constraints: Omit<CoupledConstraints, "optimalValue" | "optimalPlans" | "feasiblePlanCount" | "subsetsExamined">,
  sourceIdentity: unknown = null,
): SolverResult {
  if (constraints.packages.length > 18) throw new Error("At most18packages permitted");
  const key = JSON.stringify({ constraints, sourceIdentity });
  const cached = optimizationCache.get(key);
  if (cached) return structuredClone(cached);
  let optimalValue = 0, feasiblePlanCount = 0, cost = 0, priority = 0, ineligible = 0, previousGray = 0;
  const totals: Record<string, number> = { A: 0, B: 0, C: 0 };
  const optimalPlans: string[][] = [];
  const subsetsExamined = 2 ** constraints.packages.length;
  // Gray-code order changes one selected component at a time, but visits every subset.
  // Dominated components remain selectable: these are additive, not interchangeable.
  for (let index = 0; index < subsetsExamined; index++) {
    const gray = index ^ (index >>> 1);
    if (index) {
      const changed = gray ^ previousGray;
      const item = constraints.packages[31 - Math.clz32(changed)]!;
      const sign = (gray & changed) ? 1 : -1;
      cost += sign * item.costCents;
      priority += sign * item.priorityValue;
      if (!item.eligible) ineligible += sign;
      for (const claimant of Object.keys(totals)) totals[claimant]! += sign * (item.allocations[claimant] ?? 0);
    }
    previousGray = gray;
    if (ineligible || cost > constraints.occurrenceAvailableCents
      || Object.entries(totals).some(([claimant, cents]) => cents > constraints.personAvailable[claimant]!)) continue;
    feasiblePlanCount++;
    if (priority > optimalValue) { optimalValue = priority; optimalPlans.length = 0; }
    if (priority === optimalValue) optimalPlans.push(constraints.packages.filter((_, bit) => gray & (1 << bit)).map(item => item.id));
  }
  const answer = { optimalValue, optimalPlans, feasiblePlanCount, subsetsExamined };
  if (optimizationCache.size >= CACHE_LIMIT) optimizationCache.delete(optimizationCache.keys().next().value!);
  optimizationCache.set(key, structuredClone(answer));
  return answer;
}
export function deriveCoupledPhase(
  docs: WorkflowDocument[],
  clock: string,
): WorkflowPhase & { constraints: CoupledConstraints } {
  const records = docs.find((doc) => doc.id.endsWith(":records"))!.rows;
  const customers = docs.find((doc) => doc.id.endsWith(":customer"))!.rows;
  const all = [...records, ...customers];
  const now = Date.parse(clock);
  const get = (id: string) => all.find((item) => item.id === id)!;
  const occurrence = get("occurrence");
  const bi = get("policy-BI"),
    pd = get("policy-PD");
  const exposures = records.filter((item) => item.id.startsWith("exposure-"));
  const coverage: Record<string, { covered: boolean; limit: number; source: string }> = {};
  for (const exposure of exposures) {
    const claimant = s(exposure, "claimant");
    const response = get(`loss-${claimant}`);
    const loss = Date.parse(s(response, "lossAt"));
    const policy = exposure.fields.coverage === "BI" ? bi : pd;
    const covered =
      exposure.fields.entity === policy.fields.entity &&
      Number.isFinite(loss) &&
      loss >= Date.parse(s(policy, "inceptionAt")) &&
      loss < Date.parse(s(policy, "expirationAt"));
    const endorsement = records
      .filter(
        (item) =>
          item.id.startsWith("endorsement-") &&
          item.fields.scope === claimant &&
          item.fields.policySourceId === policy.fields.sourceId &&
          item.fields.entity === exposure.fields.entity &&
          item.fields.coverage === exposure.fields.coverage &&
          item.fields.signed === true &&
          Date.parse(s(item, "effectiveAt")) <= loss,
      )
      .sort((a, b) => n(a, "version") - n(b, "version"))
      .at(-1);
    coverage[claimant] = {
      covered,
      limit: covered
        ? endorsement
          ? n(endorsement, "personLimitCents")
          : n(policy, "personLimitCents")
        : 0,
      source: !covered
        ? "unavailable"
        : endorsement
          ? s(endorsement, "sourceId")
          : s(policy, "sourceId"),
    };
  }
  const occurrenceEndorsement = records
    .filter(
      (item) =>
        item.id.startsWith("endorsement-") &&
        item.fields.scope === "occurrence" &&
        item.fields.policySourceId === bi.fields.sourceId &&
        item.fields.entity === bi.fields.entity &&
        item.fields.coverage === "BI" &&
        item.fields.signed === true &&
        Date.parse(s(item, "effectiveAt")) <= Date.parse(s(occurrence, "lossAt")),
    )
    .sort((a, b) => n(a, "version") - n(b, "version"))
    .at(-1);
  const incidentLimit = occurrenceEndorsement
    ? n(occurrenceEndorsement, "occurrenceLimitCents")
    : n(bi, "incidentLimitCents");
  const events = selected(records, "event-", now);
  const byKey = new Map(events.map((item) => [s(item, "transactionKey"), item]));
  const resolveClaimant = (item: WorkflowRow) =>
    s(item, "claimant") !== "unknown"
      ? s(item, "claimant")
      : String(
          customers.find(
            (response) => response.fields.transactionKey === item.fields.transactionKey,
          )?.fields.claimant ?? "unknown",
        );
  const paid: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  let unallocated = 0,
    biPaid = 0,
    pdPaid = 0;
  const unresolvedKeys: string[] = [];
  for (const item of events) {
    const kind = s(item, "kind");
    if (kind !== "indemnity" && kind !== "reversal") continue;
    const linked = kind === "reversal" ? byKey.get(s(item, "linkedKey")) : item;
    if (!linked || linked.fields.kind !== "indemnity") throw new Error("Invalid linked reversal");
    if (kind === "reversal" && n(item, "cents") > n(linked, "cents"))
      throw new Error("Reversal exceeds linked payment");
    const cents = n(item, "cents") * (kind === "reversal" ? -1 : 1),
      claimant = resolveClaimant(linked);
    if (linked.fields.coverage === "BI") {
      biPaid += cents;
      if (claimant === "unknown") {
        unallocated += cents;
        if (!unresolvedKeys.includes(s(linked, "transactionKey")))
          unresolvedKeys.push(s(linked, "transactionKey"));
      } else paid[claimant]! += cents;
    } else {
      pdPaid += cents;
      paid.D! += cents;
    }
  }
  const estimates = selected(records, "reserve-", now);
  const reserve: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const estimate of estimates) reserve[s(estimate, "claimant")] = n(estimate, "cents");
  const biReserve = reserve.A! + reserve.B! + reserve.C!;
  const capacity: Record<string, number> = {};
  for (const claimant of ["A", "B", "C"])
    capacity[claimant] = Math.max(
      0,
      coverage[claimant]!.limit - paid[claimant]! - reserve[claimant]!,
    );
  const incidentAvailable = Math.max(0, incidentLimit - biPaid - biReserve);
  const deadlines: Record<string, string> = {},
    missingClaimants: string[] = [];
  for (const claimant of ["A", "B", "C"]) {
    const demands = records
      .filter(
        (item) =>
          item.id.startsWith("demand-") &&
          item.fields.claimant === claimant &&
          item.fields.signed === true,
      )
      .sort((a, b) => n(a, "version") - n(b, "version"));
    const original = demands[0]!,
      demand = demands.at(-1)!;
    const controllingClock = demand.fields.changeType === "amount_only" ? original : demand;
    const receipt = get(`receipt-${s(controllingClock, "demandId")}`);
    const packetReceipt = get(`receipt-${s(demand, "demandId")}`);
    const start = Date.parse(s(receipt, "completeAt"));
    const unextended = start + n(controllingClock, "durationMinutes") * 60000;
    const extension = records
      .filter(
        (item) =>
          item.id.startsWith("extension-") &&
          item.fields.claimant === claimant &&
          item.fields.signed === true,
      )
      .sort((a, b) => n(a, "version") - n(b, "version"))
      .at(-1);
    const operativeRoot = controllingClock.fields.rootId;
    const extra =
      extension &&
      extension.fields.recipientAuthorized === true &&
      extension.fields.rootId === operativeRoot &&
      Date.parse(s(extension, "receivedAt")) < unextended
        ? n(extension, "extraMinutes")
        : 0;
    deadlines[claimant] = new Date(unextended + extra * 60000).toISOString().replace(".000Z", "Z");
    if (
      packetReceipt.fields.verified !== true ||
      (packetReceipt.fields.missingItems as string[]).length > 0
    )
      missingClaimants.push(claimant);
  }
  const packages = records
    .filter((item) => item.id.startsWith("package-"))
    .map((item) => {
      const allocations = Object.fromEntries(
        ["A", "B", "C"].map((claimant) => [claimant, n(item, `allocate${claimant}Cents`)]),
      );
      return {
        id: s(item, "packageId"),
        allocations,
        costCents: Object.values(allocations).reduce((a, b) => a + b, 0),
        priorityValue: n(item, "priorityValue"),
        eligible:
          !unresolvedKeys.includes(s(item, "requiredAllocationKey")) &&
          Object.entries(allocations).every(
            ([claimant, cents]) =>
              cents === 0 ||
              (coverage[claimant]!.covered &&
                !missingClaimants.includes(claimant) &&
                Date.parse(deadlines[claimant]!) >= now),
          ),
      };
    });
  const initial = {
    personAvailable: capacity,
    occurrenceAvailableCents: incidentAvailable,
    packages,
  };
  const constraints: CoupledConstraints = { ...initial, ...solveCoupled(initial, docs) };
  const facts: Record<string, FactValue> = {
    limitSourceA: coverage.A!.source,
    limitSourceB: coverage.B!.source,
    limitSourceC: coverage.C!.source,
    personAvailableACents: capacity.A!,
    personAvailableBCents: capacity.B!,
    personAvailableCCents: capacity.C!,
    occurrenceAvailableCents: incidentAvailable,
    pdAvailableCents: Math.max(0, n(pd, "incidentLimitCents") - pdPaid - reserve.D!),
    netPaidACents: paid.A!,
    netPaidBCents: paid.B!,
    netPaidCCents: paid.C!,
    reserveTotalBICents: biReserve,
    unallocatedBICents: unallocated,
    eligiblePackageIds: packages.filter((item) => item.eligible).map((item) => item.id),
    optimalPriorityValue: constraints.optimalValue,
    deadlineA: deadlines.A!,
    deadlineB: deadlines.B!,
    deadlineC: deadlines.C!,
    lateDemandClaimantIds: ["A", "B", "C"].filter(
      (claimant) => Date.parse(deadlines[claimant]!) < now,
    ),
  };
  const business: Record<string, FactValue> = {
    proposedPackageIds: [],
    selectedCostCents: 0,
    selectedPriorityValue: 0,
    occurrenceAvailableCents: incidentAvailable,
    personAvailableACents: capacity.A!,
    personAvailableBCents: capacity.B!,
    personAvailableCCents: capacity.C!,
    unallocatedBICents: unallocated,
  };
  const unique = (ids: string[]) => [...new Set(ids)];
  const coverageProof = (claimant: string) =>
    unique([
      claimant === "D" ? "policy-PD" : "policy-BI",
      `exposure-${claimant}`,
      `loss-${claimant}`,
      ...records
        .filter((item) => item.fields.sourceId === coverage[claimant]!.source)
        .map((item) => item.id),
    ]);
  const moneyProof = (claimant?: string, coverageCode = "BI", unknownOnly = false) => {
    const ids: string[] = [];
    for (const item of events) {
      if (item.fields.kind !== "indemnity" && item.fields.kind !== "reversal") continue;
      const linked = item.fields.kind === "reversal" ? byKey.get(s(item, "linkedKey"))! : item;
      const resolved = resolveClaimant(linked);
      if (
        linked.fields.coverage !== coverageCode ||
        (claimant && resolved !== claimant) ||
        (unknownOnly && resolved !== "unknown")
      )
        continue;
      ids.push(item.id, linked.id);
      if (linked.fields.claimant === "unknown")
        ids.push(
          ...customers
            .filter((response) => response.fields.transactionKey === linked.fields.transactionKey)
            .map((response) => response.id),
        );
    }
    return unique(
      ids.length
        ? ids
        : customers.filter((item) => item.id.startsWith("allocation-")).map((item) => item.id),
    );
  };
  const reserveProof = (claimant?: string, coverageCode = "BI") =>
    estimates
      .filter((item) =>
        claimant
          ? item.fields.claimant === claimant
          : coverageCode === "BI"
            ? item.fields.claimant !== "D"
            : item.fields.claimant === "D",
      )
      .map((item) => item.id);
  const deadlineProof = (claimant: string) => {
    const demands = records
      .filter(
        (item) =>
          item.id.startsWith("demand-") &&
          item.fields.claimant === claimant &&
          item.fields.signed === true,
      )
      .sort((a, b) => n(a, "version") - n(b, "version"));
    const current = demands.at(-1)!,
      base = current.fields.changeType === "amount_only" ? demands[0]! : current;
    return unique([
      current.id,
      base.id,
      `receipt-${s(base, "demandId")}`,
      ...records
        .filter(
          (item) =>
            item.id.startsWith("extension-") &&
            item.fields.claimant === claimant &&
            item.fields.signed === true,
        )
        .sort((a, b) => n(a, "version") - n(b, "version"))
        .slice(-1)
        .map((item) => item.id),
    ]);
  };
  const occurrenceProof = unique([
    "policy-BI",
    "occurrence",
    ...(occurrenceEndorsement ? [occurrenceEndorsement.id] : []),
    ...moneyProof(),
    ...reserveProof(),
  ]);
  const eligibilityProof = unique([
    ...["A", "B", "C"].flatMap(coverageProof),
    ...["A", "B", "C"].flatMap(deadlineProof),
    ...["A", "B", "C"].flatMap((claimant) => {
      const current = records
        .filter(
          (item) =>
            item.id.startsWith("demand-") &&
            item.fields.claimant === claimant &&
            item.fields.signed === true,
        )
        .sort((a, b) => n(a, "version") - n(b, "version"))
        .at(-1)!;
      return [`receipt-${s(current, "demandId")}`];
    }),
    ...customers.filter((item) => item.id.startsWith("allocation-")).map((item) => item.id),
    ...records.filter((item) => item.id.startsWith("package-")).map((item) => item.id),
  ]);
  const evidence: Record<string, string[]> = {};
  for (const claimant of ["A", "B", "C"]) {
    evidence[`limitSource${claimant}`] = coverageProof(claimant);
    evidence[`personAvailable${claimant}Cents`] = unique([
      ...coverageProof(claimant),
      ...(coverage[claimant]!.covered ? [...moneyProof(claimant), ...reserveProof(claimant)] : []),
    ]);
    evidence[`netPaid${claimant}Cents`] = moneyProof(claimant);
    evidence[`deadline${claimant}`] = deadlineProof(claimant);
  }
  evidence.occurrenceAvailableCents = occurrenceProof;
  evidence.pdAvailableCents = unique([
    "policy-PD",
    ...moneyProof(undefined, "PD"),
    ...reserveProof(undefined, "PD"),
  ]);
  evidence.reserveTotalBICents = reserveProof();
  evidence.unallocatedBICents = moneyProof(undefined, "BI", true);
  evidence.eligiblePackageIds = eligibilityProof;
  evidence.optimalPriorityValue = unique([
    ...eligibilityProof,
    ...occurrenceProof,
    ...["A", "B", "C"].flatMap((claimant) => evidence[`personAvailable${claimant}Cents`]!),
  ]);
  evidence.lateDemandClaimantIds = unique([...["A", "B", "C"].flatMap(deadlineProof)]);
  return { documents: docs, facts, business, evidence, constraints };
}
export function evaluateCoupledPlan(task: CoupledTask, input: unknown, phase: 0 | 1 | 2 = 2) {
  const constraints = task.coupled.phases[phase];
  const violations: string[] = [];
  const valid =
    Array.isArray(input) &&
    input.every((id) => typeof id === "string") &&
    new Set(input).size === input.length &&
    input.every((id) => constraints.packages.some((item) => item.id === id));
  if (!valid)
    return {
      valid: false,
      feasible: false,
      optimal: false,
      selectedCostCents: 0,
      selectedPriorityValue: 0,
      errors: ["Unknown, duplicate or malformed package IDs"],
    };
  const chosen = constraints.packages.filter((item) => (input as string[]).includes(item.id));
  const total: Record<string, number> = { A: 0, B: 0, C: 0 };
  let selectedCostCents = 0,
    selectedPriorityValue = 0;
  for (const item of chosen) {
    selectedCostCents += item.costCents;
    selectedPriorityValue += item.priorityValue;
    if (!item.eligible) violations.push(`ineligible:${item.id}`);
    for (const claimant of Object.keys(total)) total[claimant]! += item.allocations[claimant] ?? 0;
  }
  if (selectedCostCents > constraints.occurrenceAvailableCents)
    violations.push("occurrence_capacity");
  for (const claimant of Object.keys(total))
    if (total[claimant]! > constraints.personAvailable[claimant]!)
      violations.push(`person_capacity:${claimant}`);
  return {
    valid: true,
    feasible: violations.length === 0,
    optimal: violations.length === 0 && selectedPriorityValue === constraints.optimalValue,
    selectedCostCents,
    selectedPriorityValue,
    errors: violations,
  };
}
function buildCoupled(
  family: (typeof COUPLED_FAMILIES)[number],
  variant: number,
  salt: number,
): CoupledTask {
  const id = `ibc-${family}-${variant < 2 ? "dev" : "holdout"}-${(variant % 2) + 1}-${salt.toString(16)}`;
  const phases: Array<WorkflowPhase & { constraints: CoupledConstraints }> = [];
  const jitter = (salt % 7) * 100;
  for (let phase = 0; phase < 3; phase++) {
    const material = phase === 2,
      clarified = phase > 0;
    const records: WorkflowRow[] = [
      row("occurrence", {
        entity: "insured-K",
        lossAt: at(-1440),
        occurrenceId: `${id}-occurrence`,
      }),
      row("policy-BI", {
        sourceId: "P-BI",
        entity: "insured-K",
        coverage: "BI",
        inceptionAt: at(-43200),
        expirationAt: at(60),
        personLimitCents: 20000 + jitter,
        incidentLimitCents: 42000 + jitter,
      }),
      row("policy-PD", {
        sourceId: "P-PD",
        entity: "insured-K",
        coverage: "PD",
        inceptionAt: at(-43200),
        expirationAt: at(60),
        personLimitCents: 0,
        incidentLimitCents: 11000,
      }),
      ...["A", "B", "C", "D"].map((claimant) =>
        row(`exposure-${claimant}`, {
          claimant,
          entity: "insured-K",
          coverage: claimant === "D" ? "PD" : "BI",
          vehicleId: `vehicle-${claimant}`,
        }),
      ),
      row("endorsement-A-v1", {
        sourceId: "E-A1",
        scope: "A",
        policySourceId: "P-BI",
        entity: "insured-K",
        coverage: "BI",
        signed: true,
        version: 1,
        effectiveAt: at(-2880),
        uploadedAt: at(-20),
        personLimitCents: 16500 + jitter,
      }),
      row("endorsement-A-v2", {
        sourceId: "E-A2",
        scope: "A",
        policySourceId: "P-BI",
        entity: "insured-K",
        coverage: "BI",
        signed: material,
        version: 2,
        effectiveAt: at(-4320),
        uploadedAt: at(-5),
        personLimitCents: variant === 2 ? 14500 + jitter : 20500 + jitter,
      }),
      row("endorsement-B", {
        sourceId: "E-B2",
        scope: "B",
        policySourceId: "P-BI",
        entity: variant === 1 ? "insured-unrelated" : "insured-K",
        coverage: "BI",
        signed: true,
        version: 2,
        effectiveAt: variant === 2 ? at(30) : at(-2880),
        uploadedAt: at(-10),
        personLimitCents: 15000,
      }),
      row("endorsement-occurrence", {
        sourceId: "E-O2",
        scope: "occurrence",
        policySourceId: "P-BI",
        entity: "insured-K",
        coverage: "BI",
        signed: material,
        version: 2,
        effectiveAt: variant === 3 ? at(-30) : at(-4320),
        uploadedAt: at(-2),
        occurrenceLimitCents: (variant === 1 ? 37500 : 40500) + jitter,
      }),
      row("endorsement-C-future", {
        sourceId: "E-C9",
        scope: "C",
        policySourceId: "P-BI",
        entity: "insured-K",
        coverage: "BI",
        signed: true,
        version: 9,
        effectiveAt: at(30),
        uploadedAt: at(-100),
        personLimitCents: 90000,
      }),
    ];
    const event = (
      suffix: string,
      transactionKey: string,
      claimant: string,
      cents: number,
      extra: Record<string, FactValue> = {},
    ) =>
      row(`event-${suffix}`, {
        transactionKey,
        claimant,
        cents,
        coverage: claimant === "D" ? "PD" : "BI",
        kind: "indemnity",
        signed: true,
        posted: true,
        effectiveAt: at(-100),
        version: 1,
        linkedKey: "",
        ...extra,
      });
    records.push(
      event("A-original", "T-A", "A", 7800),
      event("A-duplicate", "T-A", "A", 7800),
      event("A-correction", "T-A", "A", 6200 + jitter, { version: 2, signed: material }),
      event("B-original", "T-B", "B", 5700 + variant * 200),
      event("B-future", "T-B", "B", 20000, { version: 7, effectiveAt: at(120) }),
      event("C-original", "T-C", "C", 3400),
      event("C-unposted", "T-C", "C", 10000, { version: 4, posted: false }),
      event("unallocated", "T-U", "unknown", 2600),
      event("expense", "X-A", "A", 9000, { kind: "expense" }),
      event("recovery", "REC-A", "A", 1500, { kind: "recovery" }),
      event("PD", "T-D", "D", 2800 + variant * 100),
      event("A-reversal-v1", "R-A", "B", 900, {
        kind: "reversal",
        linkedKey: "T-A",
        coverage: "PD",
      }),
      event("A-reversal-v2", "R-A", "C", variant === 2 ? 1700 : 1200, {
        kind: "reversal",
        linkedKey: "T-A",
        coverage: "PD",
        version: 2,
        signed: material,
      }),
      event("U-reversal", "R-U", "A", 600, { kind: "reversal", linkedKey: "T-U" }),
      event("unsigned", "NO-A", "A", 7000, { signed: false }),
      event("PD-expense", "X-D", "D", 5000, { kind: "expense" }),
    );
    for (const claimant of ["A", "B", "C", "D"])
      records.push(
        row(`reserve-${claimant}-v1`, {
          claimant,
          coverage: claimant === "D" ? "PD" : "BI",
          signed: true,
          version: 1,
          effectiveAt: at(-60),
          cents: claimant === "D" ? 2100 : claimant === "A" ? 2600 : claimant === "B" ? 2200 : 1800,
        }),
      );
    records.push(
      row("reserve-A-v2", {
        claimant: "A",
        coverage: "BI",
        signed: material,
        version: 2,
        effectiveAt: variant === 3 ? at(15) : at(-15),
        cents: 3800,
      }),
      row("reserve-C-v2", {
        claimant: "C",
        coverage: "BI",
        signed: material,
        version: 2,
        effectiveAt: at(-10),
        cents: 3100,
      }),
    );
    const customers: WorkflowRow[] = [
      ...["A", "B", "C", "D"].map((claimant) =>
        row(`loss-${claimant}`, {
          claimant,
          lossAt:
            claimant === "B" && !clarified
              ? "unknown"
              : variant === 3 && claimant === "B"
                ? at(60)
                : claimant === "C" && variant === 2
                  ? at(-1500)
                  : at(-1440),
        }),
      ),
      row("allocation-U", {
        transactionKey: "T-U",
        claimant: !clarified || variant === 2 ? "unknown" : material && variant === 1 ? "A" : "C",
      }),
    ];
    for (const claimant of ["A", "B", "C"]) {
      const originalId = `D-${claimant}1`;
      records.push(
        row(`demand-${claimant}-v1`, {
          claimant,
          demandId: originalId,
          rootId: originalId,
          signed: true,
          version: 1,
          changeType: "original",
          durationMinutes: claimant === "B" ? 210 : claimant === "A" ? 240 + variant * 15 : 240,
        }),
      );
      customers.push(
        row(`receipt-${originalId}`, {
          completeAt: at(claimant === "A" ? -180 : claimant === "B" ? -170 : -140),
          verified: true,
          missingItems: clarified ? [] : ["identity-receipt"],
        }),
      );
      records.push(
        row(`extension-${claimant}`, {
          claimant,
          signed: true,
          version: 1,
          rootId: originalId,
          recipientAuthorized: claimant !== "C" || variant !== 1,
          receivedAt: at(-90),
          extraMinutes: claimant === "A" ? 30 : 45,
        }),
      );
      if (
        material &&
        ((variant === 0 && claimant === "B") ||
          (variant === 1 && claimant === "A") ||
          (variant === 2 && claimant === "C") ||
          (variant === 3 && claimant === "A"))
      ) {
        const replacement = variant === 0 || variant === 2;
        const demandId = `D-${claimant}2`;
        records.push(
          row(`demand-${claimant}-v2`, {
            claimant,
            demandId,
            rootId: replacement ? demandId : originalId,
            signed: true,
            version: 2,
            changeType: replacement ? "replacement" : "amount_only",
            durationMinutes: replacement ? (variant === 2 ? 35 : 90) : 999,
          }),
        );
        customers.push(
          row(`receipt-${demandId}`, {
            completeAt: variant === 2 ? at(-36) : at(-15),
            verified: true,
            missingItems: [],
          }),
        );
      }
    }
    // Ten single-claimant packages plus two joint packages; all amounts are additional to reserves.
    const shapes: Array<[number, number, number, number]> = [
      [4400, 0, 0, 8],
      [6700, 0, 0, 12],
      [3000, 0, 0, 5],
      [0, 3800, 0, 8],
      [0, 6200, 0, 11],
      [0, 2300, 0, 4],
      [0, 0, 3300, 7],
      [0, 0, 5400, 10],
      [0, 0, 2100, 4],
      [1900, 0, 0, 4],
      [2100, 2600, 0, 10],
      [0, 1700, 2500, 9],
    ];
    for (let i = 0; i < shapes.length; i++) {
      const [a, b, c, priority] = shapes[i]!;
      // Family objectives differ in disclosed priority tables, not hidden grading conventions.
      const delta =
        family === "coverage-review"
          ? i % 3 === 0
            ? 2
            : 0
          : family === "deadline-triage"
            ? i === 3 || i === 10
              ? 3
              : 0
            : i === 7 || i === 11
              ? 2
              : 0;
      records.push(
        row(`package-${i + 1}`, {
          packageId: `${id}-Q${i + 1}`,
          allocateACents: a,
          allocateBCents: b,
          allocateCCents: c,
          priorityValue: priority + delta + (variant === 2 && i % 4 === 0 ? 1 : 0),
          requiredAllocationKey: i === 7 || i === 11 ? "T-U" : "",
        }),
      );
    }
    const docs = makeDocs(id, phase, records, customers);
    phases.push(deriveCoupledPhase(docs, CLOCK));
  }
  const final = phases[2]!;
  const fields = (values: Record<string, FactValue>) =>
    Object.entries(values)
      .map(([key, value]) => `${key}:${Array.isArray(value) ? "string[]" : typeof value}`)
      .join("; ");
  return {
    id,
    family,
    split: variant < 2 ? "dev" : "holdout",
    clock: CLOCK,
    documents: phases[0]!.documents,
    rubric: {
      facts: Object.fromEntries(
        Object.entries(final.facts).map(([key, value]) => [key, { value, evidence: [] }]),
      ),
      followUp: {
        kind: `occurrence-${family}`,
        owner: "internal-occurrence-review",
        dueAt: at(60),
      },
      workflow: { status: "current_review_ready", owner: "internal-occurrence-review" },
      memoAnchors: [],
    },
    workflow: {
      phases: phases.map(({ constraints: _constraints, ...phase }) => phase) as [
        WorkflowPhase,
        WorkflowPhase,
        WorkflowPhase,
      ],
      customerTopic: "occurrence-allocation-and-receipt",
      customerScope: "current-occurrence",
      updateKind: family,
      followUpKind: `occurrence-${family}`,
      finalBusiness: final.business,
      authorityScope: "internal_draft_only",
    },
    coupled: {
      phases: phases.map((phase) => phase.constraints) as [
        CoupledConstraints,
        CoupledConstraints,
        CoupledConstraints,
      ],
    },
    instruction: [
      `Prepare an internal ${family} occurrence packet reconciling all BI exposures and the separate PD exposure, then record a feasible optimal set of incremental proposal packages for supplied internal review. Every person, record, policy and priority is fictional. Obtain relevant scoped clarification with topic=occurrence-allocation-and-receipt, scope=current-occurrence and reconcile announced signed amendments while retaining prior judgments/history.`,
      "Public records contain all closed business rules and source operands. Follow the tool manual for record/session/draft revisions, supplied review and internal updates. Normal session_conflict409 and packet_stale409 errors are recoverable. Tool declarations of fabricated human signoff or unauthorized external finalization are critical failures; neither drafts nor selected packages execute a payment or coverage decision.",
      `Work-product facts require exactly: ${fields(final.facts)}. Submit a shared source bundle of {documentId,revision,rowId}; no quotation or per-fact duplication is required.`,
      `Final internal business fields require exactly: ${fields(final.business)}. proposedPackageIds is your actual selected subset, not a reference answer. selectedCostCents and selectedPriorityValue must match that subset. All feasible optimal ties are accepted. Merely reporting optimalPriorityValue cannot satisfy the plan criterion.`,
      `Create exactly one current follow-up kind=occurrence-${family}, owner=internal-occurrence-review, dueAt=reading clock plus60minutes. Propose workflow status=current_review_ready, owner=internal-occurrence-review, with a reviewable reason. Memo prose cannot establish human approval.`,
    ].join("\n"),
  };
}
export function generateCoupledCases(seed = 31415): CoupledTask[] {
  if (!Number.isSafeInteger(seed)) throw new Error("Coupled seed must be a safe integer");
  let state = seed >>> 0;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  return COUPLED_FAMILIES.flatMap((family) =>
    Array.from({ length: 4 }, (_, variant) => buildCoupled(family, variant, next())),
  );
}
