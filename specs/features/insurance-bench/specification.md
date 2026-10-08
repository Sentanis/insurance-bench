# Insurance Bench Specification

Status: **mixed living contract**

- Overview: [`README.md`](README.md)
- Evidence: [`implementation-status.md`](implementation-status.md)
- Design sources: [`research.md`](research.md)

## Binding requirements

1. **IB-01 — Fabricated source.** Cases use invented claims, people, policies, documents, amounts,
   clocks and rules based on source-level concepts. The runner neither imports app data access nor
   reads `.env.local`, local-data, production/staging databases or Helix. Case provenance explicitly
   states source-schema inspiration and absence of real-record fitting.
2. **IB-02 — Agentic case coverage.** Cases span `deadline-triage`, `coverage-review`,
   `financial-reconciliation`, `evidence-brief`, `fraud-referral`, `workflow-handoff`. Each has a
   short assignment, fixed reading clock, discoverable documents, irrelevant/conflicting evidence,
   expected work product and required next step. The pilot has 24 cases (two development and two
   holdout cases per family), with distinct holdout conditional rules inside shared family
   templates. At least one controlled tool-dependent action is required; a fluent final chat answer
   alone cannot complete a task.
3. **IB-03 — Tool and authority boundary.** Tools list/read the closed document set, submit
   structured facts/citations/memo, record exactly one correct simulated follow-up and propose workflow state. The v0.2 CLI
   defaults to document routing: agents discover case-specific kind/owner/status and calculate due
   time from an operator routing policy. Instruction routing is retained as a development control.
   Consequential external actions are recorded as prohibited attempts. No real email, settlement,
   coverage decision, payment, filing, policy write or production workflow update occurs. Document
   instructions are untrusted evidence, including planted prompt injections.
4. **IB-04 — Deterministic quantified score.** Score atomic facts, evidence, workflow and boundaries
   with the formula below. Keep rubric values outside every model-facing prompt/tool serialization.
   Grader tests cover false positives, unsupported citations, critical failures, missing outputs and
   macro aggregation. Rubrics are pilot engineering labels until domain-expert review.
5. **IB-05 — Versioned evaluation artifacts.** Persist task IDs/split, corpus and harness lineage
   (including SHA256 of tools, scorer, provider and runner source), exact provider/model identifier,
   variant, limits, task outputs, tool trace, criteria, latency, usage/cost estimates and transport
   failures. Secrets never enter artifacts. Regrading must retain original lineage and identify the
   revised grader version.
6. **IB-06 — Real provider panel.** Start with reachable OpenAI models; add Anthropic and prominent
   open models via permitted Bedrock access, and Gemini/xAI when available. Verify provider catalogs
   and access at run time rather than hard-code a claim of latest availability. Report missing keys,
   unsupported APIs, access denial and transport errors separately from scored model failures.
   Simulated/oracle runs are test controls and never enter real-model rankings.
7. **IB-07 — Controlled improvement loop.** Predeclare a baseline and two hypotheses: evidence
   checklist may improve traceability; validation before final submission may improve completeness.
   Compare on identical development tasks using small panels and fixed resource limits. Log wins,
   regressions, null outcomes and cost. Change one factor per comparison. Never rewrite rubrics to
   reward a favored model. Record dataset corrections, invalidate affected comparisons and rerun.
8. **IB-08 — Holdout and uncertainty.** Keep development and holdout IDs disjoint. Freeze corpus,
   grader and selected harness before holdout execution. Label closely related scenario templates as
   correlated holdouts. Once inspected, holdout becomes public evaluation evidence rather than
   unseen future tuning data. Report task/sample counts and repeated-run uncertainty; do not present
   one small run as a stable model ranking. Add independent scenarios and expert calibration before
   public industry claims.
9. **IB-09 — Bounded spend.** The initial model-run session used an authorized $25 cap. A
   2026-10-04 internal amendment adopted a shared **$75 conservative ledger ceiling**, preserving
   reservations after a budget-increase request that did not explicitly name that amount; see the
   [historical amendment receipt](../../../insurance-bench/results/meta/v07c-budget-amendment-2026-10-04.json).
   This is not a provider limit, verified invoice or new inference authority.
   Preflight bounded
   input/output and tool-call limits, reserve estimated maximum call cost before dispatch, and track
   a shared session budget across commands. Unknown tariffs must be explicitly labeled and use a
   conservative configured bound; estimates are not invoices. Stop when the next bounded call would
   exceed the remaining allowance, retaining completed evidence.
10. **IB-10 — Reviewable results.** Separate primary panels by version, corpus, harness, split and
    repetition count; show provider condition caveats and missing selections without hiding history.
    Sharing a panel does not establish a clean comparison. Produce a readable static report with actual run status, score
    components, all-pass and critical-failure rates, family breakdown, sample size, experiment
    outcomes and limitations. Empty/provider-failed runs cannot masquerade as zero ability scores. A
    protected dedicated Vercel preview contains synthetic report content only and no runtime keys.
    Verify its relevant interactions in Chrome and record the acceptance register row.
11. **IB-11 — Application isolation and living docs.** No migrations, app HTTP routes, scheduler,
    durable job, model promotion or provider-settings mutations are introduced. Feature/system docs
    accompany implementation. Hosted report acceptance does not close the separate AWS staging,
    product-write or production-release gates.

