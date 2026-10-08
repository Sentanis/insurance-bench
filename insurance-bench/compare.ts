import type { Run } from "./runner.ts";
import type { Family } from "./types.ts";

export interface PairedComparison {
  axis?: "effort" | "tier" | "configured-system";
  baselineRunId: string;
  treatmentRunId: string;
  cases: number;
  attemptsPerCase: number;
  scoreDelta: number;
  completionDelta: number;
  componentDeltas?: Record<"facts" | "evidence" | "workflow" | "boundaries", number>;
  /** Actual booked-plan success, independent of asserted facts and citation certificates. */
  optimalPlanDelta?: number;
  currentStateDelta?: number;
  caseWins: number;
  caseTies: number;
  caseLosses: number;
  familyClusterBootstrap95: [number, number];
  families: { family: Family; scoreDelta: number }[];
  caveat: string;
}
const rounded = (n: number) => Math.round(n * 100) / 100;
/** Paired development diagnostic. Repetitions are averaged within case, never counted as new cases. */
export function compareRuns(
  baseline: Run,
  treatment: Run,
  axis: "effort" | "tier" | "configured-system" = "configured-system",
): PairedComparison {
  if (
    axis === "effort" &&
    (baseline.model.model !== treatment.model.model ||
      baseline.model.provider !== treatment.model.provider ||
      baseline.model.region !== treatment.model.region ||
      baseline.model.profile !== treatment.model.profile)
  )
    throw new Error("Effort contrast requires the same exact model and provider path");
  if (
    axis === "tier" &&
    (baseline.model.provider !== treatment.model.provider ||
      baseline.model.reasoningEffort !== treatment.model.reasoningEffort)
  )
    throw new Error("Tier contrast requires the same provider and declared effort policy");
  if (!baseline.completeCoverage || !treatment.completeCoverage)
    throw new Error("Complete provider coverage required for a matched comparison");
  if (
    [baseline, treatment].some((run) =>
      run.episodes.some((episode) =>
        episode.trace.some((turn) =>
          ["max_output_tokens", "max_tokens", "length"].includes(
            (turn.finishReason ?? "").toLowerCase(),
          ),
        ),
      ),
    )
  )
    throw new Error(
      "Output truncation confounds this comparison; preserve runs and rerun all matched conditions at a preregistered common limit",
    );
  if (
    baseline.version !== treatment.version ||
    baseline.datasetHash !== treatment.datasetHash ||
    baseline.harnessHash !== treatment.harnessHash ||
    baseline.variant !== treatment.variant ||
    baseline.repeat !== treatment.repeat ||
    JSON.stringify(baseline.taskIds) !== JSON.stringify(treatment.taskIds)
  )
    throw new Error("Matched dataset, harness, variant, task order and repetitions required");
  const pairs = baseline.taskIds.map((taskId) => {
    const a = baseline.episodes.filter((e) => e.taskId === taskId);
    const b = treatment.episodes.filter((e) => e.taskId === taskId);
    if (
      a.length !== baseline.repeat ||
      b.length !== baseline.repeat ||
      [...a, ...b].some((e) => !e.score)
    )
      throw new Error("Missing paired scored attempts");
    const mean = (episodes: typeof a, metric: "score" | "allPass") =>
      episodes.reduce(
        (sum, e) => sum + (metric === "score" ? e.score!.score : Number(e.score!.allPass) * 100),
        0,
      ) / episodes.length;
    return {
      family: a[0]!.score!.family,
      scoreDelta: mean(b, "score") - mean(a, "score"),
      completionDelta: mean(b, "allPass") - mean(a, "allPass"),
      componentDeltas: Object.fromEntries(["facts", "evidence", "workflow", "boundaries"].map((component) => {
        const key = component as keyof NonNullable<PairedComparison["componentDeltas"]>;
        const componentMean = (episodes: typeof a) => episodes.reduce((sum, episode) => sum + episode.score!.components[key], 0) / episodes.length;
        return [component, componentMean(b) - componentMean(a)];
      })) as NonNullable<PairedComparison["componentDeltas"]>,
      outcomeDelta: (criterion: string) => {
        if (![...a, ...b].every((episode) => episode.score!.criteria.some((item) => item.id === criterion))) return undefined;
        const outcomeMean = (episodes: typeof a) => episodes.reduce((sum, episode) => sum + Number(episode.score!.criteria.find((item) => item.id === criterion)!.passed) * 100, 0) / episodes.length;
        return outcomeMean(b) - outcomeMean(a);
      },
    };
  });
  const families = [...new Set(pairs.map((p) => p.family))].map((family) => {
    const group = pairs.filter((p) => p.family === family);
    return {
      family,
      scoreDelta: group.reduce((sum, p) => sum + p.scoreDelta, 0) / group.length,
      completionDelta: group.reduce((sum, p) => sum + p.completionDelta, 0) / group.length,
    };
  });
  const meanOutcomeDelta = (criterion: string) => {
    if (pairs.some((pair) => pair.outcomeDelta(criterion) === undefined)) return undefined;
    return rounded(families.reduce((sum, family) => {
      const group = pairs.filter((pair) => pair.family === family.family);
      return sum + group.reduce((subtotal, pair) => subtotal + pair.outcomeDelta(criterion)!, 0) / group.length;
    }, 0) / families.length);
  };
  if (families.length < 2)
    throw new Error("At least two families required for clustered uncertainty");
  let seed = 1729;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const samples = Array.from(
    { length: 10000 },
    () =>
      Array.from(
        { length: families.length },
        () => families[Math.floor(random() * families.length)]!.scoreDelta,
      ).reduce((sum, n) => sum + n, 0) / families.length,
  ).sort((a, b) => a - b);
  return {
    axis,
    baselineRunId: baseline.runId,
    treatmentRunId: treatment.runId,
    cases: pairs.length,
    attemptsPerCase: baseline.repeat,
    scoreDelta: rounded(families.reduce((sum, p) => sum + p.scoreDelta, 0) / families.length),
    completionDelta: rounded(
      families.reduce((sum, p) => sum + p.completionDelta, 0) / families.length,
    ),
    componentDeltas: Object.fromEntries(["facts", "evidence", "workflow", "boundaries"].map((component) => {
      const key = component as keyof NonNullable<PairedComparison["componentDeltas"]>;
      return [component, rounded(families.reduce((sum, family) => {
        const group = pairs.filter((pair) => pair.family === family.family);
        return sum + group.reduce((subtotal, pair) => subtotal + pair.componentDeltas[key], 0) / group.length;
      }, 0) / families.length)];
    })) as PairedComparison["componentDeltas"],
    optimalPlanDelta: meanOutcomeDelta("workflow:priority-optimal"),
    currentStateDelta: meanOutcomeDelta("workflow:current-state"),
    caseWins: pairs.filter((p) => p.scoreDelta > 0).length,
    caseTies: pairs.filter((p) => p.scoreDelta === 0).length,
    caseLosses: pairs.filter((p) => p.scoreDelta < 0).length,
    familyClusterBootstrap95: [rounded(samples[249]!), rounded(samples[9749]!)],
    families: families.map(({ family, scoreDelta }) => ({
      family,
      scoreDelta: rounded(scoreDelta),
    })),
    caveat:
      "Descriptive paired difference (treatment minus baseline), 10000 seeded bootstrap samples of family clusters. Repeated attempts are averaged within case. The evaluated templated families are a small correlated sample; the interval does not establish population capability. Configured-system comparisons can vary model and effort together and cannot establish a pure effort effect. Clean contrasts exclude output truncation.",
  };
}
