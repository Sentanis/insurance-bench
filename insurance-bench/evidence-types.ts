import type { BenchState, Document, FactValue, Family, Task } from "./types.ts";
export type EvidenceLabel = "supported" | "refuted" | "unresolved";
export interface EvidenceSection {
  id: string;
  page: number;
  text: string;
}
export interface NarrativeDocument extends Document {
  version: number;
  sections: EvidenceSection[];
  entityId?: string;
  periodStart?: string;
  periodEnd?: string;
}
export interface EvidenceRef {
  documentId: string;
  version: number;
  sectionId: string;
}
export interface EvidenceFinding {
  status: EvidenceLabel;
  sources: EvidenceRef[];
}
export interface Proposition {
  id: string;
  statement: string;
}
export interface EvidenceAnswer {
  labels: EvidenceLabel[];
  certificates: EvidenceRef[][];
}
export interface EvidenceTask extends Task {
  propositions: Proposition[];
  evidence: {
    initialDocuments: NarrativeDocument[];
    wrongResponse: NarrativeDocument;
    response: NarrativeDocument;
    correction: NarrativeDocument;
    goldBeforeCorrection: Record<string, EvidenceAnswer>;
    gold: Record<string, EvidenceAnswer>;
    requestTargets: string[];
    entityId: string;
    periodStart: string;
    periodEnd: string;
    sourceItem: string;
    representation: "original" | "normalized-diagnostic";
    correspondenceId: string;
  };
}
export interface EvidenceRequest {
  id: string;
  revision: number;
  propositionIds: string[];
  entityId: string;
  periodStart: string;
  periodEnd: string;
  item: string;
  approvalRevision: number | null;
  dispatchCount: number;
  receipts: string[];
  reviewedReceipt: string | null;
}
export interface EvidencePacket {
  id: string;
  revision: number;
  generation: number;
  findings: Record<string, EvidenceFinding>;
  memo: string;
}
export interface EvidenceReview {
  id: string;
  packetRevision: number;
  generation: number;
  status: "changes_requested" | "reviewed";
  scope: "internal_packet_only";
}
export interface EvidenceHistory {
  sequence: number;
  action: string;
  version: number;
  generation: number;
  payload: Record<string, unknown>;
}
export interface EvidenceState extends BenchState {
  version: number;
  generation: number;
  documents: NarrativeDocument[];
  readRefs: string[];
  request: EvidenceRequest | null;
  packet: EvidencePacket | null;
  review: EvidenceReview | null;
  business: Record<string, FactValue>;
  history: EvidenceHistory[];
  priorDecisionIds: string[];
  finished: boolean;
}
export type EvidenceFamily = Extract<
  Family,
  "coverage-review" | "evidence-brief" | "fraud-referral"
>;
