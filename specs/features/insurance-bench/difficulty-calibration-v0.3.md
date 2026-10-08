# Insurance Bench v0.3 difficulty calibration preregistration

Status: **target; implementation and calibration evidence pending**. Registered
**2026-10-04 01:07 UTC** (2026-10-03 local), before v0.3 model runs. This document sets the
measurement plan; exact callable model IDs, corpus/source hashes and budget allocations must be
recorded before dispatch. The completed v0.2 pilot and its original scores remain historical.

## Question and hypotheses

Can a more demanding insurance-task corpus expose meaningful differences among model tiers and
reasoning settings without scoring artificial format failures? The prior pilot's 86–98 weighted
scores motivated harder substantive work. A frontier weighted-score range of **50–60/100** is an
aspirational design range for useful headroom, not a forced outcome, score ceiling or completion
threshold. Publish the observed distribution even when outside that range.

- **DC-1, task difficulty:** linked evidence, conditional decisions and multi-step calculations
  reduce ceiling saturation relative to the easy pilot while preserving solvability and evidence
  sufficiency. This is a task-design hypothesis, not a claim that cross-version score reduction
  establishes model regression.
- **DC-2, reasoning effort:** on identical v0.3 development tasks, high reasoning on the same exact
  GPT model improves factual/evidence/complete-task outcomes over low reasoning. Null or negative
  effects remain valid results; longer reasoning is not assumed to help.
- **DC-3, model tier:** a smaller callable model in the same family performs worse than the larger
  model under matched conditions. Repeat this comparison for callable Qwen and/or Claude tiers.
  Do not assume monotonic model ordering or fill unavailable tiers with guesses.
- **DC-4, measurement validity:** failures reflect missed scenario facts, calculations, source
  reconciliation or required safe workflow rather than unspecified label spelling, quote whitespace,
  reasoning-output truncation or transport failures. Inspect both successful and failed outputs.

## Corpus and substantive difficulty

Target **24 newly authored synthetic cases**, six families, **12 development / 12 fresh holdout**,
with two of each split per family. New holdout must use different scenario mechanisms/parameters
and identifiers; it cannot be the inspected v0.2 set or a superficial rename. All names, policies,
records, amounts and supplied scenario rules remain invented from source-level concepts. No live
records, distribution fitting or production legal conclusions enter this corpus.

| Family | Substantive challenge to add | Solvability requirement |
| --- | --- | --- |
| Deadline triage | Multiple demand versions, conditional extension/receipt rules, time zones, exceptions and missing evidence. | Operative versions/receipt facts are present; every applicable condition and clock basis can be traced. |
| Coverage review | Loss-time endorsement precedence, scoped exclusions, competing signed/unsigned records and unresolved use facts. | Supplied scenario rules explain precedence; correct ambiguity can remain unresolved rather than forcing a coverage decision. |
| Financial reconciliation | Multi-party ledger reconciliation, reversals/corrections, duplicate IDs, currency/unit distinctions and expense/indemnity allocation. | Correct included/excluded operands and reconciliation rules are present; monetary answers can be recomputed independently. |
| Evidence brief | Cross-document contradiction, source dependence, revisions, bounded camera/transcript evidence and reliability limits. | The agent can distinguish what each source establishes and what remains unproved without inventing missing facts. |
| Fraud referral | Several plausible innocent explanations, independent corroboration, duplicate provenance and incomplete metadata. | Observations support a triage plan while final fraud/adverse-action authority remains human-owned. |
| Workflow handoff | Competing gates, conditional approvals, case-specific routing and multi-step dependencies with explicit authority scope. | Required state/actions follow supplied operative rules; stale tasks cannot override the current human authority gate. |

A longer dossier is not automatically a harder benchmark. Add tasks requiring several indispensable
sources and coupled decisions, not decorative document volume. Difficulty should arise from case
work, not a need to memorize undocumented tool enums or write one particular phrase. Supply every
required identifier convention and output schema in the public contract. Model-visible instructions
must not expose expected answers; graders must remain inaccessible through tools.

Retain evidence, workflow and safety checks. A critical failure must correspond to a declared
consequential scenario failure, not a harmless serialization choice. Do not raise weights, invent
extra penalties, erase easy cases after observing holdout scores or impose numeric caps to reach
50–60. Category weights stay fixed unless an independently justified correction is preregistered
as a new measurement generation.

## Calibration and panel before outcomes

1. Freeze an initial v0.3 development corpus and proposed holdout construction before runs. Prove
   every expected fact/operand is supported, every task is possible, oracle controls pass and
   deliberately wrong/unsafe controls fail. Oracle scoring is an engineering check, not independent
   insurance-expert validation.
2. Record a panel manifest with exact model IDs/provider/region, family/tier designation, reasoning
   configuration, resource limits, trial counts, price assumptions and source/task hashes. Selection
   uses live catalog/access evidence and the rules below, before seeing scores.
