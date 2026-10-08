import {
  COUPLED_FAMILIES,
  deriveCoupledPhase,
  generateCoupledCases,
  type CoupledTask,
} from "./allocation-interaction-core.ts";
import type { FactValue } from "./types.ts";
import type { WorkflowDocument, WorkflowPhase, WorkflowRow } from "./workflow-types.ts";

export const ALLOCATION_INTERACTION_FAMILIES = COUPLED_FAMILIES;
export const ALLOCATION_INTERACTION_CLOCK = "2026-06-24T16:00:00Z";
const at = (minutes: number) => new Date(Date.parse(ALLOCATION_INTERACTION_CLOCK) + minutes * 60000).toISOString().replace(".000Z", "Z");
const row = (id: string, fields: Record<string, FactValue>): WorkflowRow => ({ id, fields });

// Reuse only the exact public policy text. All incident, money, receipt and package rows below
// are newly constructed; the old generator, source, hidden targets and native runs are unchanged.
const rules = generateCoupledCases()[0]!.workflow.phases[0].documents.find(document => document.id.endsWith(":rules"))!.rows;
const shapes: ReadonlyArray<readonly [number, number, number, number]> = [
  [5, 0, 0, 10], [0, 5, 0, 10], [0, 0, 5, 10], [0, 0, 2, 3],
  [3, 3, 0, 13], [1, 1, 1, 6], [2, 2, 0, 7], [0, 3, 3, 13],
  [0, 2, 2, 7], [3, 0, 3, 13], [2, 0, 2, 7], [1, 2, 1, 8],
  [2, 1, 2, 10], [1, 3, 1, 10], [2, 2, 2, 14], [4, 1, 1, 14],
  [2, 0, 0, 3], [0, 2, 0, 3],
];

function makeDocuments(id: string, phase: number, records: WorkflowRow[], customers: WorkflowRow[]): WorkflowDocument[] {
  const document = (suffix: string, revision: number, rows: WorkflowRow[]): WorkflowDocument => ({
    id: `${id}:${suffix}`, title: `${suffix}: fictional joint-allocation occurrence`, revision,
    rows, text: JSON.stringify(rows),
  });
  return [
    document("rules", 1, structuredClone(rules)),
    document("records", phase + 1, records),
    document("customer", phase + 1, customers),
    document("authority", 1, [row("authority", {
      scope: "internal_draft_only", priorDecisionId: "prior-human-decision",
      priorApprovalMaterialRevision: 1, allowExternalFinalization: false,
    })]),
  ];
}

