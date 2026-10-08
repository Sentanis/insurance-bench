import type { Run } from "./runner.ts";
import type { PairedComparison } from "./compare.ts";
const escape = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
export interface ReportContext {
  findings?: string[];
  accessGaps?: string[];
  primaryRunIds?: string[];
  generation?: string;
  invalidRunIds?: string[];
  comparisons?: PairedComparison[];
  conditionWarnings?: Record<string, string>;
}
export function buildReport(runs: Run[], context: ReportContext = {}): string {
  const investigationGeneration = (run: Run) =>
    run.version.startsWith("insurance-bench-investigation-v0.9") ||
    run.version.startsWith("insurance-bench-interaction-v0.10");
  const allocationGeneration = (run: Run) => run.version.startsWith("insurance-bench-allocation-interaction-v0.11") ||
    run.version.startsWith("insurance-bench-dependency-allocation-v0.12");
  const taskSuccessGeneration = (run: Run) =>
    run.version.startsWith("insurance-bench-evidence-v0.8") ||
    investigationGeneration(run) || allocationGeneration(run);
  const outputLimited = (run: Run) => run.episodes.some(episode =>
    (episode as typeof episode & { truncatedOutput?: boolean }).truncatedOutput ||
    episode.trace.some(turn => /(?:max[_ -]?tokens|max[_ -]?output[_ -]?tokens|length|incomplete)/i.test(turn.finishReason ?? "")));
  const headlineScore = (run: Run): string => {
    if (context.invalidRunIds?.includes(run.runId)) return "Superseded";
    if (!run.completeCoverage) return "Unavailable";
    if (taskSuccessGeneration(run)) {
      const evidence = run as Run & { headlineMetric?: string; benchmarkScore?: number | null };
      if (evidence.headlineMetric !== "macro-task-success" || typeof evidence.benchmarkScore !== "number"
        || !Number.isFinite(evidence.benchmarkScore) || evidence.benchmarkScore < 0 || evidence.benchmarkScore > 100)
        return "Unavailable<small>Missing task-success metric</small>";
      return `${evidence.benchmarkScore.toFixed(1)}<small>Task success /100</small><small>Diagnostic partial credit ${run.summary.score.toFixed(1)} /100</small>`;
    }
    return run.summary.score.toFixed(1);
  };
  const observations = context.findings?.length
    ? `<section><h2>What the experiments showed</h2><ul>${context.findings.map((s) => `<li>${escape(s)}</li>`).join("")}</ul></section>`
    : "";
  const access = context.accessGaps?.length
    ? `<section><h2>Access and evaluation gaps</h2><ul>${context.accessGaps.map((s) => `<li>${escape(s)}</li>`).join("")}</ul></section>`
    : "";
  const optimalPlan = (run: Run): string => {
    const planning = /portfolio|frontier/.test(run.version);
    const investigation = investigationGeneration(run);
    const workflow = /workflows|coupled|evidence/.test(run.version) || investigation || allocationGeneration(run);
    if (!planning && !workflow) return "—";
    if (context.invalidRunIds?.includes(run.runId)) return "Superseded";
    if (!run.completeCoverage || !run.episodes.length) return "Unavailable";
    const outcomeCriterion = investigation ? "workflow:handoff" : workflow ? "workflow:current-state" : "workflow:priority-optimal";
    const passed = run.episodes.filter((episode) => episode.score?.criteria.some((criterion) => criterion.id === outcomeCriterion && criterion.passed)).length;
    return (100 * passed / run.episodes.length).toFixed(1) + "%<small>" + (investigation ? "Current structural investigation handoff" : (run.version.includes("coupled") || allocationGeneration(run)) ? "Optimal current proposal plan" : run.version.includes("evidence") ? "Current internally reviewed handoff" : workflow ? "Current business state" : "Optimal reserved plan") + "</small>";
  };
  const renderRows = (selected: Run[]) =>
    selected
      .map(
        (run) =>
          `<tr><td>${escape(run.model.model)}<small>${escape(run.model.provider)}${run.model.reasoningEffort ? " · effort " + escape(run.model.reasoningEffort) : ""}</small></td><td>${escape(run.variant)}<small>${escape(run.version)}</small><small>${escape([...new Set(run.episodes.map(episode => episode.split))].sort().join(" + ") || "unknown")}</small><small>${escape(run.repeat)} attempt(s) per case</small>${(investigationGeneration(run) || allocationGeneration(run)) ? "<small>Action transport: " + escape((run as Run & { responseFormat?: string }).responseFormat ?? "text with strict JSON parser") + "</small>" : ""}${context.conditionWarnings?.[run.runId] ? "<small><b>Condition caveat:</b> " + escape(context.conditionWarnings[run.runId]) + "</small>" : ""}<small>${run.limits ? escape(run.limits.maxOutputTokens) + " output tokens / call" : "4096 output tokens / call"}${outputLimited(run) ? " · output truncation observed" : ""}</small></td><td class="score">${headlineScore(run)}</td><td>${context.invalidRunIds?.includes(run.runId) ? "Superseded" : run.completeCoverage ? run.summary.completionRate.toFixed(1) + "%" : "Unavailable"}</td><td>${context.invalidRunIds?.includes(run.runId) ? "Superseded" : run.completeCoverage ? run.summary.criticalFailureRate.toFixed(1) + "%" : "Unavailable"}</td><td>${optimalPlan(run)}</td><td>${run.summary.taskCount}/${run.taskIds.length * run.repeat}</td><td>$${run.estimatedCostUsd.toFixed(3)}</td></tr>`,
      )
      .join("");
  const primary = context.primaryRunIds
    ? [...new Set(context.primaryRunIds)].flatMap((id) => runs.filter((run) => run.runId === id))
    : runs;
  const primaryGroups = new Map<string, Run[]>();
  for (const run of primary) {
    const key = JSON.stringify([run.version, run.datasetHash, run.harnessHash, run.variant, run.taskIds, run.repeat,
      [...new Set(run.episodes.map(episode => episode.split))].sort()]);
    primaryGroups.set(key, [...(primaryGroups.get(key) ?? []), run]);
  }
  const primaryTables = [...primaryGroups.values()].map(group => {
    const first = group[0]!;
    return `<section><h2>${escape(first.version)}</h2><p>${escape([...new Set(first.episodes.map(episode => episode.split))].sort().join(" + ") || "unknown")} panel · Dataset ${escape(first.datasetHash.slice(0, 16))} · Harness ${escape(first.harnessHash.slice(0, 16))}. Scores in different panels use different conditions and are not a shared ranking. Sharing a panel alone does not establish a clean comparison; output truncation, incomplete coverage and other condition caveats remain visible.</p><div class="table-wrap"><table><thead><tr><th>Model</th><th>Experiment</th><th>Score / 100</th><th>All-pass</th><th>Critical failure</th><th>Actual outcome</th><th>Scored tasks</th><th>Cost</th></tr></thead><tbody>${renderRows(group)}</tbody></table></div></section>`;
  }).join("") || (runs.length
    ? '<p>No selected primary runs are available; recorded runs remain in the archive.</p>'
    : '<p>No real provider runs recorded yet.</p>');
  const missingPrimary = context.primaryRunIds?.filter(id => !runs.some(run => run.runId === id)) ?? [];
  const selectionWarning = missingPrimary.length
    ? `<p><b>Missing selected primary runs:</b> ${missingPrimary.map(escape).join(", ")}. No result is inferred for them.</p>`
    : "";
  const historical = runs.filter((run) => !primary.includes(run));
  const archive = historical.length
    ? `<details><summary>Development and historical runs (${historical.length})</summary><p>These rows preserve calibration, treatment comparisons and interrupted coverage. They are not a matched holdout leaderboard.</p><div class="table-wrap"><table><thead><tr><th>Model</th><th>Experiment</th><th>Score / 100</th><th>All-pass</th><th>Critical failure</th><th>Actual outcome</th><th>Scored tasks</th><th>Cost</th></tr></thead><tbody>${renderRows(historical)}</tbody></table></div></details>`
    : "";
  const details = runs
    .map(
      (run) =>
        `<details><summary>${escape(run.model.model)}${run.model.reasoningEffort ? " · effort " + escape(run.model.reasoningEffort) : ""} · ${escape(run.variant)} · ${escape(run.episodes[0]?.split ?? "unknown")} · ${escape(run.startedAt)}</summary>${context.invalidRunIds?.includes(run.runId) ? "<p><b>Superseded measurement candidate:</b> raw values are retained below for audit; these results cannot establish difficulty or capability differences.</p>" : ""}<p>Dataset ${escape(run.datasetHash.slice(0, 16))} · Harness ${escape(run.harnessHash.slice(0, 16))} · ${run.repeat} repetition(s)</p><p>Scored subset components: facts ${run.summary.components.facts.toFixed(1)}% · evidence ${run.summary.components.evidence.toFixed(1)}% · workflow ${run.summary.components.workflow.toFixed(1)}% · boundaries ${run.summary.components.boundaries.toFixed(1)}%. Coverage ${run.summary.taskCount}/${run.taskIds.length * run.repeat}.</p>${taskSuccessGeneration(run) ? "<p>Diagnostic weighted family scores below; completed-task success is the separate headline.</p>" : ""}<div class="families">${Object.entries(
          run.summary.familyScores,
        )
          .map(
            ([family, score]) =>
              `<div>${escape(family)}<strong>${score?.toFixed(1)}</strong><div class="bar"><i style="width:${Math.max(0, Math.min(100, score ?? 0))}%"></i></div></div>`,
          )
          .join("")}</div><ul>${run.episodes
          .map(
            (e) =>
              `<li><b>${escape(e.taskId)}</b> · ${escape(e.status)} · ${e.score ? `${e.score.score.toFixed(1)} / 100` : escape(e.error ?? "")}${
                e.score
                  ? `<small>${
                      e.score.criteria
                        .filter((c) => !c.passed)
                        .map((c) => escape(c.id))
                        .join(", ") || "All rubric criteria passed"
                    }</small>`
                  : ""
              }</li>`,
          )
          .join("")}</ul></details>`,
    )
    .join("");
  const rejectedComparisons: string[] = [];
  const admittedComparisons = (context.comparisons ?? []).filter(comparison => {
    const inputs = [comparison.baselineRunId, comparison.treatmentRunId].map(id => runs.filter(run => run.runId === id));
    const reject = (reason: string) => {
      rejectedComparisons.push(`${comparison.treatmentRunId} versus ${comparison.baselineRunId}: ${reason}`);
      return false;
    };
    if (inputs.some(matches => matches.length !== 1)) return reject("missing or ambiguous native input");
    const baseline = inputs[0]![0]!;
    const treatment = inputs[1]![0]!;
    if ([baseline, treatment].some(run => context.invalidRunIds?.includes(run.runId))) return reject("superseded input");
    if ([baseline, treatment].some(run => !run.completeCoverage)) return reject("incomplete provider coverage");
    if ([baseline, treatment].some(outputLimited)) return reject("cumulative output truncation");
    const conditions = (run: Run) => {
      const native = run as Run & { sourceFingerprint?: string; responseFormat?: string };
      return JSON.stringify([run.version, run.datasetHash, run.harnessHash, run.variant,
        run.taskIds, run.repeat, native.sourceFingerprint ?? null, native.responseFormat ?? null,
        run.limits?.maxTurns ?? null, run.limits?.maxOutputTokens ?? null]);
    };
    if (conditions(baseline) !== conditions(treatment)) return reject("unmatched frozen conditions");
    if (comparison.axis === "effort" && ["provider", "model", "profile", "region"].some(key =>
      baseline.model[key as keyof typeof baseline.model] !== treatment.model[key as keyof typeof treatment.model]))
      return reject("effort contrast changes model or provider path");
    if (comparison.axis === "tier" && (baseline.model.provider !== treatment.model.provider ||
      baseline.model.reasoningEffort !== treatment.model.reasoningEffort)) return reject("tier contrast changes provider or effort");
    if (comparison.cases !== baseline.taskIds.length || comparison.attemptsPerCase !== baseline.repeat ||
      [baseline, treatment].some(run => run.episodes.length !== run.taskIds.length * run.repeat))
      return reject("comparison coverage does not match native attempts");
    if (![comparison.caseWins, comparison.caseTies, comparison.caseLosses].every(n => Number.isInteger(n) && n >= 0) ||
      comparison.caseWins + comparison.caseTies + comparison.caseLosses !== comparison.cases)
      return reject("comparison case counts do not match coverage");
    for (const taskId of baseline.taskIds) {
      const a = baseline.episodes.filter(episode => episode.taskId === taskId);
      const b = treatment.episodes.filter(episode => episode.taskId === taskId);
      if (a.length !== baseline.repeat || b.length !== baseline.repeat || [...a, ...b].some(episode => !episode.score) ||
        [...a, ...b].some(episode => episode.family !== a[0]!.family || episode.split !== a[0]!.split))
        return reject("missing scored attempts or unmatched family/split");
    }
    return true;
  });
  const comparisonWarnings = rejectedComparisons.length
    ? `<section><h2>Unavailable clean comparisons</h2><ul>${rejectedComparisons.map(reason => `<li>${escape(reason)}</li>`).join("")}</ul><p>Recorded native scores remain visible; no interval or paired capability claim is inferred for these contrasts.</p></section>`
    : "";
  const comparisons = admittedComparisons.length
    ? `<section><h2>Does the benchmark separate capability?</h2><p>Paired weighted partial-credit differences below are treatment minus baseline; All-pass differences count existing criterion passes; the completed-task headline additionally requires a completed episode without a critical failure. Repeated attempts are averaged within each case; uncertainty resamples entire workflow families. Small, correlated synthetic panels cannot establish a stable ranking.</p><div class="table-wrap"><table><thead><tr><th>Comparison</th><th>Partial-credit difference</th><th>95% family bootstrap</th><th>All-pass difference</th><th>Substantive differences</th><th>Case wins / ties / losses</th></tr></thead><tbody>${admittedComparisons
        .map((c) => {
          const label = (id: string) => {
            const run = runs.find((r) => r.runId === id);
            return run
              ? run.model.model +
                  (run.model.reasoningEffort ? " · " + run.model.reasoningEffort : "")
              : id;
          };
          return `<tr><td>${escape(label(c.treatmentRunId))}<small>versus ${escape(label(c.baselineRunId))}</small><small>${escape(c.axis ?? "configured-system")} contrast</small></td><td>${c.scoreDelta.toFixed(2)} pp</td><td>${c.familyClusterBootstrap95.map((n) => n.toFixed(2)).join(" to ")} pp</td><td>${c.completionDelta.toFixed(2)} pp</td><td>${c.componentDeltas ? `Facts ${c.componentDeltas.facts.toFixed(2)} pp<small>Workflow ${c.componentDeltas.workflow.toFixed(2)} pp · evidence ${c.componentDeltas.evidence.toFixed(2)} pp</small>` : "—"}${c.optimalPlanDelta !== undefined ? `<small>Optimal plan ${c.optimalPlanDelta.toFixed(2)} pp</small>` : ""}${c.currentStateDelta !== undefined ? `<small>Current state ${c.currentStateDelta.toFixed(2)} pp</small>` : ""}</td><td>${c.caseWins} / ${c.caseTies} / ${c.caseLosses}<small>${c.cases} cases × ${c.attemptsPerCase} attempts</small></td></tr>`;
        })
        .join("")}</tbody></table></div></section>`
    : "";
  const generation =
    context.generation ??
    ([...new Set(primary.map((run) => run.version))].join(" / ") || "No recorded generation");
  const familyCount = new Set(primary.flatMap(run => run.episodes.map(episode => episode.family))).size || 6;
  const coupled = primary.some(run => run.version.includes("coupled") || allocationGeneration(run));
  const semantic = primary.some(run => run.version.includes("evidence"));
  const investigation = primary.some(investigationGeneration);
  const total = runs.reduce((sum, r) => sum + r.estimatedCostUsd, 0);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Insurance Bench — Research Pilot</title><style>
  :root{font-family:system-ui,sans-serif;color:#16292a;background:#f4f2eb}*{box-sizing:border-box}body{margin:0}main{max-width:1180px;margin:auto;padding:50px 28px}header{border-top:5px solid #173e3b;padding-top:25px}.eyebrow{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#516663}h1{font-family:Georgia,serif;font-size:clamp(48px,7vw,84px);font-weight:400;letter-spacing:-3px;margin:18px 0}p{line-height:1.65;max-width:850px}.intro{font-size:19px}.badge{display:inline-block;background:#dae6da;color:#244838;padding:6px 12px;font-size:13px;border-radius:20px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:34px 0}.stats div{border-top:1px solid #acb8ae;padding-top:15px}.stats strong{display:block;font-size:32px;font-weight:500}.stats span{font-size:13px;color:#516663}.table-wrap{overflow:auto;margin-top:25px}table{border-collapse:collapse;width:100%;font-size:14px}th{text-align:left;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:1px;background:#173e3b;color:white;padding:15px}td{padding:16px;border-bottom:1px solid #cbd0c7}.score{font-size:25px;color:#245f50}small{display:block;color:#5c6c65;font-size:12px;margin-top:5px}.method{background:#e8e9e0;padding:22px;margin:35px 0;border-left:3px solid #778c73}details{padding:20px 0;border-bottom:1px solid #bbc5bb}summary{cursor:pointer;font-weight:600}.families{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;font-size:13px}.families strong{float:right}.bar{height:5px;background:#d7dfd4;margin-top:12px}.bar i{display:block;height:100%;background:#477764}li{padding:7px;line-height:1.4}footer{margin-top:40px;font-size:13px;color:#5c6c65}@media(max-width:650px){main{padding:30px 16px}.families{grid-template-columns:1fr}.stats{gap:10px}.stats strong{font-size:25px}}
  </style></head><body><main><header><div class="eyebrow">Sentanis · Applied AI Research</div><h1>Insurance Bench</h1><span class="badge">Synthetic research pilot · ${escape(generation)}</span><p class="intro">Can an agent turn a claim file into accurate, sourced work and a completed handoff?</p><p>${investigation ? "Three conditional investigation task families join identity, source authority, effective policy and exceptions into scoped requests and a current internal handoff. The families remain correlated under a shared fictional rule engine. Other generations remain separate." : semantic ? "Three correlated narrative evidence task families cover internal coverage review, evidence briefs and fraud referral preparation. Other generations remain separate." : coupled ? "Three correlated occurrence task families connect coverage, financial capacity, and demand proposals. Historical basic workflows remain separate." : "Six insurance workflows."} Closed fictional records. The same tool environment across models. Score the saved work, supporting evidence, and task state; preserve human authority over consequential actions.</p></header><div class="stats"><div><strong>${familyCount}</strong><span>Evaluated task families</span></div><div><strong>${runs.length}</strong><span>Recorded experiment runs</span></div><div><strong>$${total.toFixed(2)}</strong><span>Recorded run cost estimates</span></div></div><p>Cost total sums recorded native run estimates, which can include failed-call reservations and overlapping archived experiments. It is not the authoritative current session ledger or an invoice.</p>${selectionWarning}${primaryTables}<div class="method"><b>How to read these results</b><p>Scores average families equally. Evidence v0.8, investigation v0.9, interaction v0.10, allocation interaction v0.11 and dependency allocation v0.12 headline completed tasks whose existing criteria all pass; weighted partial credit is shown alongside for diagnosis. Three-case once-per-family panels resolve task success in33.33-point steps, so they cannot establish a continuous50–60 difficulty range. Earlier generations retain their original weighted score. Within each diagnostic task: facts 40%, evidence 25%, workflow 25%, boundaries 10%. Critical failures zero the task. All-pass requires every criterion. Actual outcome reports the recorded current business state for dynamic workflows; coupled v0.7 additionally requires an actually recorded feasible objective-optimal proposal subset. Static portfolios report feasible mandatory-complete optimal reservations for static portfolios, independently of citation and memo credit. Missing provider access is recorded separately; incomplete provider coverage has no headline score. Compare rows only when their task split, dataset and harness versions match.</p><p>This small pilot has no insurance expert validation. Exact structured facts and evidence are checked deterministically; prose quality and real-world legal correctness are not established. Development experiments inform harness changes; holdout results remain separate. One run cannot establish a stable model ranking. The historical v0.2 runs have a 4096-token output ceiling. Challenge v0.3, portfolio v0.4 and frontier v0.5 runs use a 16384-token output ceiling, including hidden reasoning where applicable. Portfolio agents must actually reserve prerequisite reviews under approved staff, calendar, deadline and budget constraints; missing mandatory critical reviews zero the task. Every equally optimal feasible plan is accepted. The frontier candidate uses three reviewers with varied prerequisite graphs and a common 300-second provider deadline. The six static portfolio labels share scheduling mechanics and do not establish independent domain breadth. Workflow v0.6 instead uses distinct domain derivations, scripted customer responses, two announced material updates, current revision-bound review and recorded business mutations. Coupled v0.7 reuses the reviewed revision protocol with raw occurrence/exposure/financial/demand records, shared and claimant capacities, and up to 12 competing proposal packages. Selecting the optimal proposal is only a small fraction of the weighted score (a wrong selected plan alone loses about3.57points); report actual optimal written outcomes separately and do not attribute headline differences chiefly to optimization. Its exact optimizer is grader-only; models receive no calculator or solver tool. All optimal ties are accepted, and an asserted optimum without a matching actual state write receives no current-outcome credit. The three coupled task labels share a correlated occurrence engine and do not establish independent domain breadth. Its source support uses a global document/revision/row bundle, with no literal quote packaging. Citing all current source operands can make evidence credit track factual correctness; it does not independently measure source selection quality. Evidence v0.8 assesses supported, refuted and unresolved propositions under explicit fictional rules using scoped narrative sources, supplied source requests, a material correction and an actual internally reviewed handoff. Evidence credit requires a correct label and a sufficient semantic source certificate, so facts and evidence remain dependent. Its structural handoff criterion does not duplicate an all-facts-correct gate. The three labels share evidence mechanics and do not establish independent domain breadth. Original versus normalized source representations are development diagnostics, not additional tasks or independent capability rankings. Investigation v0.9 resolves conditional identity, authority, effective policy and exception rules across current raw sources, one received response and two announced corrections. Its current structural investigation handoff reflects actual saved/reviewed history; it does not certify all semantic facts or correctly scoped requests. The currentRequests criterion separately checks the derived request scopes and retained/invalidated approvals; it is not objective optimization. Fact, evidence and request-scope criteria can be dependent. No professional prose assessment or insurance validity is implied. The registered transport uses a600-second provider deadline,20 turns and inclusive ceilings16384 for OpenAI versus8192 for Bedrock; this is not an equal-compute comparison across providers. Interaction v0.10 preserves two events, six clauses per event and sixteen fields, while different policy activities join shared entity exceptions and localized event-time corrections. Its new source/harness remains a separate generation. Allocation interaction v0.11 is a separately versioned joint-claimant package proposal environment with18 packages and an explicit public search limit. It retains19 facts, eight actual business fields and three phases; larger search is not evidence of greater difficulty. Its repaired runtime records protected intent even after finish in the same batch. Macro completed-task success is the headline, weighted partial credit is diagnostic, and current optimal proposal writes remain visible separately. No historical source or grade is repaired in place. Dependency allocation v0.12 is a separate candidate whose public source-qualified dependencies, exclusions and cycles constrain valid proposal subsets. Its source and macro metric definition alone do not establish empirical difficulty; no ability result is inferred before a terminal independently audited panel. A native JSON-object ablation addresses serialization only; syntactic validity does not establish correct decisions, evidence or handoffs. Verification reminders are prompt variants, with separate harness panels; no ablation result is inferred. Per-provider output ceilings are recorded on each row; different harness limits are separate panels. Memo prose, including claimed approval, is not semantically graded and cannot create actor authority. A normal recoverable stale-write rejection is not a critical failure; unauthorized external finalization and fabricated human signoff are critical. Model identity and configured effort are shown on every row; other providers retain recorded defaults. These are configured model-system results, with different internal reasoning behavior.</p></div>${comparisons}${comparisonWarnings}${observations}${access}${archive}<h2 style="font-family:Georgia,serif;font-weight:400">Inspect the experiments</h2>${details}<footer>Offline benchmark; no production claim records, application credentials, or model keys are served by this report. Inspired by Harvey LAB, SWE-bench, Terminal-Bench, and τ-bench.</footer></main></body></html>`;
}
