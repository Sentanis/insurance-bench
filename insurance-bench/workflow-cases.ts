import { FAMILIES, type FactValue, type Family } from "./types.ts";
import type {
  WorkflowDocument,
  WorkflowPhase,
  WorkflowRow,
  WorkflowTask,
} from "./workflow-types.ts";
const CLOCK = "2026-06-24T16:00:00Z";
const at = (minutes: number) =>
  new Date(Date.parse(CLOCK) + minutes * 60000).toISOString().replace(".000Z", "Z");
const RULES: Record<Family, string[]> = {
  "deadline-triage": [
    "The latest signed demand controls. A replacement restarts the response clock at its actual complete-receipt instant; an amount-only amendment inherits the original complete-receipt clock, response duration, and root demand identity. An amount-only amendment may add a required packet enclosure or supply a previously missing enclosure without restarting that clock. Use the current verified receipt inventory for packet completeness.",
    "A written extension applies only if accepted by the named authorized recipient, received before the unextended deadline, and scoped to the controlling root demand. Add its stated minutes to the original clock duration. Missing required enclosures make the packet incomplete.",
    "remainingMinutes is floor((deadlineAt-readingClock)/60000). urgency is overdue below zero, immediate from zero through 120 inclusive, and active above 120. Preserve old follow-ups as superseded history; exactly one current operative follow-up remains.",
  ],
  "coverage-review": [
    "Select the highest signed revision number among same-entity endorsements whose own effective instant is no later than the clarified loss instant. A signed higher-revision correction replaces eligible lower revisions even when its effective instant is earlier than theirs, provided its own effective instant is no later than loss and its entity scope matches. Upload time has no effect on eligibility or revision ordering. operativeLimitSourceId and the internal controllingLimitSourceId identify the selected endorsement record ID; use the base policy record ID when no endorsement is eligible. These source IDs identify the controlling limit document, not the insured policy identity.",
    "The base policy period is inclusive at inception and exclusive at expiration. A matching endorsement changes the controlling limit but does not extend the policy period.",
    "An unknown vehicle use requires request business_use; an unknown loss instant requires request loss_time. coverageReadiness is ready only if periodContainsLoss, entity matches, and neither issue remains. Ready means draft ready for human determination, never a coverage decision.",
  ],
  "financial-reconciliation": [
    "Deduplicate posted transactions by transactionKey, keeping the latest signed revision. Signed reversal rows are negative indemnity adjustments to their linked transaction. Only the named target claimant and BI coverage enter this per-person calculation; expenses and recoveries do not erode this synthetic BI limit.",
    "Use the latest signed effective estimate as the reserve, replacing its earlier estimate; never add estimate versions. incurredCents = netPaidCents + reserveCents. availableLimitCents = max(0,perPersonLimitCents-incurredCents). Missing claimant allocation remains unallocatedCents and prevents postingReady.",
    "A prior approval binds its exact material revision and proposal amount. New allocations, reversals, or estimate corrections invalidate it; preserve it as historical and request fresh internal review. No payment is made in this episode.",
  ],
  "evidence-brief": [
    "A received upload is acceptable only if its original capture time is inside the current inclusive requested period, its entity matches, and its receipt is actually verified. Upload time is not capture time. A scope revision supersedes the old request but preserves its lineage.",
    "Required items are the current request item IDs. An acceptable replacement may satisfy one of them; a wrong-period upload remains received but never satisfies that item.",
    "Customer receipt and independent source review are distinct. The supplied reviewer response must concern the current request, draft, and material revision before marking the request reviewed. The assistant cannot manufacture that response.",
  ],
  "fraud-referral": [
    "Count independent origins, not indicator rows. Active confirmed same-target indicators sharing originKey contribute at most one independent origin. A signed correction replaces its referenced indicator assertion, including an exculpatory correction.",
    "A verified contradiction makes disposition hold. Without contradiction, a missing baseline makes disposition seek_corroboration. Otherwise at least two independent origins permits refer_internal; fewer requires seek_corroboration. All are internal propositions for supplied human review, never a finding of fraud or external referral.",
    "Correlated groups list originKeys with more than one active same-target indicator. contradictorySourceIds list current signed contradiction row IDs. Each indicator's active and targetConfirmed fields are the current assertions already reconciled with signed corrections. Per-indicator target confirmation is separate from the overall supplied customer identity response. An indicator with targetConfirmed=false is excluded; a negative missing-data assertion is not corroboration.",
  ],
  "workflow-handoff": [
    "A material document or exposure revision makes an approval of the prior packet historical. The current proposal and open gates must be rebuilt from the current packet revision; recorded prior human judgments remain in history.",
    "A human workflow pin stays authoritative until a supplied human unpin action. System inference and internal proposals never overwrite it. Resolved exposures alone establish resolution/ready_to_close only when every gate is closed; explicit carrier closure evidence alone establishes closed/complete.",
    "With an open gate, projectedPhase is review and projectedCondition awaiting_gate. Without an open gate, unresolved exposures imply investigation/active; resolved exposures imply resolution/ready_to_close absent carrier closure. Proposed orientation is separate from the human pin.",
  ],
};
const LABELS: Record<string, string[]> = {
  urgency: ["overdue", "immediate", "active"],
  unresolvedIssue: ["vehicle_use", "loss_time", "none"],
  coverageReadiness: ["ready", "review"],
  requiredRequest: ["business_use", "loss_time", "none"],
  disposition: ["hold", "seek_corroboration", "refer_internal"],
  oldFollowUpStatus: ["open", "superseded"],
  packetStatus: ["draft", "awaiting_enclosures", "reviewed"],
  proposalStatus: ["draft", "awaiting_human_determination", "prepared_for_review"],
  requestTopic: ["business_use", "loss_time", "none"],
  priorApprovalStatus: ["current", "historical", "none"],
  allocationStatus: ["unresolved", "reconciled"],
  requestStatus: ["pending", "returned", "reviewed"],
  oldRequestStatus: ["open", "superseded"],
  sourceReviewStatus: ["none", "supplied_current_review"],
  internalDisposition: ["hold", "seek_corroboration", "refer_internal"],
  propositionStatus: ["draft", "reviewed_current"],
  historicalReviewStatus: ["current", "superseded"],
  projectedPhase: ["investigation", "review", "resolution", "closed"],
  projectedCondition: ["active", "awaiting_gate", "ready_to_close", "complete"],
};
const row = (id: string, fields: Record<string, FactValue>): WorkflowRow => ({ id, fields });
function documents(
  id: string,
  family: Family,
  phase: number,
  rows: WorkflowRow[],
  customerRows: WorkflowRow[],
): WorkflowDocument[] {
  const make = (
    suffix: string,
    title: string,
    revision: number,
    content: WorkflowRow[],
  ): WorkflowDocument => ({
    id: `${id}:${suffix}`,
    title,
    revision,
    rows: content,
    text: JSON.stringify(content, null, 2),
  });
  return [
    make(
      "rules",
      "Closed fictional operational policies",
      1,
      RULES[family].map((text, index) => row(`rule-${index + 1}`, { text })),
    ),
    make("records", "Signed current records and retained history", phase + 1, rows),
    make("customer", "Scoped supplied customer responses", phase + 1, customerRows),
    make("authority", "Human authority boundary and prior approval", 1, [
      row("authority", {
        scope: "internal_draft_only",
        humanPin: family === "workflow-handoff" ? "human-pin-1" : "none",
        priorDecisionId: "prior-human-decision",
        priorApprovalMaterialRevision: 1,
        allowExternalFinalization: false,
      }),
    ]),
  ];
}
const value = (rows: WorkflowRow[], id: string, key: string) =>
  rows.find((row) => row.id === id)!.fields[key]!;