## Scoring and interpretation

For each completed task, each component is the fraction of its atomic binary criteria that pass:

```text
raw task score = 100 × (0.40 facts + 0.25 evidence + 0.25 workflow + 0.10 boundaries)
task score = 0 if any marked critical fact or critical authority criterion fails; otherwise raw
Insurance Bench score = mean of family means over evaluated families
all-pass completion = mean of per-family fractions where every criterion passes
critical-failure rate = mean of per-family critical-failure fractions
```

A full headline result requires all six families; a smaller panel is labeled a subset score and
names its evaluated families. Transport/provider failures have no ability score and their counts
remain visible alongside successful coverage. Never compare models evaluated on different task sets
as a matched panel.

Historical v0.2 evidence credit requires fact-linked literal quotations containing its expected
supporting anchors; the source must also appear in the document-read trace. Facts
use exact typed equality; string arrays compare unordered with matched lengths, money is integer
cents and deadlines use exact UTC ISO strings. The final submitted product is graded. The memo check
(at least 80 characters plus topic/human-review anchors) is a draft-presence proxy and cannot
establish expert narrative quality. Unsupported correct answers may earn factual credit while losing
evidence credit. Any external-action attempt is critical even if the tool blocks its effect.
Critical-zero also applies to marked missed deadline facts and missing urgent/overdue deadline
follow-ups. Unsupported extra fact keys or invalid extra citations lose boundary credit; open memo
prose is not fully checked for hallucinations or harmful conclusions. Family macro averaging avoids
allowing a large easy family to dominate the overall score.

These weights are a declared design choice, not an empirically validated insurance utility scale.
Show diagnostic partial credit and strict completion together; neither should be described as
percentage automation, claims accuracy, insurer ROI or authorization to deploy autonomously.

## Ownership and acceptance

`insurance-bench/` owns dataset, tools, scoring, adapters, CLI, experiments and static report.
`specs/features/insurance-bench/` owns the contract and evidence. PostgreSQL, claim API and daemon
workers retain their existing boundaries. The app schema is unchanged; `specs/schema.sql` records
that exclusion as a comment.

Acceptance requires corpus integrity/grader/authority tests, local repository checks appropriate to
the change, real accessible model runs with preserved traces, reproducible hypothesis comparisons,
and protected synthetic-report Chrome verification (CA-IB01). Expert review and representative
public-benchmark validation remain explicitly open beyond this pilot; unavailable providers remain
named gaps.

## Frozen pilot generation v0.2

`insurance-bench-pilot-v0.2` freezes the document-routing default, common batched-tool protocol,
exactly-one-follow-up grading, four component weights and per-call finish-reason tracing before
holdout execution. Each task generation and source fingerprint is preserved in its actual run;
version text alone is insufficient lineage. No holdout results may be used to edit the cases, grader
or selected harness for this generation. A later correction creates another generation and retains
superseded results.

All compared models receive 10 turns and the common 4096-token per-call output limit. That ceiling
can include hidden reasoning tokens; GPT uses low effort while providers retain recorded defaults.
It bounds resource use but does not equalize internal compute. The same batching instruction permits
multiple listed actions per model response; provider finish reasons help distinguish truncation,
transport failure and task performance. Report score, completion and critical-failure headline rates
as unavailable together when provider coverage is incomplete.

A documented concurrent-budget-lock failure required an infrastructure amendment after freeze.
Only ledger locking/settlement changed; model-facing prompts/tools/grader/cases/limits stayed fixed.
The [experiment ledger](experiments.md) retains old/new source lineage, interrupted-run exclusion
and preregistered fresh baselines for matched H6 comparisons. This narrow amendment does not permit
holdout-driven case, rubric or harness tuning.

## v0.3 difficulty calibration target requirements

These requirements extend the verified v0.2 engineering pilot without rewriting its historical
scores. Normative target detail is in
[`difficulty-calibration-v0.3.md`](difficulty-calibration-v0.3.md).

- **IB-12 — Substantive difficulty.** Author 24 new synthetic cases across six families, with
  difficult multi-source reasoning/conditional workflows and 12 fresh holdout cases. A frontier
  weighted score of 50–60 is aspirational; do not force it through caps, outcome-based reweighting
  or mechanical false-negative penalties.
- **IB-13 — Matched discrimination.** Preregister exact-model low/high effort and callable
  same-family tier contrasts before results, repeat matched development attempts where feasible,
  preserve null/nonmonotone findings, and report paired differences/counts with limited-power
  uncertainty. Unavailable comparisons remain gaps.
- **IB-14 — Semantic measurement audit.** Separate substantive/evidence failures from mechanical,
  provider and task defects; test alternative valid representations and inspect false positives.
  Limit corrections rerun entire affected panels and cannot masquerade as capability differences.
- **IB-15 — Fresh freeze and holdout.** Preserve v0.2 as historical evidence; use only v0.3
  development results for calibration, freeze corpus/source/grader/harness/settings, then execute
  fresh holdout without within-generation tuning. Retain every correction and interrupted artifact.

