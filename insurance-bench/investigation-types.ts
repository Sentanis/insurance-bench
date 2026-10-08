import type { BenchState, Document, FactValue, Family, Task } from "./types.ts";

export type InvestigationFamily = Extract<
  Family,
  "coverage-review" | "evidence-brief" | "fraud-referral"
>;
export type InvestigationSubject = "asset" | "actor" | "site";
export type InvestigationTruth = "true" | "false" | "unknown";
export type InvestigationStatus = "applicable" | "not-applicable" | "unresolved";
export interface InvestigationRef {
  documentId: string;
  version: number;
  rowId: string;
}
interface SourceRow {
  id: string;
  signed: boolean;
  signerId: string;
  supersedes: string[];
}
/** Source intervals are inclusive from, exclusive to; times are UTC instants. */
export interface AuthorityRow extends SourceRow {
  kind: "authority";
  personId: string;
  role: string;
  subjectId: string;
  from: string;
  to: string;
}
export interface AliasRow extends SourceRow {
  kind: "alias";
  subject: InvestigationSubject;
  label: string;
  /** null is an explicitly unavailable binding, never a derived negative. */
  entityId: string | null;
  from: string;
  to: string;
}
export interface EventRow extends SourceRow {
  kind: "event";
  eventId: string;
  at: string;
  assetLabel: string;
  actorLabel: string;
  siteLabel: string;
  activity: string;
}
export interface ObservationRow extends SourceRow {
  kind: "observation";
  subjectId: string;
  predicate: string;
  /** null denotes an explicitly unavailable source input. */
  value: string | number | boolean | null;
  from: string;
  to: string;
  firstHand: boolean;
  originId: string;
}
export type InvestigationCondition =
  | {
      kind: "test";
      subject: InvestigationSubject;
      predicate: string;
      equals: string | number | boolean;
      requiredRole: string;
    }
  | { kind: "all" | "any"; conditions: InvestigationCondition[] }
  | { kind: "not"; condition: InvestigationCondition };
export interface InvestigationClause {
  code: string;
  description: string;
  condition: InvestigationCondition;
  requestSubject: InvestigationSubject;
  material: string;
  custodianPredicate: string;
  custodianRole: string;
  lookbackHours: number;
  forwardHours: number;
}
export interface PolicyRow extends SourceRow {
  kind: "policy";
  packId: string;
  revision: number;
  activity: string;
  effectiveFrom: string;
  effectiveTo: string;
  clauses: InvestigationClause[];
}
export interface ApprovalRow extends SourceRow {
  kind: "approval";
  approvalId: string;
  obligationId: string;
  dependencyRowIds: string[];
  scope: "internal-source-request";
}
export interface InventoryRow extends SourceRow {
  kind: "inventory";
  covers: "authority" | "aliases" | "observations" | "policies";
  complete: true;
  description: string;
}
export type InvestigationRow =
  AuthorityRow | AliasRow | EventRow | ObservationRow | PolicyRow | ApprovalRow | InventoryRow;
export interface InvestigationDocument extends Document {
  version: number;
  rows: InvestigationRow[];
  /** Narrative explains provenance, not resolved identities, applicability, or answer flags. */
  narrative: string;
}
export interface InvestigationRequest {
  obligationId: string;
  eventId: string;
  subjectId: string;
  material: string;
  custodianId: string;
  periodStart: string;
  periodEnd: string;
}
export interface InvestigationDecision {
  obligationId: string;
  eventId: string;
  clauseId: string;
  status: InvestigationStatus;
  subjectId: string | null;
  request: InvestigationRequest | null;
}
export interface InvestigationSnapshot {
  documents: InvestigationDocument[];
}
export interface InvestigationDerivation {
  facts: Record<string, FactValue>;
  decisions: InvestigationDecision[];
  requests: InvestigationRequest[];
  retainedApprovalIds: string[];
  invalidatedApprovalIds: string[];
  certificates: Record<string, InvestigationRef[][]>;
}
export interface InvestigationTask extends Task {
  investigation: {
    mechanic: "fleet-assignment" | "premises-chronology" | "multi-exposure-review";
    initialDocuments: InvestigationDocument[];
    sourceRequest: InvestigationRequest;
    requestedResponse: InvestigationDocument;
    updates: [InvestigationDocument, InvestigationDocument];
    /** Public field definitions; no values or resolved graph. */
    factDefinitions: Record<string, string>;
    /** Kept simulator configuration only. Does not contain a final label vector. */
    humanPinId: string;
    reviewOwner: string;
    correspondenceId: string;
  };
}
export interface InvestigationHistory {
  sequence: number;
  action: string;
  version: number;
  generation: number;
  payload: Record<string, unknown>;
}
export interface InvestigationState extends BenchState {
  version: number;
  generation: number;
  documents: InvestigationDocument[];
  readRefs: string[];
  history: InvestigationHistory[];
  sourceRequest: null | {
    id: string;
    revision: number;
    scope: InvestigationRequest;
    approvalRevision: number | null;
    dispatched: boolean;
    receiptId: string | null;
    reviewedReceiptId: string | null;
  };
  requests: InvestigationRequest[];
  packet: null | {
    id: string;
    revision: number;
    generation: number;
    facts: Record<string, FactValue>;
    evidence: Record<string, InvestigationRef[]>;
    memo: string;
  };
  review: null | {
    id: string;
    packetRevision: number;
    generation: number;
    status: "changes_requested" | "reviewed";
    scope: "internal_packet_only";
  };
  business: Record<string, unknown>;
  humanPinId: string;
  finished: boolean;
}