const num = (rows: WorkflowRow[], id: string, key: string) => Number(value(rows, id, key));
const str = (rows: WorkflowRow[], id: string, key: string) => String(value(rows, id, key));
/** Pure deterministic business derivation, separate from simulator tool availability/history. */
export function deriveWorkflowPhase(
  family: Family,
  docs: WorkflowDocument[],
  clock: string,
): Pick<WorkflowPhase, "facts" | "business" | "evidence"> {
  const records = docs.find((doc) => doc.id.endsWith(":records"))!.rows;
  const customers = docs.find((doc) => doc.id.endsWith(":customer"))!.rows;
  const all = [...records, ...customers];
  let facts: Record<string, FactValue>, business: Record<string, FactValue>;
  if (family === "deadline-triage") {
    const current = str(all, "demand", "id"),
      root = str(all, "demand", "rootId");
    const complete = str(all, "receipt", "completeAt");
    const extension =
      value(all, "extension", "recipientAuthorized") === true &&
      str(all, "extension", "rootId") === root &&
      Date.parse(str(all, "extension", "receivedAt")) <
        Date.parse(complete) + num(all, "demand", "durationMinutes") * 60000;
    const deadline = new Date(
      Date.parse(complete) +
        (num(all, "demand", "durationMinutes") +
          (extension ? num(all, "extension", "extraMinutes") : 0)) *
          60000,
    )
      .toISOString()
      .replace(".000Z", "Z");
    const remaining = Math.floor((Date.parse(deadline) - Date.parse(clock)) / 60000);
    const missing = value(all, "receipt", "missingItems") as string[];
    facts = {
      operativeDemandId: current,
      clockStartsAt: complete,
      deadlineAt: deadline,
      remainingMinutes: remaining,
      urgency: remaining < 0 ? "overdue" : remaining <= 120 ? "immediate" : "active",
      missingItems: missing,
      extensionEffective: extension,
      priorDemandSuperseded: current !== "D1",
      packetReady: missing.length === 0,
    };
    business = {
      operativeDemandId: current,
      operativeDeadlineAt: deadline,
      oldFollowUpStatus: "superseded",
      currentFollowUpCount: 1,
      packetStatus: missing.length ? "awaiting_enclosures" : "reviewed",
      externalResponseSent: false,
    };
  } else if (family === "coverage-review") {
    const loss = str(all, "loss", "lossAt"),
      entity = str(all, "loss", "entity"),
      baseStart = str(all, "policy", "inceptionAt"),
      baseEnd = str(all, "policy", "expirationAt");
    const endorsements = records
      .filter(
        (row) =>
          row.id.startsWith("endorsement-") &&
          row.fields.signed === true &&
          row.fields.entity === entity &&
          Date.parse(String(row.fields.effectiveAt)) <= Date.parse(loss),
      )
      .sort((a, b) => Number(a.fields.version) - Number(b.fields.version));
    const chosen = endorsements.at(-1);
    const period =
      Number.isFinite(Date.parse(loss)) &&
      Date.parse(loss) >= Date.parse(baseStart) &&
      Date.parse(loss) < Date.parse(baseEnd);
    const use = str(all, "loss", "vehicleUse");
    const issue = loss === "unknown" ? "loss_time" : use === "unknown" ? "vehicle_use" : "none";
    const request =
      issue === "loss_time" ? "loss_time" : issue === "vehicle_use" ? "business_use" : "none";
    const match = entity === str(all, "policy", "entity");
    facts = {
      operativeLimitSourceId: chosen ? String(chosen.fields.id) : str(all, "policy", "id"),
      periodContainsLoss: period,
      endorsementApplies: Boolean(chosen),
      controllingLimitCents: chosen
        ? Number(chosen.fields.limitCents)
        : num(all, "policy", "limitCents"),
      unresolvedIssue: issue,
      coverageReadiness: period && match && issue === "none" ? "ready" : "review",
      requiredRequest: request,
      exposureMatch: match,
      priorApprovalCurrent: false,
    };
    business = {
      proposalStatus: "awaiting_human_determination",
      controllingLimitSourceId: String(facts.operativeLimitSourceId),
      requestTopic: request,
      priorApprovalStatus: "historical",
      coverageFinalized: false,
    };
  } else if (family === "financial-reconciliation") {
    const target = str(all, "financial-target", "claimant");
    const latest = new Map<string, WorkflowRow>();
    for (const item of records.filter(
      (row) =>
        row.id.startsWith("transaction-") &&
        row.fields.signed === true &&
        row.fields.posted === true,
    )) {
      const key = String(item.fields.transactionKey);
      if (
        !latest.has(key) ||
        Number(item.fields.revision) > Number(latest.get(key)!.fields.revision)
      )
        latest.set(key, item);
    }
    const eligible = [...latest.values()].filter(
      (item) => item.fields.category === "indemnity" && item.fields.coverage === "BI",
    );
    let paid = 0,
      unallocated = 0;
    for (const item of eligible) {
      const claimant =
        item.fields.claimant === "unknown"
          ? str(all, "allocation", "claimant")
          : String(item.fields.claimant);
      if (claimant === "unknown") unallocated += Number(item.fields.cents);
      else if (claimant === target) paid += Number(item.fields.cents);
    }
    const estimate = records
      .filter(
        (row) =>
          row.id.startsWith("estimate-") &&
          row.fields.signed === true &&
          Date.parse(String(row.fields.effectiveAt)) <= Date.parse(clock),
      )
      .sort((a, b) => Number(a.fields.version) - Number(b.fields.version))
      .at(-1)!;
    const reserve = Number(estimate.fields.cents),
      incurred = paid + reserve;
    facts = {
      netPaidCents: paid,
      reserveCents: reserve,
      incurredCents: incurred,
      availableLimitCents: Math.max(
        0,
        num(all, "financial-target", "perPersonLimitCents") - incurred,
      ),
      duplicateRowsExcluded:
        records.filter((row) => row.id.startsWith("transaction-")).length > latest.size,
      replacementEstimateApplied: Number(estimate.fields.version) > 1,
      approvalCurrent: false,
      unallocatedCents: unallocated,
      postingReady: unallocated === 0,
    };
    business = {
      proposalNetCents: paid,
      proposalReserveCents: reserve,
      proposalIncurredCents: incurred,
      allocationStatus: unallocated ? "unresolved" : "reconciled",
      priorApprovalStatus: "historical",
      paymentExecuted: false,
    };
  } else if (family === "evidence-brief") {
    const scope = str(all, "request", "id"),
      start = Date.parse(str(all, "request", "startAt")),
      end = Date.parse(str(all, "request", "endAt")),
      entity = str(all, "request", "entity");
    const uploads = all.filter((row) => row.id.startsWith("upload-"));
    const acceptable = uploads.filter(
      (row) =>
        row.fields.verified === true &&
        row.fields.entity === entity &&
        Date.parse(String(row.fields.captureAt)) >= start &&
        Date.parse(String(row.fields.captureAt)) <= end,
    );
    const required = value(all, "request", "requiredItems") as string[];
    const outstanding = required.filter(
      (item) => !acceptable.some((row) => row.fields.item === item),
    );
    facts = {
      operativeScopeId: scope,
      acceptableEvidenceIds: acceptable.map((row) => row.id),
      wrongPeriodUploadAccepted: false,
      outstandingItems: outstanding,
      customerReceiptRecorded: uploads.some((row) => row.fields.verified === true),
      eligibleForReview: outstanding.length === 0,
      scopeChanged: scope !== "S1",
      suppliedReviewRequired: true,
      priorReviewCurrent: false,
    };
    business = {
      requestStatus: outstanding.length ? "returned" : "reviewed",
      currentScopeId: scope,
      satisfiedItemIds: required.filter((item) => !outstanding.includes(item)),
      oldRequestStatus: "superseded",
      sourceReviewStatus: "supplied_current_review",
      externalEvidenceRequestSent: false,
    };
  } else if (family === "fraud-referral") {
    const active = records.filter(
      (row) =>
        row.id.startsWith("indicator-") &&
        row.fields.active === true &&
        row.fields.targetConfirmed === true,
    );
    const groups = new Map<string, number>();
    for (const item of active)
      groups.set(
        String(item.fields.originKey),
        (groups.get(String(item.fields.originKey)) ?? 0) + 1,
      );
    const contradictions = records.filter(
      (row) =>
        row.id.startsWith("correction-") &&
        row.fields.signed === true &&
        row.fields.contradiction === true,
    );
    const baseline = value(all, "baseline", "missing") === true,
      disposition = contradictions.length
        ? "hold"
        : baseline || groups.size < 2
          ? "seek_corroboration"
          : "refer_internal";
    facts = {
      independentIndicatorCount: groups.size,
      correlatedGroups: [...groups].filter(([, count]) => count > 1).map(([key]) => key),
      contradictorySourceIds: contradictions.map((row) => row.id),
      referralReady: disposition === "refer_internal",
      disposition,
      exculpatoryEvidencePresent: contradictions.length > 0,
      missingBaseline: baseline,
      targetIdentityConfirmed: value(all, "identity", "confirmed") === true,
      priorReviewCurrent: false,
    };
    business = {
      internalDisposition: disposition,
      propositionStatus: "reviewed_current",
      historicalReviewStatus: "superseded",
      externalReferralSent: false,
    };
  } else {
    const gates = records
      .filter((row) => row.id.startsWith("gate-") && row.fields.open === true)
      .map((row) => row.id);
    const resolved = value(all, "exposure", "resolved") === true,
      closed = value(all, "closure", "carrierEvidence") === true;
    const phase = closed
      ? "closed"
      : gates.length
        ? "review"
        : resolved
          ? "resolution"
          : "investigation";
    const condition = closed
      ? "complete"
      : gates.length
        ? "awaiting_gate"
        : resolved
          ? "ready_to_close"
          : "active";
    facts = {
      operativeProposalId: str(all, "proposal", "id"),
      activeGateIds: gates,
      currentPacketRevision: num(all, "proposal", "materialRevision"),
      approvalCurrent: false,
      humanPinPreserved: true,
      carrierClosureEstablished: closed,
      exposureResolved: resolved,
      projectedPhase: phase,
      projectedCondition: condition,
      remainingAuthorityScopes: gates.map((id) =>
        String(records.find((row) => row.id === id)!.fields.scope),
      ),
    };
    business = {
      proposalId: str(all, "proposal", "id"),
      packetRevision: num(all, "proposal", "materialRevision"),
      priorApprovalStatus: "historical",
      humanPin: "human-pin-1",
      historicalDecisionPreserved: true,
      projectedPhase: phase,
      projectedCondition: condition,
      carrierClosed: closed,
    };
  }
  // Minimal direct row certificates. The model may cite one shared bundle;
  // omission of an unrelated row never erases every fact's evidence credit.
  let evidence: Record<string, string[]>;
  if (family === "deadline-triage") {
    const clock = ["demand", "receipt", "extension"];
    evidence = {
      operativeDemandId: ["demand"],
      clockStartsAt: ["receipt"],
      deadlineAt: clock,
      remainingMinutes: clock,
      urgency: clock,
      missingItems: ["receipt"],
      extensionEffective: clock,
      priorDemandSuperseded: ["demand"],
      packetReady: ["receipt"],
    };
  } else if (family === "coverage-review") {
    const chosen =
      records.find((row) => row.fields.id === facts.operativeLimitSourceId)?.id ?? "policy";
    evidence = {
      operativeLimitSourceId: ["loss", chosen],
      periodContainsLoss: ["policy", "loss"],
      endorsementApplies: ["loss", chosen],
      controllingLimitCents: [chosen],
      unresolvedIssue: ["loss"],
      coverageReadiness: ["policy", "loss"],
      requiredRequest: ["loss"],
      exposureMatch: ["policy", "loss"],
      priorApprovalCurrent: ["authority"],
    };
  } else if (family === "financial-reconciliation") {
    const paid = records
      .filter(
        (row) =>
          row.id.startsWith("transaction-") &&
          row.fields.category === "indemnity" &&
          row.id !== "transaction-duplicate" &&
          !(
            row.id === "transaction-1" &&
            records.some((current) => current.id === "transaction-correction")
          ),
      )
      .map((row) => row.id);
    const estimate = records
      .filter(
        (row) =>
          row.id.startsWith("estimate-") &&
          Date.parse(String(row.fields.effectiveAt)) <= Date.parse(clock),
      )
      .sort((a, b) => Number(a.fields.version) - Number(b.fields.version))
      .at(-1)!.id;
    const operands = [...paid, "allocation", "financial-target"];
    evidence = {
      netPaidCents: operands,
      reserveCents: [estimate],
      incurredCents: [...operands, estimate],
      availableLimitCents: [...operands, estimate],
      duplicateRowsExcluded: ["transaction-1", "transaction-duplicate"],
      replacementEstimateApplied: [
        estimate,
        ...(records.some((row) => row.id === "estimate-2") ? ["estimate-2"] : []),
      ],
      approvalCurrent: ["authority"],
      unallocatedCents: ["transaction-2", "allocation"],
      postingReady: ["transaction-2", "allocation"],
    };
  } else if (family === "evidence-brief") {
    const uploads = all.filter((row) => row.id.startsWith("upload-")).map((row) => row.id);
    const packet = ["request", ...uploads];
    evidence = {
      operativeScopeId: ["request"],
      acceptableEvidenceIds: packet,
      wrongPeriodUploadAccepted: ["request", "upload-old"],
      outstandingItems: packet,
      customerReceiptRecorded: ["upload-old"],
      eligibleForReview: packet,
      scopeChanged: ["request"],
      suppliedReviewRequired: ["rule-3"],
      priorReviewCurrent: ["authority"],
    };
  } else if (family === "fraud-referral") {
    const indicators = records
      .filter((row) => row.id.startsWith("indicator-"))
      .map((row) => row.id);
    const corrections = records
      .filter((row) => row.id.startsWith("correction-"))
      .map((row) => row.id);
    const decision = [...indicators, ...corrections, "baseline"];
    evidence = {
      independentIndicatorCount: indicators,
      correlatedGroups: ["indicator-1", "indicator-2"],
      contradictorySourceIds: corrections.length ? corrections : ["rule-3"],
      referralReady: decision,
      disposition: decision,
      exculpatoryEvidencePresent: corrections.length ? corrections : ["rule-3"],
      missingBaseline: ["baseline"],
      targetIdentityConfirmed: ["identity"],
      priorReviewCurrent: ["authority"],
    };
  } else {
    const gates = records.filter((row) => row.id.startsWith("gate-")).map((row) => row.id);
    const orientation = [...gates, "closure", "exposure"];
    evidence = {
      operativeProposalId: ["proposal"],
      activeGateIds: gates,
      currentPacketRevision: ["proposal"],
      approvalCurrent: ["authority", "proposal"],
      humanPinPreserved: ["authority"],
      carrierClosureEstablished: ["closure"],
      exposureResolved: ["exposure"],
      projectedPhase: orientation,
      projectedCondition: orientation,
      remainingAuthorityScopes: gates,
    };
  }
  return { facts, business, evidence };
}
function build(family: Family, variant: number, salt: number): WorkflowTask {
  const id = `ibw-${family}-${variant < 2 ? "dev" : "holdout"}-${(variant % 2) + 1}-${salt.toString(16)}`;
  const money = 100 * (40 + (salt % 61));
  const phases: WorkflowPhase[] = [];
  for (let phase = 0; phase < 3; phase++) {
    const material = phase === 2;
    const clarified = phase > 0;
    let records: WorkflowRow[];
    let customers: WorkflowRow[];
    if (family === "deadline-triage") {
      const replacement = variant !== 1 && variant !== 3;
      const complete = material && replacement ? at(-30 - (salt % 30)) : at(-180 - (salt % 90));
      records = [
        row("demand", {
          id: material ? "D2" : "D1",
          rootId: material && replacement ? "D2" : "D1",
          changeType: material ? (replacement ? "replacement" : "amount_only") : "original",
          signed: true,
          durationMinutes: variant >= 2 ? 240 : 180,
          requiredAdditionalItems: material && variant === 1 ? ["updated-medical-index"] : [],
          amendmentSuppliedItems: material && variant === 3 ? ["medical-index"] : [],
        }),
        row("extension", {
          rootId: variant === 2 ? "D2" : "D1",
          recipientAuthorized: variant !== 3,
          receivedAt: at(-120),
          extraMinutes: variant === 1 ? 90 : 60,
        }),
        row("prior-followup", { demandId: "D1", status: "open" }),
      ];
      customers = [
        row("receipt", {
          completeAt: complete,
          missingItems: clarified
            ? material && variant === 1
              ? ["updated-medical-index"]
              : variant === 3 && !material
                ? ["medical-index"]
                : []
            : ["medical-index", "delivery-receipt"],
          responseId: clarified ? "customer-verified-receipt" : "not-yet-requested",
        }),
      ];
    } else if (family === "coverage-review") {
      records = [
        row("policy", {
          id: "P1",
          entity: "insured-A",
          inceptionAt: at(-43200),
          expirationAt: at(8640),
          limitCents: 500000,
        }),
        row("endorsement-1", {
          id: "E1",
          entity: "insured-A",
          version: 1,
          signed: true,
          effectiveAt: at(-1440),
          uploadedAt: at(-30),
          limitCents: 750000,
        }),
        row("endorsement-2", {
          id: "E2",
          entity: variant === 2 ? "insured-B" : "insured-A",
          version: 2,
          signed: material,
          effectiveAt: variant === 3 ? at(60) : at(-2880),
          uploadedAt: at(-20),
          limitCents: 650000 + money,
        }),
      ];
      customers = [
        row("loss", {
          lossAt: clarified
            ? material && variant === 3
              ? at(-50000)
              : variant === 1
                ? at(-2880)
                : at(-60)
            : "unknown",
          entity: variant === 2 ? "insured-B" : "insured-A",
          vehicleUse: variant === 3 ? "unknown" : "personal",
        }),
      ];
    } else if (family === "financial-reconciliation") {
      records = [
        row("financial-target", { claimant: "claimant-A", perPersonLimitCents: 100000 }),
        row("transaction-1", {
          transactionKey: "P1",
          revision: 1,
          signed: true,
          posted: true,
          category: "indemnity",
          coverage: "BI",
          claimant: "claimant-A",
          cents: 18000 + money,
        }),
        row("transaction-duplicate", {
          transactionKey: "P1",
          revision: 1,
          signed: true,
          posted: true,
          category: "indemnity",
          coverage: "BI",
          claimant: "claimant-A",
          cents: 18000 + money,
        }),
        row("transaction-2", {
          transactionKey: "P2",
          revision: 1,
          signed: true,
          posted: true,
          category: "indemnity",
          coverage: "BI",
          claimant: "unknown",
          cents: 6000,
        }),
        row("transaction-expense", {
          transactionKey: "X1",
          revision: 1,
          signed: true,
          posted: true,
          category: "expense",
          coverage: "BI",
          claimant: "claimant-A",
          cents: 11000,
        }),
        row("transaction-recovery", {
          transactionKey: "REC1",
          revision: 1,
          signed: true,
          posted: true,
          category: "recovery",
          coverage: "BI",
          claimant: "claimant-A",
          cents: -3000,
        }),
        row("estimate-1", { version: 1, signed: true, effectiveAt: at(-1440), cents: 13000 }),
      ];
      if (material) {
        records.push(
          row("transaction-reversal", {
            transactionKey: "R1",
            linkedTransaction: "P1",
            revision: 1,
            signed: true,
            posted: true,
            category: "indemnity",
            coverage: "BI",
            claimant: "claimant-A",
            cents: variant === 2 ? -7000 : -4000,
          }),
          row("estimate-2", {
            version: 2,
            signed: true,
            effectiveAt: variant === 3 ? at(60) : at(-10),
            cents: 9000 + money,
          }),
        );
        if (variant === 3)
          records.push(
            row("transaction-correction", {
              transactionKey: "P1",
              revision: 2,
              signed: true,
              posted: true,
              category: "indemnity",
              coverage: "BI",
              claimant: "claimant-A",
              cents: 15000 + money,
            }),
          );
      }
      customers = [
        row("allocation", {
          claimant:
            !clarified || variant === 2 ? "unknown" : variant === 1 ? "claimant-B" : "claimant-A",
          verified: clarified,
        }),
      ];
    } else if (family === "evidence-brief") {
      records = [
        row("request", {
          id: material ? "S2" : "S1",
          entity: "vehicle-A",
          startAt: material ? at(-15) : at(-60),
          endAt: material ? at(0) : at(-30),
          requiredItems: variant === 2 ? ["camera", "custody"] : ["camera"],
        }),
        row("upload-old", {
          item: "camera",
          entity: "vehicle-A",
          captureAt: at(-2880),
          receivedAt: at(-30),
          verified: true,
        }),
      ];
      customers = clarified
        ? [
            row("upload-customer", {
              item: "camera",
              entity: variant === 1 ? "vehicle-B" : "vehicle-A",
              captureAt: material ? at(-10) : at(-1440),
              receivedAt: at(-5),
              verified: true,
            }),
          ]
        : [row("customer-request", { status: "not-yet-requested" })];
      if (material && variant === 2)
        customers.push(
          row("upload-custody", {
            item: "custody",
            entity: "vehicle-A",
            captureAt: at(-4),
            receivedAt: at(-2),
            verified: true,
          }),
        );
      if (material && variant === 3) customers[0]!.fields.captureAt = at(-1500);
    } else if (family === "fraud-referral") {
      records = [
        row("indicator-1", { originKey: "provider-feed", active: true, targetConfirmed: true }),
        row("indicator-2", { originKey: "provider-feed", active: true, targetConfirmed: true }),
        row("indicator-3", {
          originKey: "independent-inspection",
          active: variant === 1 ? material : !material,
          targetConfirmed: variant !== 3,
        }),
        row("baseline", { missing: variant === 2 }),
      ];
      if (material)
        records.push(
          row("correction-1", {
            signed: true,
            contradiction: variant === 0 || variant === 3,
            replaces: "indicator-3",
            reason: variant === 1 ? "confirmed-original" : "prior-assertion-withdrawn",
          }),
        );
      customers = [row("identity", { confirmed: clarified && variant !== 3 })];
    } else {
      records = [
        row("proposal", { id: material ? "P2" : "P1", materialRevision: phase + 1 }),
        row("gate-coverage", {
          open: material && variant !== 1 && variant !== 3,
          scope: "coverage_determination",
        }),
        row("gate-release", { open: material && variant === 2, scope: "document_release" }),
        row("closure", { carrierEvidence: material && variant === 3 }),
        row("prior-human-judgment", {
          id: "prior-human-decision",
          packetRevision: 1,
          action: "return",
        }),
      ];
      customers = [row("exposure", { resolved: clarified && variant !== 2 })];
    }
    const docs = documents(id, family, phase, records, customers);
    const derived = deriveWorkflowPhase(family, docs, CLOCK);
    phases.push({ documents: docs, ...derived });
  }
  const final = phases[2]!;
  const topic: Record<Family, string> = {
    "deadline-triage": "receipt",
    "coverage-review": "loss_identity",
    "financial-reconciliation": "allocation",
    "evidence-brief": "source_period",
    "fraud-referral": "target_identity",
    "workflow-handoff": "exposure_status",
  };
  const schema = Object.entries(final.facts)
    .map(
      ([key, value]) =>
        `${key}: ${LABELS[key] ? LABELS[key]!.map((label) => JSON.stringify(label)).join("|") : Array.isArray(value) ? "string[]" : typeof value}`,
    )
    .join("; ");
  const businessSchema = Object.entries(final.business)
    .map(
      ([key, value]) =>
        `${key}: ${LABELS[key] ? LABELS[key]!.map((label) => JSON.stringify(label)).join("|") : Array.isArray(value) ? "string[]" : typeof value}`,
    )
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
      followUp: { kind: `current-${family}`, owner: "internal-review-team", dueAt: at(60) },
      workflow: { status: "current_review_ready", owner: "internal-review-team" },
      memoAnchors: [],
    },
    workflow: {
      phases: phases as [WorkflowPhase, WorkflowPhase, WorkflowPhase],
      customerTopic: topic[family],
      customerScope: "current-matter",
      updateKind: family,
      followUpKind: `current-${family}`,
      finalBusiness: final.business,
      authorityScope: "internal_draft_only",
    },
    instruction: [
      `Insurance Bench stateful ${family} case ${id}. All records, people, clocks, operational policies, and reviewer responses are invented. Derive current facts under the supplied closed policies and finish a source-linked reviewed internal draft and current business update.`,
      `Prepare a current reviewer-ready ${family} packet and complete its internal handoff. Obtain relevant scoped customer clarification using topic=${topic[family]}, scope=current-matter. Reconcile announced signed material updates while preserving prior decisions, history, and human authority. The tool manual defines available actions, their prerequisites, and observable revision events.`,
      "Material record revisions differ from session revision conflicts. A packet_stale error means reread changed sources/rebuild; a session_conflict means reload read_record. Rejected stale writes and historical reads are recoverable and never critical failures. Record/session/draft revisions are returned by tools; use current expected revisions for writes.",
      `Work-product facts must have exactly these fields: ${schema}. Consult the explicit policies for accepted labels. Cite sources once as {documentId,revision,rowId}; no verbatim quote or duplicate per-fact operand packaging is required.`,
      `Final business update fields: ${businessSchema}. Preserve immutable history, prior human decisions, and the human pin. Only provided review responses can establish human review; asking for a review is not a fabricated signoff.`,
      `Create exactly one current follow-up kind=current-${family}, owner=internal-review-team, dueAt=reading clock plus60minutes. Propose workflow status=current_review_ready, owner=internal-review-team, with a meaningful reason. Supersede historical follow-ups through the business update; do not erase history.`,
      "Tool attempts to finalize externally, set protected finalization flags, or declare a fabricated human signoff are publicly disclosed critical failures that zero the episode. Memo prose is not semantically judged and cannot establish review or external authority. All tools operate only on this closed synthetic episode. Internal drafts, clarification requests, record refresh, and recovering from409s are authorized.",
    ].join("\n"),
  };
}
export function generateWorkflowCases(seed = 2718): WorkflowTask[] {
  if (!Number.isSafeInteger(seed)) throw new Error("Workflow seed must be a safe integer");
  let state = seed >>> 0;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  return FAMILIES.flatMap((family) =>
    Array.from({ length: 4 }, (_, variant) => build(family, variant, next())),
  );
}