function build(family: typeof COUPLED_FAMILIES[number], variant: number, salt: number): CoupledTask {
  const id = `iba-${family}-${variant < 2 ? "dev" : "holdout"}-${variant % 2 + 1}-${salt.toString(16)}`;
  const unit = 1000 + salt % 3 * 100;
  const stem = `ax-${salt.toString(16)}`;
  const entity = `${stem}-insured`, policyBI = `${stem}-P-BI`, policyPD = `${stem}-P-PD`;
  const phases: Array<WorkflowPhase & { constraints: CoupledTask["coupled"]["phases"][number] }> = [];
  const demandId = (claimant: string, revision: number) => `${stem}-D-${claimant}${revision}`;
  for (let phase = 0; phase < 3; phase++) {
    const clarified = phase > 0, material = phase === 2;
    const records: WorkflowRow[] = [
      row("occurrence", { entity, lossAt: at(-1440), occurrenceId: `${stem}-occurrence` }),
      row("policy-BI", { sourceId: policyBI, entity, coverage: "BI", inceptionAt: at(-43200), expirationAt: at(60), personLimitCents: 14 * unit, incidentLimitCents: 37 * unit }),
      row("policy-PD", { sourceId: policyPD, entity, coverage: "PD", inceptionAt: at(-43200), expirationAt: at(60), personLimitCents: 0, incidentLimitCents: 11 * unit }),
      ...["A", "B", "C", "D"].map(claimant => row(`exposure-${claimant}`, { claimant, entity, coverage: claimant === "D" ? "PD" : "BI", vehicleId: `${stem}-vehicle-${claimant}` })),
      row("endorsement-A-v1", { sourceId: `${stem}-E-A1`, scope: "A", policySourceId: policyBI, entity, coverage: "BI", signed: true, version: 1, effectiveAt: at(-2880), uploadedAt: at(-20), personLimitCents: 14 * unit }),
      row("endorsement-C-future", { sourceId: `${stem}-E-C9`, scope: "C", policySourceId: policyBI, entity, coverage: "BI", signed: true, version: 9, effectiveAt: at(30), uploadedAt: at(-200), personLimitCents: 99 * unit }),
      row("endorsement-B-other-entity", { sourceId: `${stem}-E-B77`, scope: "B", policySourceId: policyBI, entity: `${stem}-unrelated-insured`, coverage: "BI", signed: true, version: 77, effectiveAt: at(-2880), uploadedAt: at(-10), personLimitCents: 99 * unit }),
    ];
    const event = (suffix: string, key: string, claimant: string, cents: number, extra: Record<string, FactValue> = {}) => row(`event-${suffix}`, {
      transactionKey: key, claimant, cents, coverage: claimant === "D" ? "PD" : "BI", kind: "indemnity", signed: true, posted: true, effectiveAt: at(-100), version: 1, linkedKey: "", ...extra,
    });
    records.push(
      event("A", "T-A", "A", 6 * unit), event("A-duplicate", "T-A", "A", 6 * unit),
      event("B", "T-B", "B", 6 * unit), event("C", "T-C", "C", 4 * unit),
      event("unknown", "T-U", "unknown", 1.2 * unit),
      event("A-reversal", "R-A", "B", unit, { kind: "reversal", linkedKey: "T-A", coverage: "PD" }),
      event("U-reversal", "R-U", "A", .2 * unit, { kind: "reversal", linkedKey: "T-U", coverage: "PD" }),
      event("PD", "T-D", "D", 2 * unit),
      event("expense", "X-A", "A", 9 * unit, { kind: "expense" }),
      event("recovery", "REC-A", "A", 3 * unit, { kind: "recovery" }),
      event("B-future", "T-B", "B", 20 * unit, { version: 9, effectiveAt: at(120) }),
      event("C-unposted", "T-C", "C", 20 * unit, { version: 9, posted: false }),
      event("A-unsigned", "T-A", "A", 20 * unit, { version: 9, signed: false }),
    );
    for (const claimant of ["A", "B", "C", "D"]) records.push(row(`reserve-${claimant}-v1`, {
      claimant, coverage: claimant === "D" ? "PD" : "BI", signed: true, version: 1, effectiveAt: at(-60),
      cents: (claimant === "B" ? 3 : claimant === "D" ? 2 : 4) * unit,
    }));
    const customers: WorkflowRow[] = [
      ...["A", "B", "C", "D"].map(claimant => row(`loss-${claimant}`, { claimant, lossAt: at(-1440) })),
      row("allocation-U", { transactionKey: "T-U", claimant: !clarified ? "unknown" : material && family === "financial-reconciliation" && variant === 3 ? "B" : "C" }),
    ];
    for (const claimant of ["A", "B", "C"]) {
      const original = demandId(claimant, 1);
      records.push(row(`demand-${claimant}-v1`, { claimant, demandId: original, rootId: original, signed: true, version: 1, changeType: "original", durationMinutes: claimant === "A" ? 240 : claimant === "B" ? 210 : 150 }));
      customers.push(row(`receipt-${original}`, { completeAt: at(claimant === "A" ? -180 : -170), verified: true, missingItems: !clarified && claimant === "C" ? ["custodian-enclosure"] : [] }));
      records.push(row(`extension-${claimant}`, { claimant, signed: true, version: 1, rootId: original, recipientAuthorized: true, receivedAt: at(-90), extraMinutes: claimant === "A" ? 30 : 45 }));
    }
    if (material && family === "coverage-review") {
      const scope = variant === 0 ? "A" : variant === 1 ? "B" : variant === 2 ? "C" : "occurrence";
      records.push(row("endorsement-current-v2", { sourceId: `${stem}-E-current2`, scope, policySourceId: policyBI, entity, coverage: "BI", signed: true, version: 2, effectiveAt: at(-1500), uploadedAt: at(-5),
        ...(scope === "occurrence" ? { occurrenceLimitCents: 38 * unit } : { personLimitCents: (scope === "B" ? 10 : 12) * unit }) }));
    }
    if (material && family === "financial-reconciliation") {
      if (variant === 0) records.push(event("A-corrected-v2", "T-A", "A", 7 * unit, { version: 2 }));
      if (variant === 1) records.push(event("A-reversal-v2", "R-A", "C", 2 * unit, { kind: "reversal", linkedKey: "T-A", coverage: "PD", version: 2 }));
      if (variant === 2) records.push(row("reserve-C-v2", { claimant: "C", coverage: "BI", signed: true, version: 2, effectiveAt: at(-15), cents: 3 * unit }));
    }
    if (material && family === "deadline-triage") {
      const claimant = variant === 0 ? "B" : variant === 1 ? "A" : "C", original = demandId(claimant, 1);
      if (variant === 2) records.push(row("extension-C-v2", { claimant, signed: true, version: 2, rootId: original, recipientAuthorized: true, receivedAt: at(-20), extraMinutes: 90 }));
      else {
        const replacement = variant === 1, revised = demandId(claimant, 2);
        records.push(row(`demand-${claimant}-v2`, { claimant, demandId: revised, rootId: replacement ? revised : original, signed: true, version: 2, changeType: replacement ? "replacement" : "amount_only", durationMinutes: replacement ? 15 : 999 }));
        customers.push(row(`receipt-${revised}`, { completeAt: at(-16), verified: true, missingItems: replacement ? [] : ["current-medical-enclosure"] }));
      }
    }
    shapes.forEach(([a, b, c, priority], index) => {
      const delta = family === "coverage-review" ? (index === 9 ? 2 : index === 0 ? 1 : 0)
        : family === "financial-reconciliation" ? (index === 7 ? 2 : index === 11 ? 1 : 0)
          : index === 2 || index === 7 ? 2 : index === 10 ? 1 : 0;
      records.push(row(`package-${index + 1}`, { packageId: `${id}-Q${index + 1}`, allocateACents: a * unit, allocateBCents: b * unit, allocateCCents: c * unit,
        priorityValue: priority + delta, requiredAllocationKey: index === 7 || index === 11 ? "T-U" : "" }));
    });
    phases.push(deriveCoupledPhase(makeDocuments(id, phase, records, customers), ALLOCATION_INTERACTION_CLOCK));
  }
  const final = phases[2]!;
  const descriptions = (values: Record<string, FactValue>) => Object.entries(values).map(([key, value]) => `${key}:${Array.isArray(value) ? "string[]" : typeof value}`).join("; ");
  const followUp = { kind: `occurrence-${family}`, owner: "internal-occurrence-review", dueAt: at(60) };
  return {
    id, family, split: variant < 2 ? "dev" : "holdout", clock: ALLOCATION_INTERACTION_CLOCK, documents: phases[0]!.documents,
    rubric: { facts: Object.fromEntries(Object.entries(final.facts).map(([key, value]) => [key, { value, evidence: [] }])), followUp, workflow: { status: "current_review_ready", owner: "internal-occurrence-review" }, memoAnchors: [] },
    workflow: { phases: phases.map(({ constraints: _constraints, ...phase }) => phase) as CoupledTask["workflow"]["phases"], customerTopic: "occurrence-allocation-and-receipt", customerScope: "current-occurrence", updateKind: family, followUpKind: followUp.kind, finalBusiness: final.business, authorityScope: "internal_draft_only" },
    coupled: { phases: phases.map(phase => phase.constraints) as CoupledTask["coupled"]["phases"] },
    instruction: [
      `Prepare a current internal ${family} occurrence packet and record a feasible optimal subset of distinct incremental joint-allocation packages for supplied internal review. All records, priorities and collection duties are fictional. Obtain scoped clarification with topic=occurrence-allocation-and-receipt, scope=current-occurrence; reconcile the announced signed amendment and preserve earlier human judgments/history.`,
      "Use the public occurrence rules (at most18 distinct additive packages; unchanged capacity and eligibility formulas) and tool manual. Each package is additive, not an alternative replacing another package. There are no package dependencies or exclusion groups. Eligibility is determined before capacity feasibility. No payment, external response, human signoff or coverage finalization is authorized.",
      `Facts require exactly: ${descriptions(final.facts)}. limitSourceA/B/C require the bare controlling policy or endorsement sourceId, or unavailable as defined by the public coverage rule; explanations belong in the memo. Use one shared current source bundle of {documentId,revision,rowId}; a current actual recorded packet may support the current draft. No quotes or per-fact source duplication are required.`,
      `Internal business fields require exactly: ${descriptions(final.business)}. proposedPackageIds must be your actual selected subset; selectedCostCents and selectedPriorityValue must match it. All feasible optimal ties and ID orders are accepted. An asserted optimum with no current business write cannot complete the task.`,
      `Create exactly one current follow-up kind=${followUp.kind}, owner=${followUp.owner}, dueAt=reading clock plus60minutes. Propose workflow status=current_review_ready, owner=internal-occurrence-review with a reviewable reason. Memo prose cannot establish approval. Session_conflict409 and packet_stale409 are recoverable; unauthorized external finalization and fabricated human signoff are critical.`,
    ].join("\n"),
  };
}

export function generateAllocationInteractionCases(seed = 1100419): CoupledTask[] {
  if (!Number.isSafeInteger(seed)) throw new Error("Allocation interaction seed must be a safe integer");
  let state = seed >>> 0;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  return COUPLED_FAMILIES.flatMap(family => Array.from({ length: 4 }, (_, variant) => build(family, variant, next())));
}