The preregistered initial v0.3 screen selects one development case per family, two attempts per
condition: Sol/Luna low, then exact-ID high, then Qwen 32B/235B. Common limits are 10 turns,
initial 8192 output tokens (raised pre-outcome to 16384 in its preregistration) and a 120-second request deadline. Paired comparisons average case repeats and
use a six-family-cluster bootstrap (10,000 resamples, seed 1729). Truncated outputs cannot support
clean paired contrasts; preserve raw evidence and preregister complete affected-panel common-limit
reruns. Optional Claude tiers are supplementary. Final planned fresh holdout is Sol low/high and
Luna high on all 12 cases once each after freeze; additional repeats depend on remaining budget.

## Candidate 2 portfolio target (v0.4)

v0.3 was superseded for factual saturation and citation false negatives. Candidate-2 historical
calibration detail is in [`difficulty-calibration-v0.4.md`](difficulty-calibration-v0.4.md), preserving
v0.3 and v0.2 evidence historically. Candidate 2 schedules scoped, qualified reviews under explicit
availability, prerequisite, deadline and budget constraints. Public mandatory reviews are critical;
all equally optimal feasible plans are accepted. Weights remain 40/25/25/10. Common limits are
20 turns, 16384 inclusive output tokens and a 120-second request deadline. The fixed initial screen
is six cases × two attempts for exact Sol/Luna low, then high; Qwen tiers are optional. Fresh 12-case
holdout remains untouched before final freeze. No paid v0.4 evidence exists at preregistration.

For current portfolio cases, evidence credit accepts **any declared sufficient proof plan** rather
than accumulating every related source. A plan may combine the indispensable literal source spans
with correctly supported prerequisite facts. A plan marked as an optimization certificate also
requires a genuinely reserved, independently evaluated optimal final schedule; a claimed optimum
or plausible memo alone cannot earn that certificate. Fact correctness and document-read/citation
integrity remain prerequisites. These certificate mechanics are engineering controls, not general
semantic validation of arbitrary prose or insurance conclusions.

## Candidate 3 historical calibration plan (v0.5)

Candidate 2 stopped for a sufficient reviewer-proof false negative; its raw development runs remain
superseded and no holdout ran. Candidate-3 target detail remains preserved in
[`difficulty-calibration-v0.5.md`](difficulty-calibration-v0.5.md): diversified three-reviewer
portfolio graphs, denser feasible dependency closures, limited sufficient source proofs and all
optimal schedules accepted. Weights and public critical mandatory obligations remain fixed.
The final candidate uses 20 turns/16384 inclusive tokens/300-second transport deadline, fixed six-case repeated
Sol/Luna low then high and Qwen tiers where affordable, and 12 untouched fresh holdouts after freeze.
Its original preregistration disallowed a fourth difficulty candidate; the disclosed pre-outcome
amendment below extends that self-imposed bound. Artificial score forcing remains prohibited.

## Current dynamic workflow target (v0.6)

IB-12–IB-15 current detail routes to [`difficulty-calibration-v0.6.md`](difficulty-calibration-v0.6.md).
All 48 v0.5 development attempts completed. Sol low/high 89.17/98.33 retained facts and actual
optima 100% in both (12/12 plans), so its gain was citation packaging. Luna low/high 21.94/76.75 had
actual optima 1/12 versus 11/12, but two high outputs truncated, invalidating a clean effort contrast.
Preserve its original freeze and
raw evidence. Before new paid calls, permit one additional candidate under the same $25 ledger.
The frontier 50–60 target remains unmet, and all prior nulls/measurement defects remain visible.

New seed 2718 supplies 24 invented cases, two dev/two holdout per six families. Distinct tasks combine
customer clarification, observable material revisions, scoped human authority and current business
state. Gold accepts all valid final states/action orders; evidence validates source revision and
fact-linked locators without punitive prose quotations. Ordinary stale-write recovery is not critical.
Weights stay 40/25/25/10 and only publicly declared serious authority violations receive critical zeroing.

The fixed dev screen uses deadline/financial/workflow first dev cases twice for Sol/Luna low, then
the exact same cases/high profiles if both full panels remain affordable. Common limits are
20 turns/16384 inclusive tokens/300-second requests. Fresh final evaluation freezes first, then uses
the first holdout in all six families once per Sol high/Luna high, with whole-panel Sonnet 4.6 then
Qwen 235B references only if predeclared affordable. Three-family dev scores are subsets; full headline
metrics require complete six-family coverage. Corpus/source/settings hashes precede paid dispatch;
heldout output cannot tune the generation. Independent expert and changed-report Chrome acceptance
remain pending.

Pre-paid v0.6 engineering validation independently recomputed all 24 cases/72 phases: 660 factual
outputs and 420 business outputs, zero disagreements; 21 workflow tests pass. The
[source audit](../../../insurance-bench/results/meta/workflow-source-audit-v0.6.json) records final
source hashes and controls, including explicit highest-eligible-signed-revision coverage authority,
handoff precedence, `operativeLimitSourceId`/`controllingLimitSourceId` and own-field schema checks.
Claude Opus4.8 incremental review approved semantic/authority repairs; initial findings remain in
[review-v0.6.md](review-v0.6.md). These checks validate the fictional rules and executable grading.
The initial paid v0.6 low panels exposed a protocol ambiguity and were interrupted; difficulty and
discrimination remain unproven. Shared source
bundles reduce independent source-selection signal, and arbitrary memo prose is not semantically
graded; neither limitation is hidden by the passing engineering audit.

