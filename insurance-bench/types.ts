import type { PlanningScenario, ReviewBooking } from "./planning-types.ts";
export const FAMILIES = [
  "deadline-triage",
  "coverage-review",
  "financial-reconciliation",
  "evidence-brief",
  "fraud-referral",
  "workflow-handoff",
] as const;
export type Family = (typeof FAMILIES)[number];
export type Split = "dev" | "holdout";
export type FactValue = string | number | boolean | string[];
export interface Document {
  id: string;
  title: string;
  text: string;
}
export interface Citation {
  factKey: string;
  documentId: string;
  quote: string;
}
export interface WorkProduct {
  facts: Record<string, FactValue>;
  citations: Citation[];
  memo: string;
}
export interface FollowUp {
  kind: string;
  owner: string;
  dueAt: string;
}
export interface WorkflowProposal {
  status: string;
  owner: string;
  reason: string;
}
export interface ExternalActionAttempt {
  action: string;
  payload?: unknown;
}
export interface BenchState {
  reviewBookings?: ReviewBooking[];
  products: WorkProduct[];
  followUps: FollowUp[];
  workflowProposal: WorkflowProposal | null;
  externalActionAttempts: ExternalActionAttempt[];
  readDocumentIds: string[];
}
export interface ExpectedFact {
  value: FactValue;
  /** rowContains binds fields to a single quoted CSV record beginning with anchor. */
  evidence: { documentId: string; anchor: string; rowContains?: string[] }[];
  /** Optional sufficient proof plans. Legacy cases retain their existing evidence contract. */
  evidencePlans?: Array<{
    sources: { documentId: string; anchor: string; rowContains?: string[] }[];
    facts?: string[];
    /** An optimization certificate requires a verified optimal reserved portfolio. */
    optimalSchedule?: boolean;
  }>;
  critical?: boolean;
}
export interface Rubric {
  facts: Record<string, ExpectedFact>;
  followUp: FollowUp;
  workflow: { status: string; owner: string };
  memoAnchors: string[];
}
export interface Task {
  /** Closed simulator configuration; never exposed by publicTask or document tools. */
  planning?: PlanningScenario;
  id: string;
  family: Family;
  split: Split;
  instruction: string;
  clock: string;
  documents: Document[];
  /** Never expose through a tool, prompt, or model-facing task serialization. */
  rubric: Rubric;
}
export interface Criterion {
  id: string;
  component: "facts" | "evidence" | "workflow" | "boundaries";
  passed: boolean;
  detail: string;
}
export interface TaskScore {
  taskId: string;
  family: Family;
  split: Split;
  score: number;
  components: Record<Criterion["component"], number>;
  allPass: boolean;
  criticalFailure: boolean;
  criteria: Criterion[];
}
export interface ScoreSummary {
  score: number;
  completionRate: number;
  criticalFailureRate: number;
  taskCount: number;
  familyScores: Partial<Record<Family, number>>;
  components: Record<Criterion["component"], number>;
}
export function emptyState(): BenchState {
  return {
    products: [],
    followUps: [],
    workflowProposal: null,
    externalActionAttempts: [],
    readDocumentIds: [],
  };
}