3. Start with small matched development panels, then use at least **two independent attempts per
   selected task/condition** for the planned repeated panel. A full development panel has 12 cases;
   a six-case cost-limited screen must be labeled as a screen, with its selected IDs declared first.
   If budget cannot complete the repeated panel, report that limitation rather than invent repeats.
4. Inspect failures using the taxonomy below. Up to **three documented development calibration
   generations** may repair ambiguity or add independently justified substantive complexity. Retain
   every generation's results and decisions. Do not select the generation with the most favorable
   model ordering or pretend repeated tuning is an unbiased estimate.
5. Freeze the final corpus, grader, model-facing protocol, source, model settings and selected
   baseline before fresh holdout execution. Preserve the freeze timestamp. No inspected holdout
   answer may drive changes within that generation.

| Contrast | Fixed before the run | Varying factor |
| --- | --- | --- |
| Same GPT model: low vs high | Exact model ID, cases, tools, scorer, output contract and visible-output allowance | Explicit reasoning effort; record actual usage and truncation. |
| Large vs smaller GPT tier | Same latest callable family where available, cases and harness; declared reasoning policy | Exact tier/model ID. |
| Qwen family tiers | Callable larger and smaller Qwen IDs in the same generation if available | Tier; preserve access failures as gaps. |
| Claude family tiers | Callable larger and smaller Claude IDs in the same generation if available | Tier/recorded reasoning configuration; no silent substitution. |

Provider default reasoning and internal compute can differ. Same-family does not equal identical
training or compute; report concrete configurations. For the deliberate low/high effort contrast,
ensure an adequate common visible-response allowance and record reasoning tokens separately where
available. A shared ceiling that lets high effort consume all JSON output is a harness starvation
artifact, not evidence of inferior reasoning. Predeclare the effective per-call limits; inspect
finish reasons and classify truncation. A limit correction restarts affected matched conditions
rather than selectively rerunning only the weaker result.

No runnable smaller tier means an explicit unavailable comparison, not a cross-family replacement
advertised as a tier test. Wider provider coverage can remain supplementary after the primary
same-model/same-family contrasts.

## Fixed initial execution panel — amendment before outcomes

Amendment registered **2026-10-04 01:15:58 UTC**, before model-score outcomes.

This panel and analysis amendment is registered before model-score outcomes; only access probes
had succeeded at registration. Exact manifests are created by the runner before dispatch. Use
**six development cases, the first declared case in each family, two attempts per condition**.
This is a predeclared cost-limited screen, not the complete 12-case development corpus.

| Cycle | Exact configured IDs / settings | Attempt count |
| --- | --- | ---: |
| 1 | OpenAI `gpt-6.1-sol`, effort `low`; OpenAI `gpt-6-luna`, effort `low` | 6 cases × 2 trials × 2 conditions = 24 |
| 2 | Same `gpt-6.1-sol`, effort `high`; same `gpt-6-luna`, effort `high` | Same 6 cases × 2 × 2 = 24 |
| 3 | Bedrock `qwen.qwen3-32b-v1:0` versus `qwen.qwen3-235b-a22b-2507-v1:0` | Same 6 cases × 2 × 2 = 24 |

Primary effort contrasts pair Sol low/high and Luna low/high on exact IDs. The tier contrast pairs
Sol/Luna at matched effort; these are distinct GPT-6-family model/version configurations, not proof
that only parameter count differs. Qwen tier architectures/training may also differ. Use the same
cases, tools, grading and common limits, and interpret the contrast as a configured-model comparison.
Callable Claude Haiku 4.5/Sonnet 4.6 can be supplementary if budget permits; this optional panel
is not required for primary completion and cannot be selected because of a preferred ranking.

**Common limits:** 10 turns, **16384 output tokens per call**, **120-second request deadline**.
Record actual reasoning tokens/effort and visible output where providers expose them. Any output
truncation invalidates a clean paired comparison: preserve raw outputs, name the affected conditions,
and preregister a common-limit rerun of all affected conditions before observing rerun outcomes.
Do not selectively give more tokens to the losing model. The comparison API rejects truncated
contrasts; an unchanged raw score is diagnostic evidence, not a clean capability estimate.

Planned final holdout: the **12 fresh cases once each** for Sol low, Sol high and Luna high
(36 attempts initially), after final generation/settings freeze. Additional repeated holdout attempts
require remaining budget and prior declaration. Calibration generations remain capped at three,
with independently justified task/measurement changes and no ordering-based selection. Spending
uses the existing ledger's remaining balance (about $20.6 at planning), with no cap increase implied.

## Pre-outcome resource allowance amendment

Registered **2026-10-04 01:18:42 UTC**, before the first paid v0.3 development task call or any
model-score outcome. Access probes are not task-performance evidence. The common output allowance
is raised from the initial 8192 to **16384 tokens per call for every condition and model tier**;
10 turns and the 120-second request deadline remain unchanged.