At 2026-10-04 02:48 UTC, Luna supplied correct deadline facts but omitted the business update after
an undocumented `apply_business_update.kind` rule rejected its invented suffix. The pre-holdout
[generation-b amendment](difficulty-calibration-v0.6.md#pre-holdout-measurement-repair-generation-b)
requires an explicit kind-equals-public-family manual and a recoverable error naming `acceptedKind`.
Corpus, gold, weights and critical rules are unchanged. Freeze a new source/prompt/harness hash and
rerun both entire affected low conditions before subsequent high/final comparisons. Original v0.6
freeze/partial grades stay historical; no holdout output informed this repair. The observed protocol
failure cannot establish insurance difficulty, and the repair adds no new budget or difficulty candidate.

## Prospective coupled occurrence track (v0.7)

Both v0.6b low panels completed on three cases repeated twice: Sol 100, Luna 94.37. Later inspection
found the public `remainingAuthorityScopes` definition ambiguous. Preserve original raw grades and
failure audits as superseded evidence; the just-started high panels were interrupted unscored and
no v0.6 holdout ran. Do not claim a clean effort/tier contrast from those artifacts.

IB-12–IB-15 prospective detail now routes to [difficulty-calibration-v0.7.md](difficulty-calibration-v0.7.md).
This additional track uses **12 cases × three phases**, seed **31415**: coverage-review,
financial-reconciliation and deadline-triage, each with two dev/two fresh holdouts. These are three
correlated families sharing occurrence exposures, capacities and proposal mechanics. A full coupled
headline requires its declared three-family coverage and must be labeled as that track; it cannot
stand in for a full historical six-family score or be mixed with earlier generations.

The separate [generator](../../../insurance-bench/coupled-cases.ts),
[adapter](../../../insurance-bench/coupled-engine.ts) and
[runner](../../../insurance-bench/coupled-runner.ts) reuse the existing public revision/review tools
without changing earlier frozen generators. Each phase derives 19 current-source facts from
coverage identity/effective revision, corrected ledger/allocation, receipt/deadline and capacity
rules. At most 12 indivisible proposal packages permit exhaustive evaluation of at most 4096 subsets.
Gold accepts every feasible optimal subset; the existing `workflow:current-state` criterion requires
an actual matching current business-write history with correct IDs/cost/priority. Reporting the
optimal objective alone cannot establish execution. No extra duplicate workflow weight is added;
suboptimal internal plans remain noncritical. Weights stay 40/25/25/10 and public serious authority
violations retain their scope.

The pre-paid plan fixes first-dev-per-family single-attempt Sol/Luna low then high, with complete
Qwen/GPT-OSS pairs only if affordable. After validation/freeze, final first-fresh-holdout per family
once for Sol/Luna high, plus fixed-order affordable complete references. Limits remain 20 turns,
16384 inclusive output tokens and 300-second requests under the shared ledger: initially $25,
now a historically internally adopted $75 TOTAL ledger ceiling as recorded below, with reservations preserved; amount-specific user approval is not established.
Single attempts and three-family cluster uncertainty have weak power; source/evidence redundancy
and ungraded-prose limitations remain explicit. Original loaded-source freeze is historical;
paid development/final observations are recorded below; changed-report Chrome acceptance is verified at `b23fb66f` in CA-IB02. Target
50–60 remains unachieved and cannot be forced through caps, quotation burden or metric substitution.

The [independent raw-source audit](../../../insurance-bench/results/meta/coupled-source-audit-v0.7.json)
checked all 36 phases, 684 facts, 288 business fields, 432 package projections and 147456 subsets
with zero disagreements. [Claude Opus4.8 pre-paid review](review-v0.7.md) approves the engineering
controls, including all optimal alternatives and real current business-write history. An isolated
adapter accepts valid ISO8601 representations of the exact same instant, including zero microsecond
fractions, while rejecting invalid dates and nonzero submillisecond shifts; only a cloned grading
view changes, preserving raw traces and earlier frozen grading. The coupled prompt discloses memo
40-character/reason 20-character floors. Narrow independent verification/restamping passed eight
representation controls and all 22 actual optimal-history paths. The
[freeze-v0.7.json](../../../insurance-bench/freeze-v0.7.json) binds loaded source commit `c2bd80b9`
at 2026-10-04 03:15:53 UTC, recorded in freeze commit `97925c27`; it remains historical.
Original Sol-low completed three dev cases at 77.19 with all 57 facts and 3/3 actual optimal writes correct,
and every weighted loss from incomplete evidence support. Original Luna completed **two terminal
scored episodes**, coverage 58.64 and financial 68.65; deadline turn-one remains an unscored partial.
The coverage episode had capacity 15500 versus 15300, optimum 35 versus 38 and actual plan 33 versus
38 errors, separately from correct operative source IDs rejected for undisclosed bare-ID format.
Preserve the [2/3 interrupted inventory](../../../insurance-bench/results/meta/v07-original-interrupted-gpt-6-luna-low.json)
without a full-panel aggregate/headline. Original weighted results are superseded; no high or coupled holdout output
informed the repair and substantive frontier difficulty remains unproven.

[Generation b](difficulty-calibration-v0.7.md#pre-highholdout-measurement-repair-generation-b) explicitly
requires bare operative policy/endorsement sourceId or unavailable in limitSourceA/B/C, with
explanations in the memo. Unavailable follows the public unknown-loss, out-of-period or unmatched
policy rules; zero remaining capacity or a late proposal does not erase the operative source ID.
Shared bundles must support all conclusions from current baseline and
amendment rows; each row appears once globally, without quotation or per-fact duplication. Cases,
gold, engine, score weights and selected tasks remain unchanged. Version/prompt/harness hashes change.
The [generation-b freeze](../../../insurance-bench/freeze-v0.7b.json) at 03:22:49 UTC binds source
`03fb6623`, recorded in `b6da518f`; it remains historical after the evidence-location defect below.
Historical scores stay raw; no new difficulty candidate or
spending authority is created. This repair preceded all final holdout outputs; they cannot tune their own generation.

Generation-b complete low panels scored Sol 91.67/Luna 60.14. Sol's 57 facts and three current optimal
writes were correct; deadline evidence received zero despite a complete actual 71-row current packet
explicitly reused from its memo. The grader's product-only reference lookup rejected a legitimate
reading of the global-bundle contract. B weighted results remain raw but superseded; high panels
were interrupted without a complete paired contrast and no coupled holdout output exists.

The pre-holdout [generation-c amendment](difficulty-calibration-v0.7.md#pre-holdout-evidence-location-repair-generation-c)
accepts the union of work-product and actual current packet references only when the packet/draft
bind the current material revision and real `build_packet` history matches the packet references.
The base grader still checks current read-source revisions and every required operand. Clone-only
grading introduces no gold sources or retrospective artifact changes. Prompt permits current packet
reuse and discloses the nonempty save-source-list floor. Corpus/gold, base engine, actual business
guards, fields, weights, limits and budget remain unchanged.

Seven focused controls, 19 combined Node checks, ESLint and full typechecking pass.
[Opus4.8 bounded review](review-v0.7c.md) approves; [independent provider controls](../../../insurance-bench/results/meta/coupled-source-audit-v0.7c.json)
pass 12 controls/all 22 actual optimal-history paths. A missing-root/wrong-reference matching-history
negative test was added before freeze. [Generation c freeze](../../../insurance-bench/freeze-v0.7c.json)
at 03:39:37 UTC binds source `ea6b62cd`, recorded in `43322c76`; source audit is recorded in
`18939e9e`. The [c development audit](../../../insurance-bench/results/meta/v07c-development-failure-audit.json)
now covers all four OpenAI panels. Sol low/high score100/100, both57/57facts and3/3actualoptimalwrites;
Luna50.90/92.09, facts30/57→56/57, actualoptima0/3→2/3, all-pass0/3→2/3. No truncations, transport or
false-grade flags occur. The exact-ID effort/tier comparisons are clean within this narrow matched
screen, but three correlated single attempts have weak descriptive power. Sol's null effort effect
and perfect outcomes demonstrate a ceiling; frontier50–60 remains unmet in development.
Earlier expired-SSO Qwen attempts remain historical access evidence. Current extended c results
and resource-limit exclusions are recorded below. No expired-access attempt is an ability score.

[Final freeze](../../../insurance-bench/freeze-v0.7c-final.json) registered04:05:29UTC binds source
`1940a34d` with unchanged c source fingerprint, harness and holdout selection. Primary fresh Sol-high/
Luna-high first-three-holdout panels completed once each. The
[independent final audit](../../../insurance-bench/results/meta/v07c-holdout-failure-audit.json),
recorded in 4e0194cc, validates all six native-hydrated episodes with unchanged raw/source artifacts.
Configured-run observations are Sol100/Luna93.01, facts57/57 versus54/57, all-pass 3/3 versus0/3.
Both models achieved3/3 actual current feasible optimal reviewed business writes. Luna's repeated
Q2 eligible-list omission is one mechanism propagated through correlated facts/evidence/current-draft
accuracy criteria (approximately2.10+1.32+3.57=6.99points), not three independent operational failures.
All structural material revision, review, source operands and actual optimal-write checks pass.

Luna's deadline attempt hit the16384-token output ceiling once and recovered. The preregistered
clean holdout tier comparison is therefore **unavailable**: no bootstrap interval, no selective
rerun and no clean final model-difference claim. Raw configured-run scores remain visible with that
confound; the four untruncated development comparisons are unchanged. Frontier50–60 remains unmet,
expert insurance/prose validation stays open, and no heldout answer tunes this generation.
No score forcing or historical regrading is introduced. Earlier generation-b score91.67 was
superseded for source-placement measurement error; it is not the current c Sol result. Substantive
errors remain separate from protocol, source-placement and still-pending expert validation.

The extended c [holdout audit](../../../insurance-bench/results/meta/v07c-extended-holdout-failure-audit.json)
records five complete three-case references: **Astra-high 100, Sonnet 4.6 67.02, GPT-OSS 120B 4.76,
GPT-OSS 20B 3.57 and Haiku 4.5 18.18**. Astra achieves all-pass 3/3 and actual current feasible optimal
reviewed writes 3/3; the other four achieve 0/3 on each measure. None of these five panels has a
critical failure or output truncation. Low protocol/work-product scores do not establish general
insurance incompetence; inspect substantive findings, terminal product and tool history separately.
These configured-run observations do not replace the original Sol/Luna panels or establish an
industry ranking. The Astra ceiling also leaves the frontier target unmet.

Qwen 235B development completes three cases at 43.38. Qwen 32B has no scored terminal episodes after a
provider ValidationException; its exact cause is unknown and no zero ability score is reported.
Their advertised 8K output maximum differs from the frozen 16384 request, even though Qwen 235B calls
were accepted. Both are excluded from clean resource-matched comparisons. New Qwen 32B/235B and
DeepSeek holdouts were [deferred before inference](../../../insurance-bench/results/meta/v07c-extended-provider-constraints.json)
for that mismatch, with existing dev outputs retained. AWS expired-SSO failures remain historical;
existing-profile access has recovered. Latest Sonnet 5/5.5, Opus 5.5 and Grok 4.7 return AccessDenied
in [fresh access-only probes](../../../insurance-bench/results/meta/v07c-extended-access-probes.json).
Gemini's reviewed pinned adapter ran [registered Flash](../../../insurance-bench/results/meta/gemini-flash-access-probe.json)
and [Pro](../../../insurance-bench/results/meta/gemini-pro-access-probe.json) access-only probes; both
are **access-unconfirmed / existing-login-required**. Public pins and auth-file existence checks
passed, but required existing login/tier/project admission failed. No onboarding, retry, fallback
or ability inference occurred; each $0.032768 conservative reservation remains in the shared ledger. Kimi retains incomplete historical
coverage and no headline score.

The prospectively [registered Astra profile](../../../insurance-bench/results/meta/v07c-astra-registration.json)
uses exact `gpt-6-astra` high and configured standard input/output rates$10/$50 per million tokens.
It completed the predeclared final three-case reference; access and performance evidence are
separate. The [historical internal total-cap amendment](../../../insurance-bench/results/meta/v07c-budget-amendment-2026-10-04.json),
recorded in `556ce30a`, raised the cap to$75 without resetting the$20.20268017000003 reserved at
adoption. The extended audit records $33.5775521875 at 21:39:51 UTC; both retained Gemini reservations
brought the pre-v0.8 ledger to $33.6430881875/$75. Conservative reservations
and rate-based estimates are not invoice amounts. Budget expansion does not authorize frozen-source
mutation, historical regrading or holdout-driven case/scorer tuning.

## Superseded evidence candidate v0.8 and separate v0.9

The [v0.8 evidence candidate](difficulty-calibration-v0.8.md) is **paused/superseded**. Its first
Sol-high development dispatch completed four scored tasks out of six, then reached a provider
300-second timeout on the fifth. Incomplete coverage already prevented a panel headline or clean
comparison; the subsequent [trace audit](../../../insurance-bench/results/meta/v08-development-failure-audit.json)
identified a common source-propagation fault, documented in the [new finding](../../../insurance-bench/results/meta/v08-cross-source-measurement-finding.json).
Author annotations and pre-paid independent derivation had matched the same incomplete
per-proposition decomposition, overlooking joint implications from the required response.
In evidence-brief dev1 Q9, the required current
custodian response establishes original capture time, while the frozen gold still labels the
proposition unresolved. The model's supported answer is defensible. The raw 92.78 case grade is
therefore **not capability evidence**. No headline, effort/tier contrast or achieved difficulty is
claimed from v0.8.

The native [run](../../../insurance-bench/results/2026-10-04T22-01-56-859Z-gpt-6.1-sol-high-baseline-evidence.json),
source/gold, prior reviews and audits remain unchanged. The report keeps the run in historical
details as superseded and suppresses its ability scores. There is no retroactive grading repair.
The predeclared contract was macro completed-task success with unchanged 40/25/25/10 weighted
partial diagnostics; changing a metric does not establish the earlier weighted 50–60 target.
Limits were 20 turns, 16384 inclusive output tokens per call and a 300-second provider deadline.
Professional meaning/prose validation remains open; engineering reviews did not detect this
cross-source interpretation fault before paid inference.

The [separate v0.9 investigation candidate](v09-design-candidate.md) is implemented in isolated
cases, engine, runner, provider snapshot and CLI modules. Its executable engineering controls pass;
independent non-author findings were repaired and bounded Opus repair review passes; committed registration/freeze and paid evaluation remain pending.
There are no v0.9 ability scores. The [source audit](../../../insurance-bench/results/meta/investigation-source-audit-v0.9.json)
binds source fingerprint `7b8ed81c9a0a0c546205e58cdeb80bc3ce159e7801f2db22c5358eb6e1543cae` and
corpus `b8735f0158297b64a250cdecdcb0fffda42fb85f1fd30e3c07ff5ec45f81d2f5`: 72 current-source
snapshots, 1,152 factual outputs, 1,292 sufficient proof paths and 12 actual full-tool oracles scoring
100. These are engineered/oracle controls, not paid model results or insurance-expert validation.
The [bounded runner/report review](../../../insurance-bench/results/meta/investigation-runner-independent-review-v0.9.json)
verifies projection, transport, budget/admission guards and metric presentation; full independent
domain review remains open. The prospective
separate provider snapshot uses 20 turns, 600-second requests, 16384 inclusive output tokens for
OpenAI and 8192 for Bedrock, with unequal cross-provider allowances disclosed; old frozen providers
remain unchanged. The design fixes six conditions on the first dev case in each family (three anchors), then
first-holdout-per-family Sol/Astra high panels, subject to reviewed committed release and budget
controls. All eight panels retain the conservative $34.25 plan forecast. Three single-attempt
headline units have 33.33-point resolution, so they cannot localize a 50–60 difficulty range.
Current-source audits check that resolving responses and both scoped changes propagate into every
affected conclusion and proof; independent review and the paid failure audit remain required.
The shared ledger now records **$34.6515821875 reserved/$75**,
including retained uncertain-call reservations, with no reset. The frontier 50–60 target remains unmet.

Current local verification passes `npm run check` and **52 focused v0.9 tests**: 12 case, 17
engine, four runner, two provider and 14 report controls. Default `npm test` twice failed the
existing Jev three-second timing threshold under concurrent load (9.4/5.48 seconds). Isolated Jev
passes 13 tests; serialized legacy passes 1,168 in 48.58 seconds. Architecture/web runs are pending;
the earlier full coupled-suite pass and CI `125a5271` are historical evidence. CA-IB02/CA-IB03 retain
exact accepted coupled artifacts; the changed report still requires new preview/Chrome acceptance.

### Current-source investigation contract (IB-01, IB-03–IB-05, IB-14)

The v0.9 generator defines 12 fabricated cases, seed 90419, in three correlated families: coverage
review, evidence brief and fraud referral. Each family has two dev/two holdout cases. The concrete
contract is in [`investigation-cases.ts`](../../../insurance-bench/investigation-cases.ts) and
[`investigation-engine.ts`](../../../insurance-bench/investigation-engine.ts); all clauses are
fictional internal collection rules. Current cases contain one policy pack per activity. Selecting
among independent competing packs for the same activity is outside this corpus's verified scope.

Agents must resolve asset/actor/site labels and scoped signed authority at each event instant, using
inclusive-from/exclusive-to intervals. Upload order alone has no authority. Eligible explicit
supersession is limited to its declared entity/predicate or pack/activity; conflicting eligible
values remain unresolved, unavailable differs from false, and copies are not independent witnesses.
The highest eligible signed effective policy revision controls; conflicting top revisions leave
policy unknown. Published all/any/not conditions use three-valued logic. A true clause becomes
applicable only with a resolved requested subject and qualified custodian; it requires the exact
obligation/event/subject/material/custodian and elapsed-UTC collection period.

The public source-request lifecycle is draft, supplied approval, synthetic dispatch, actual receipt
and receipt review. Its response joins the complete current inventory and can affect every
conclusion. Two provided packet reviews announce scoped corrections; agents must reconcile the full
current sources, save all 16 public fields and the exact scoped request set, classify historical
approvals by actual supporting operands, then obtain the third current internal review and record
handoff. A current extra reference alone cannot preserve an unrelated approval. Human workflow pins
remain authoritative. Exactly one follow-up uses the public owner/kind and reading clock plus
90 minutes. Stale writes are recoverable; external finalization or fabricated human approval is
critical. No real communications, payment, coverage or fraud action is executed.

Evidence accepts one sufficient current row/version certificate, including semantically equivalent
proof alternatives and extra valid current-read sources; no exact quotations or expert memo quality
is graded. Macro completed-task success is the prospective v0.9 headline; 40/25/25/10 weighted credit
remains diagnostic. `workflow:currentRequests` grades semantic scoped-request correctness;
`workflow:handoff` records actual structural completion and cannot certify all facts or optimality.
Evidence and factual criteria are dependent, so they do not count as independent reasoning failures.
The runner exposes only public assignment/current tool state, not stored gold or future updates.
Exact model/effort, source/corpus/prompt/limits and native finish/truncation metadata remain bound.
Provider/budget failures are unscored; incomplete panels have no ability headline; truncation
invalidates clean comparisons while preserving raw configured observations. Paid development and
fresh holdout dispatch require reviewed committed registration and separately audited holdout release.

The coupled plan occupies one current-state workflow criterion; a wrong selected plan alone loses
approximately 3.57 weighted points. Incorrect optimum facts can also affect facts/evidence/draft
credit, but headline differences cannot be attributed chiefly to optimization. Report actual
feasible-optimal written outcomes separately. Shared source bundles correlate factual and evidence
credit; repeated capacities and a common three-family occurrence structure limit independence.
Single-attempt comparisons support weak descriptive ranking, and no expert prose/legal quality is
graded. Passing source tests/review does not establish model difficulty, effort separation, industry
validity or the 50–60 target.

Historical superseded v0.8 pre-paid engineering evidence: [independent Opus review](../../../insurance-bench/results/meta/evidence-independent-opus-review-v0.8.json) and [verification receipt](../../../insurance-bench/results/meta/v08-prepaid-verification.json). Generated documents remain version1; invalid-version controls are engineered validator tests, not source replacement episodes. Evidence accepts a sufficient certificate with extra valid current references; citation precision and arbitrary prose quality are ungraded.

## Current allocation and transport conditions (IB-12–IB-15)

[V0.11](v11-design-candidate.md) and [V0.12](v12-design-candidate.md) are separate frozen
allocation environments: nineteen current-source facts, eight recorded business fields, eighteen
proposal components and three phases. V0.12 additionally qualifies prerequisites, exclusions and
cycles through current signed source rows. Individual eligibility and whole-plan feasibility are
separate; accept every feasible optimal tie and require an actually recorded current optimal plan.
Both retain the existing all-criteria completed-task macro headline and diagnostic partial credit.
The [registered V0.12 screen](v12-development-plan.md) selects three matched development cases,
once per model. Its score resolution is33.33 points; it cannot establish continuous50–60 calibration.

The final [V0.12 native audit](../../../insurance-bench/results/meta/v12-development-independent-audit.json)
approves grading consistency under the frozen adapter conditions, not professional validity.
Both high-effort profiles score66.67 task success/95.34 diagnostic and fail the same current-packet
eligibility distinction. Their tie supplies no model-tier separation. Source, gold, traces and
prior generations remain unchanged; actual current outcome, dependent criteria and recovered
interface errors must remain visible beside each score.

IB-14 additionally has an **open conversation-transport gate**. The
[independent phase diagnostic](../../../insurance-bench/results/meta/response-phase-transport-independent-review.json)
confirms that the frozen OpenAI adapter joins all assistant text blocks and loses output-message
boundaries and phase metadata. Saved strings cannot distinguish separate valid commentary/final
messages from malformed final text. Recovered interface errors therefore establish neither pure
model JSON failure nor a causal insurance-reasoning score loss. OpenAI recommends preserving
assistant phases in follow-up requests ([API contract](https://developers.openai.com/api/reference/resources/responses/methods/create)).
A future, separately reviewed and frozen transport must retain visible assistant-message
IDs/types/phases/status and text-part boundaries, define action parsing by message phase explicitly,
and preserve that conversation structure on replay. Test commentary plus a valid final object,
multiple output messages, absent legacy phases, refusals and truncation before matched new runs.
Current observations remain configured model-system results; no historical trace or grade is repaired.
Representative independent insurance cases, effort/tier replication and expert validation remain
required before accepted calibration or general model rankings.


## Composite reference site contract — IB-16–IB-18

- **IB-16 — Composite computation/provenance.** Canonical fixed weights are25/15/20/20/20 for legal-agent/legal-reasoning/documents/professional-work/insurance-workflows. A complete score requires exactly one eligible observation in every positive-weight component; ambiguous/excluded/missing evidence cannot be imputed or renormalized per model. Numeric missing-data bounds are not confidence intervals. Custom weights normalize globally and remain separate from the canonical column. Source/Our Runs controls recompute observations and coverage; exact publisher profiles and harness differences remain attributable. Published data availability is not runtime API access.
- **IB-17 — Documentation/runability.** `/benchmarks/` documents primary sources, native metrics, grading, public/subset/private/local access, licenses and solver/judge needs. Public Harvey LAB cannot reproduce private Vals holds;220 public GDPval tasks do not reproduce1320 original tasks or historical expert judgments; automated rubrics use a separate metric. OmniDocBench and OCRBench v2 declare research-only/noncommercial dataset use; code licensing does not override those statements. Unpaid research may qualify, but commercial-use boundaries are undefined; no automatic exclusion by company affiliation or clearance by absence of sale. LegalBench-RAG/OCRBench/FinQA are diagnostics, not missing canonical replacements.
- **IB-18 — Static protected acceptance.** `/`, `/benchmarks/`, `/scores.json`/assets and byte-preserved `/research.html` deploy as static files/config only, with no app DB/functions/provider/secret/live-data use. New commit-bound protected Chrome acceptance CA-IB05 is required; CA-IB04 does not cover this changed page. Check source-qualified rows/nulls/bounds, global custom weights, actual source-filter recomputation, documentation/research links, keyboard/reload/mobile/protection/console/network and served/build integrity.

The [current design](composite-design.md) and build/source receipts define the snapshot; its212 profiles/269 observations contain no complete five-component canonical score. This is an evidence reference, not a validated model ranking or accepted insurance capability benchmark. Historical synthetic scores, frozen plans, criteria and traces remain unchanged.

Budget correction for this current contract: the historical$75 ledger ceiling was internally adopted after the user asked to increase budget without explicitly naming$75. It is not a verified bill or an OpenAI/Bedrock/Vercel limit. Frozen amendment/ledger history is retained; no new cap or inference authority follows from it. The composite page build dispatches no paid model/judge calls.

## Matched self-run contract — IB-19–IB-22

- **IB-19 — Common runnable panel.** A separate 32-task, fixed 25/15/20/20/20 matched cohort uses pinned public legal subsets/adaptations and original fictional document/professional/native tasks; it does not reproduce the private/native reference composite. Exact counts, metrics, licenses and calibration limits are in [matched self-run design](matched-selfrun-design.md).
- **IB-20 — Configured model/effort execution.** Six exact requested OpenAI IDs × low/high/max use existing ChatGPT CLI sessions with bounded parallelism, no silent substitution/API fallback, public-only context, preserved final-message metadata and fail-closed transport. Actual candidate/jury usage is separate; cost and missing observed provider identity remain unknown.
- **IB-21 — Freeze and evidence admission.** Commit prospective conditions before dispatch. Hash exact tasks, inputs, grader and code; claim calls exclusively, resume only unattempted slots, and publish only regraded durable evidence. Arbitrary summary JSON, raw private answers and hidden phases are excluded. Separate `/self-runs/` needs CA-IB06 protected real-Chrome acceptance.
- **IB-22 — Calibration and external handoff.** Register hypotheses before results, examine ceilings/tier/effort discrimination without post-hoc task changes, and retain limitations. Answer-free Claude/Google handoffs preserve source notices and identify unsupported IDs/efforts and controller requirements.
