export interface ReviewBooking { jobId: string; reviewer: string; startSlot: number }
export interface ReviewJob {
  id: string;
  duration: number;
  requiredSkill: string;
  cost: number;
  value: number;
  releaseSlot: number;
  deadlineSlot: number;
  dependencies: string[];
  approved: boolean;
  mandatory: boolean;
  allowedStarts?: number[];
}
export interface Reviewer { id: string; skills: string[]; availableSlots: number[] }
export interface PlanningScenario {
  slots: number;
  reviewers: Reviewer[];
  jobs: ReviewJob[];
  budget: number;
  /** Hidden verified target. Never expose via tools or public task. */
  optimalValue: number;
}
export interface PlanEvaluation {
  feasible: boolean;
  mandatoryComplete: boolean;
  optimal: boolean;
  value: number;
  cost: number;
  missingMandatory: string[];
  violations: string[];
}