A source/corpus audit found gold evidence support spanning 57–99 quote anchors and roughly
11–20 thousand anchor characters in the initial draft. Independent review identified irrelevant
or overly expansive anchors, which should be reduced to the indispensable fact/operand support.
The oracle may group multiple anchors for the same fact/source in one valid quotation. Evidence
volume and repeated quote plumbing must not masquerade as substantive insurance difficulty.

Separately, an inclusive token cap cannot guarantee usable visible output when provider reasoning
consumes the same allowance. Raising the common cap before performance outcomes is a resource
fairness correction, not an outcome-based concession to a particular model. The comparator still
rejects **any** truncated contrast; 16384 does not prove that truncation is impossible. Preserve
actual reasoning/output usage and finish reasons. If truncation remains, retain raw diagnostic
results and preregister common-limit reruns of every affected condition before interpreting clean
paired capability differences.

No prior v0.2 scores or v0.3 performance observations justify this change; the v0.3 corpus, source
and common 16384 setting must be frozen in the actual pre-dispatch manifests.

## Outcomes, paired comparison and limited power

Publish **weighted score, strict all-pass completion, critical failures and four components**
together. All-pass is the primary statement that the entire assigned work was completed; weighted
partials diagnose progress and supply the requested quantified index. A 50–60 weighted score does
not mean that 50–60% of claims can be handled safely or autonomously.

Within each predeclared contrast, report task-matched score/evidence/all-pass differences, the
counts of cases that favor A, favor B or tie, and all-pass flips. Average repeated attempts within
a task before treating tasks as statistical units; attempts from the same case are correlated.
Report paired **family-cluster bootstrap 95% intervals**, with **10,000 resamples and seed 1729**,
resampling the six family clusters together while preserving task/condition pairing. Average
repetitions within each task first. This handles correlated templates more cautiously than treating
case repeats as independent samples. Six clusters provide limited power: intervals describe this
small selected panel and can be unstable; they do not establish a population benchmark rank or
independently validated provider superiority. This analysis was selected before model outcomes.

Keep model transport failures separate from scored attempts. A common-case subset after failures
must be named and cannot masquerade as the full matched panel. Retain provider errors and partial
coverage. Score incomplete model episodes according to the declared task rule, while suppressing
headline ability metrics when provider coverage is incomplete.

Evidence of differentiation requires a practical difference across multiple cases/components,
consistent directions across repeated trials and no new critical-failure pattern. Do not declare
success solely from one positive aggregate. If lower tiers/high-low effort do not separate, report
null/nonmonotone results and possible explanations: limited sample power, task family specificity,
ceiling/floor saturation, inadequate reasoning allowance or authentic similar performance. Do not
cherry-pick families, remove contrary trials or tighten formatting until the expected order appears.

## Failure inspection and grader fairness

Record each investigated failure with task/model/attempt, expected behavior, actual source/output,
grade and category:

- **Substantive:** missed operative document, wrong conditional rule, bad calculation, unjustified
  factual conclusion, missed workflow dependency or attempted consequential action.
- **Evidence:** correct conclusion but inadequate source support; distinguish actually unsupported
  claims from a equivalent valid citation rejected by a mechanical rule.
- **Mechanical:** harmless identifier wording, timestamp representation, quote whitespace/casing,
  duplicate-equivalent representation or memo wording rejected despite satisfying the public task.
- **Harness/provider:** truncation, parse/tool-protocol defect, lost transport, access denial or
  accounting interruption.
- **Ambiguous/task defect:** more than one reasonable answer or required information absent.

Include selected successes to inspect permissive false positives. Mechanical acceptance can use
explicit canonical identifiers, lossless normalization and predefined alternate valid answers;
it must not launder wrong facts or unsupported citations into passes. Changes follow independently
reviewable semantics and rerun/regrade the entire affected panel. Never count a lower score created
by mechanical false negatives as successful difficulty calibration.

The v0.2 `Medical attachment M-2` versus `M-2` rejection motivates this measurement rule. It does
not authorize using old heldout answers as v0.3 test questions or claiming v0.2 scores improved
retroactively. Keep the published v0.2 numbers intact with their documented caveat.

## Lineage, spend and completion

Use fresh processes against frozen loaded source. The earlier disk-hash/loaded-code discrepancy
must not recur: preserve source snapshot/process-start lineage and stop for any code mutation during
matched execution. Accounting-only amendments need explicit old/new lineage and complete affected
panel reruns chosen before treatment outcomes.

Use the existing durable capped session ledger unless a separately authorized budget is provided.
Record estimated maximum-call reservations, actual configured token costs and the remaining budget;
this plan creates no new spending authorization or reset. Prioritize the primary matched contrasts
instead of repeatedly sweeping all providers.

Completion is a transparent v0.3 engineering report with substantive task verification, frozen
model-panel lineage, repeated matched development evidence where feasible, inspected failure types,
fresh holdout results and honest null/difficulty outcomes. Achieving the aspirational 50–60 range
alone is neither necessary nor sufficient. Independent insurance-expert calibration, representative
real-world claims validity and production deployment acceptance remain separate open work.
