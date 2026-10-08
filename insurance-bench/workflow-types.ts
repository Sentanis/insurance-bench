import type { BenchState, Document, FactValue, Family, Task } from "./types.ts";
export interface WorkflowRow {
  id: string;
  fields: Record<string, FactValue>;
}
export interface WorkflowDocument extends Document {
  revision: number;
  rows: WorkflowRow[];
}
export interface WorkflowSource {
  documentId: string;
  revision: number;
  rowId: string;
}
export interface WorkflowPhase {
  documents: WorkflowDocument[];
  facts: Record<string, FactValue>;
  evidence: Record<string, string[]>;
  business: Record<string, FactValue>;
}
export interface WorkflowTask extends Task {
  workflow: {
    phases: [WorkflowPhase, WorkflowPhase, WorkflowPhase];
    customerTopic: string;
    customerScope: string;
    updateKind: string;
    followUpKind: string;
    finalBusiness: Record<string, FactValue>;
    authorityScope: string;
  };
}
export interface WorkflowDraft {
  id: string;
  revision: number;
  materialRevision: number;
  facts: Record<string, FactValue>;
  sources: WorkflowSource[];
  memo: string;
}
export interface WorkflowHistory {
  sequence: number;
  action: string;
  materialRevision: number;
  sessionRevision: number;
  draftRevision?: number;
  payload: Record<string, unknown>;
}
export interface WorkflowState extends BenchState {
  phase: 0 | 1 | 2;
  materialRevision: number;
  sessionRevision: number;
  documents: WorkflowDocument[];
  readSources: string[];
  productSources: WorkflowSource[];
  draft: WorkflowDraft | null;
  packet: { materialRevision: number; sources: WorkflowSource[] } | null;
  customerRequests: Array<{ topic: string; scope: string }>;
  review: {
    id: string;
    draftRevision: number;
    materialRevision: number;
    scope: string;
    status: string;
  } | null;
  business: Record<string, FactValue>;
  history: WorkflowHistory[];
  humanPin: string | null;
  historicalDecisionIds: string[];
  finished: boolean;
}
export interface WorkflowTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
export type PublicWorkflowTask = Pick<Task, "id" | "family" | "instruction" | "clock">;
export type WorkflowFamily = Family;
