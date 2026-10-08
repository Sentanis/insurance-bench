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
export interface CoupledPackage {
  id: string;
  allocations: Record<string, number>;
  costCents: number;
  priorityValue: number;
  eligible: boolean;
  requiresPackageIds?: string[];
  excludesPackageIds?: string[];
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
  "This dependency allocation track permits at most18 distinct additive packages. Its per-person, shared-capacity, eligibility and all-optimal-ties rules are otherwise unchanged.",
  "Current component contracts are the highest signed package revision effective no later than reading clock, scoped by packageId within this occurrence; unsigned/future-effective revisions do not replace it. Equal eligible revisions must agree on contract terms; conflicting terms are an invalid source dataset. Optional requiresPackageIds and excludesPackageIds arrays default to empty. Individually eligiblePackageIds describes only coverage/receipt/deadline/allocation-key eligibility of offered current components, not whether their prerequisites are selectable. A whole plan must include every selected component's named prerequisites, with their costs/allocations/priorities counted normally. Prerequisite cycles are allowed only as complete all-or-none bundles. If either selected component names the other in excludesPackageIds, they cannot coexist; self-exclusion forbids selecting that component. Missing prerequisite IDs make a selected plan infeasible. Contracts are internal component-coordination constraints, never payment authority. These whole-plan constraints apply in addition to the capacity/eligibility rules, and every tied optimum remains accepted.",
];
function contractSignature(item: WorkflowRow): string {
  const keys = ["packageId", "allocateACents", "allocateBCents", "allocateCCents", "priorityValue", "requiredAllocationKey", "requiresPackageIds", "excludesPackageIds"];
  return JSON.stringify(keys.map(key => [key, key === "requiresPackageIds" || key === "excludesPackageIds"
    ? Array.isArray(item.fields[key]) ? [...item.fields[key] as string[]].sort() : item.fields[key] ?? []
    : item.fields[key]]));
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
function references(item: CoupledPackage, field: "requiresPackageIds" | "excludesPackageIds"): string[] {
  const ids = item[field] ?? [];
  if (!Array.isArray(ids) || ids.some(id => typeof id !== "string" || !id.length)
    || new Set(ids).size !== ids.length) throw new Error(`Invalid ${field} contract`);
  return ids;
}
function compiledContracts(packages: CoupledPackage[]) {
  const index = new Map(packages.map((item, i) => [item.id, i]));
  if (index.size !== packages.length) throw new Error("Duplicate package catalog IDs");
  return packages.map(item => ({
    required: references(item, "requiresPackageIds").reduce((mask, id) => mask | (1 << (index.get(id) ?? 18)), 0),
    excluded: references(item, "excludesPackageIds").reduce((mask, id) => mask | (index.has(id) ? 1 << index.get(id)! : 0), 0),
  }));
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
  const contracts = compiledContracts(constraints.packages);
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
    if (contracts.some((contract, bit) => (gray & (1 << bit))
      && ((gray & contract.required) !== contract.required || (gray & contract.excluded) !== 0))) continue;
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
  const currentPackages = new Map<string, WorkflowRow>();
  for (const item of records.filter(item => item.id.startsWith("package-"))) {
    if (item.fields.signed !== true || !Number.isSafeInteger(item.fields.version)
      || n(item, "version") < 1 || !Number.isFinite(Date.parse(s(item, "effectiveAt")))
      || Date.parse(s(item, "effectiveAt")) > now) continue;
    const id = s(item, "packageId"), prior = currentPackages.get(id);
    if (!prior || n(item, "version") > n(prior, "version")) currentPackages.set(id, item);
    else if (n(item, "version") === n(prior, "version") && contractSignature(item) !== contractSignature(prior))
      throw new Error("Conflicting equal-version package contracts");
  }
  const packages = [...currentPackages.values()]
    .map((item) => {
      const allocations = Object.fromEntries(
        ["A", "B", "C"].map((claimant) => [claimant, n(item, `allocate${claimant}Cents`)]),
      );
      return {
        id: s(item, "packageId"),
        allocations,
        costCents: Object.values(allocations).reduce((a, b) => a + b, 0),
        priorityValue: n(item, "priorityValue"),
        requiresPackageIds: item.fields.requiresPackageIds as string[] | undefined ?? [],
        excludesPackageIds: item.fields.excludesPackageIds as string[] | undefined ?? [],
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
    for (const required of references(item, "requiresPackageIds"))
      if (!(input as string[]).includes(required)) violations.push(`missing_prerequisite:${item.id}:${required}`);
    for (const excluded of references(item, "excludesPackageIds"))
      if ((input as string[]).includes(excluded)) violations.push(`excluded_pair:${item.id}:${excluded}`);
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
export function dependencyAllocationRuleRows(): WorkflowRow[] {
  return RULES.map((text, i) => row(`rule-${i + 1}`, { text }));
}
