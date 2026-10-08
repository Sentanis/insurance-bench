# Insurance Bench implementation status

- Feature: [`README.md`](README.md)
- Contract: [`specification.md`](specification.md)
- Status: **new composite reference protected preview accepted, IB-16–IB-18/CA-IB05 passed for static scope, repository integration pending; historical pilot mixed: v0.9 and JSON panels independently audited; v0.10 both development panels independently audited, frontier ceiling persists; v0.11 all four development panels terminal and fully audited; v0.12 both development panels independently audited/tied, discrimination and calibration unmet; difficulty/tier/phase/expert gaps open; CA-IB04 static-report acceptance passed**
- Last reviewed: **2026-10-07 UTC**

| ID | Requirement | State | Implementation evidence | Verification evidence |
| --- | --- | --- | --- | --- |
| IB-01 | Fabricated source and isolation | Verified | [`cases.ts`](../../../insurance-bench/cases.ts), [`tools.ts`](../../../insurance-bench/tools.ts), [`runner.ts`](../../../insurance-bench/runner.ts); invented in-process records, no app data imports | [`architecture tests`](../../../test/architecture/insurance-bench.test.ts): deterministic corpus/closed source anchors; runner tests cover rubric exclusion; source import inspection confirms standalone composition |
| IB-02 | Six agentic families | Verified | [`cases.ts`](../../../insurance-bench/cases.ts): 24 cases, two development/two holdout per six families, distinct conditional mechanics | Architecture corpus integrity/oracle-grading controls pass; genuine six-family GPT development outputs in [`experiments.md`](experiments.md) |
| IB-03 | Simulated tools and authority | Verified | [`tools.ts`](../../../insurance-bench/tools.ts): list/read/save/follow-up/proposal, denied external actions; scorer requires exactly one correct follow-up | Architecture and runner tests reject external attempts/injection, missing outcomes and source laundering; focused suite passes |
| IB-04 | Quantified deterministic score | Verified | [`score.ts`](../../../insurance-bench/score.ts): 40/25/25/10, critical-zero, family macro, all-pass | Architecture tests cover guessed facts without evidence, invented quotes, critical failures, extras/duplicates and aggregation; independent engineering review verified mechanics |
| IB-05 | Versioned genuine artifacts | Verified | [`runner.ts`](../../../insurance-bench/runner.ts): task/source/prompt hashes, criteria, usage, finish reason and trace; [`freeze manifest`](../../../insurance-bench/freeze-v0.2.json) | Runner/provider tests pass; inspected genuine GPT artifacts and freeze manifest; old-loaded H6 loop artifact excluded because disk hash differed from loaded accounting code |
| IB-06 | Reachable current model panel | Verified reachable subset; gaps open | Exact provider IDs, durable raw/native artifacts and access probes | Historical v0.2 reachable panel retained. Extended c complete Astra/Sonnet/OSS120/OSS20/Haiku references; Qwen235 dev diagnostic and Qwen32 unscored provider failure. Latest Anthropic/Grok denied; Gemini access-unconfirmed / existing-login-required; Kimi incomplete |
| IB-07 | Controlled hypothesis comparisons | Verified | Prompt variants in [`runner.ts`](../../../insurance-bench/runner.ts), comparison commands in [`cli.ts`](../../../insurance-bench/cli.ts), [`ledger`](experiments.md) | Matched six-case genuine GPT baseline/H1/H2 runs each 98.96/83.33%; null gains retained. H4 document-routing controls pass; H6 fresh-process Qwen/DeepSeek comparison completed; weighted versus all-pass conflicts and tentative DeepSeek H2 gain recorded |
| IB-08 | Frozen holdout and uncertainty | Verified | Disjoint IDs and frozen v0.2 generation in [`manifest`](../../../insurance-bench/freeze-v0.2.json); repeat-preserving runner | Corpus separation tests pass. GPT holdout completed: 97.88, 19/24 all-pass, 0 critical; repeated results/strict-format false negative documented in ledger. DeepSeek/Qwen/GPT-OSS complete 12-case holdouts and GPT repetition variation recorded; strict-format limitations disclosed. Claude 4.6 complete 12-case rerun recorded; no holdout-driven edits |
| IB-09 | Bounded approved spend | Verified | Shared historical ledger/reservation guards; internally adopted ceiling, amount-specific authorization not established | Snapshot after both JSON panels: $63.128157887500016 reserved/$75, including retained uncertain-call reservations; JSON01/02 token-rate estimates total$0.3731838. Both v0.10 panels are now terminal; their later checkpoint is$67.52235448750021 reserved/$75, leaving$7.4776455125. The later post-v0.11 panel01 checkpoint is$69.76839048750024/$75, leaving$5.2316095125. The canonical post-V0.12 checkpoint is$73.49224838750004/$75, leaving$1.5077516125; another$2.50 pair does not fit. These are content-free checkpoints, not invoices or live balances. Earlier audit/Gemini/holdout snapshots remain historical; no reset or invoice claim |
| IB-10 | Protected reviewable report | Verified — exact protected static synthetic report, CA-IB04 | Static report with panel separation, escaped caveats and invalid-run suppression | Historical fourteen-report-control receipt covers v0.9 native metric and structural outcome separation; the earlier combined-delta source was independently approved at bbc0b2c5 (23 focused/30 independent controls); the new V0.12 report-builder role guard is independently approved through10 in-memory controls/direct strict compilation, and a real-builder attempt later exposed the legacy V0.9 holdout freeze/source-versus-release binding defect. Report admission-only repair is independently approved and the actual static builder passes; grading is unchanged and publication/protected preview/Chrome acceptance subsequently passed for the exact static synthetic artifact at1a543f26, with [CA-IB04 receipt](../../../insurance-bench/results/meta/preview-acceptance-v12-research.json). [CA-IB03 receipt](../../../insurance-bench/results/meta/preview-acceptance-v0.7c-extended.json) verifies extended c at 901c0218; seven hold/two dev rows, details/history/keyboard/reload/mobile/protection/integrity checks pass. This predates the v0.8 supersession and v0.9/JSON/V10/V11 reporting updates; CA-IB04 now passes at deployed1a543f26: exact protected static-report deployment and Chrome evidence are recorded in the new receipt; expert validity/AWS staging remain separate |
| IB-11 | App isolation and living docs | Verified | Feature set; master/architecture/PRD/logic/daemon/schema-comment updates; isolated `scripts/insurance-bench.ts` entrypoint | Source import/diff inspection and `npm run check` exit 0; no app API, database migration or worker behavior changed |
| IB-12 | Substantive difficulty calibration | In progress — target unmet | Frozen c observations; superseded v0.8 history; [separate v0.9 design](v09-design-candidate.md) | Sol/Astra c ceiling100. v0.8 first high dispatch 4/6 scored then 300s timeout; Q9 source-propagation false grade invalidates capability use. No v0.8 headline or contrast. v0.9 frozen at cf4075d6; six panels/18 episodes independently audited: Sol high/low and Astra high macro100, Luna low/high macro0 with weighted33.89/58.79 and protocol/proof/lifecycle confounds; verification macro100 with descriptive zero score gain; fresh holds separately released74b40433: Sol/Astra100/100, all six episodes independently audited. JSON01 audited0/51.35 with zero malformed JSON;02 terminal0/72.40, final audit approved. V0.10 both six-case panels fully audited: Sol-high100/100, cost$3.825038; Luna-high0/67.56, cost$0.5691586; v0.11 committed at2e85: all four development panels/24 episodes terminal and independently audited, no issues/pending; v0.12 frozen774a4c5 and both development panels terminal/audited/tied66.67 macro/95.34 diagnostic, discrimination guidance failed; target remains unmet |
| IB-13 | Matched effort and family tiers | Matched configured OpenAI dev; phase provenance limited | Exact-ID c OpenAI dev; extended native references; [resource constraints](../../../insurance-bench/results/meta/v07c-extended-provider-constraints.json) | Four metadata-compatible configured OpenAI dev comparisons retained; phase provenance limits causal model attribution; phase provenance limited comparisons retained; Luna original final truncation bars clean tier contrast. Five references complete: Astra 100/Sonnet 67.02/OSS120 4.76/OSS20 3.57/Haiku 18.18. Qwen235 dev 43.38 and Qwen32 unscored excluded from clean comparisons due advertised 8K/requested16K; deferred fresh Qwen/DeepSeek holds |
| IB-14 | Semantic measurement audit | Native engineering consistency audited; phase-preserving transport and expert validity open | [Current-source audit](../../../insurance-bench/results/meta/investigation-source-audit-v0.9.json), [non-author derivation](../../../insurance-bench/results/meta/investigation-independent-audit-v0.9.json), [runner/report review](../../../insurance-bench/results/meta/investigation-runner-independent-review-v0.9.json); prior false-grade generations retained | Source 7b8ed81c/corpus b8735f01: 72 snapshots, 1,152 facts, 1,292 proof paths, 12 full-tool oracles at 100; 52 focused tests pass. Non-author runtime review exposed post-finish intent and future approval provenance defects; both were repaired, re-audited and approved by bounded Opus review before paid calls; independent native audit approves all6 panels/18 terminal episodes without false grades. New JSON/interaction admission approved; third v0.10 interpreter covers72 states/1152 fields/1267 alternatives/12 oracles, separate Opus review is partial1/12task+fraud spot-check. New v0.11 source9c8a799a/corpus4334b018 independently agrees on36states/684facts/9,437,184subsets/23tie oracles; runtime/controller engineering reviewed, Opus engineering-approved; v0.10 both panels/all12 episodes independently audited, exact41-criterion replay with no false grades; v0.11 final native audit approves all four panels/24 terminal episodes without issues or pending coverage; v0.12 final native audit approves both panels/all6 episodes and48 criteria per episode, no source/grade inconsistency; transport attribution remains open; professional validity remains open |
| IB-15 | Fresh freeze and holdout | V0.9 development and fresh holds independently verified | Immutable c final freeze; historical native v0.8 run; separate v0.9 development | Original c observations and five complete extended references retained. Luna c truncation bars clean original tier contrast. No v0.8 holdouts or valid ability headline; v0.9 committed development freeze cf4075d6 binds source7b8ed81c/corpus b8735f01; all six development panels independently audited; separate release74b40433: Sol/Astra100/100 with independent6episode audit. CA-IB03 accepts extended c before the later fault update |
| IB-16 | Composite computation and provenance | Static engineering and protected Chrome accepted | [`composite.ts`](../../../insurance-bench/composite.ts), [`data`](../../../insurance-bench/composite-data.json), renderer/client and [`design`](composite-design.md) | [`build receipt`](../../../insurance-bench/results/meta/composite-build-receipt.json):212 profiles/269 observations/0 complete canonical scores; fixed25/15/20/20/20, global custom normalization, source-qualified identities, missing/ambiguous/excluded states and bounds. 14 focused/16 benchmark architecture/1,308 legacy controls and full/direct strict typechecking PASS; [independent source/engineering review](../../../insurance-bench/results/meta/composite-independent-review.json), [Claude review](../../../insurance-bench/results/meta/composite-cross-provider-review.json) and [CA-IB05](../../../insurance-bench/results/meta/composite-preview-acceptance.json) approve this static scope |
| IB-17 | Benchmark documentation and self-run boundaries | Guide checked in protected Chrome | [`composite-docs.json`](../../../insurance-bench/composite-docs.json), `/benchmarks/`, [`design`](composite-design.md) | Eight sources distinguish public/subset/private/local, native metrics, solver/judge/access and data licenses; no benchmark/model call from the page. Public LAB does not reproduce private Vals cohort; GDPval automated rubric differs from expert rate; diagnostic sources never fill canonical gaps |
| IB-18 | Composite protected static Chrome acceptance | Passed static preview — CA-IB05; integration pending | [`builder`](../../../scripts/build-insurance-bench-composite.ts), `/`, `/benchmarks/`, `/research.html`, static data/assets | [CA-IB05 receipt](../../../insurance-bench/results/meta/composite-preview-acceptance.json): commit fbffc114, [protected preview](https://insurance-bench-24ggnoj3l-sentanis.vercel.app), six static files/no functions; search/weights/source recalculation/exclusions/docs/keyboard/reload/390px/archive/protection/served integrity pass. Standalone JSON navigation blocked by client; embedded dataset verified. Prior CA-IB04 covers the historical report |


Current composite local verification:14 focused controls, full typecheck and targeted strict browser-client checks PASS. Legacy1,308/1,308 and benchmark architecture16/16 PASS; source/engineering and Claude reviews approve the static feature. CA-IB05 passes for the exact deployed artifact. Default architecture38 failures/3,782 passes/48 skips, separate web5 failures/1,018 passes, inherited dependency advisories and GitHub CI billing block keep repository integration open. No blanket full-suite or test:ci pass is claimed. These are new-page checks, distinct from the historical receipts below.

Current local verification: **full typechecking and51 focused controls pass**. The [post-v0.12 serialized legacy receipt](../../../insurance-bench/results/meta/post-v12-serialized-legacy-verification.json) records commit2e85: **1,241 tests pass across208 suites in30.814627 seconds**, log SHAa2dbd71e. The51-focused/full-typecheck receipt remains valid. Earlier43-focused/1,212-test and35-control/1,193-test receipts retain their original conditions; this is a SERIAL run, not a default concurrent-suite pass. The52-control v0.9 receipt remains historical. The default full suite's existing Jev timing failure
under concurrency is retained; no new default `npm test` pass is claimed. Architecture1,679 with
three skips and web815 remain earlier unchanged-source evidence. The [earlier v0.11 verification receipt](../../../insurance-bench/results/meta/v11-implementation-verification.json)
preserves its historical log hashes. These checks establish engineering, not frontier difficulty,
expert validity or changed-report Chrome acceptance.

V0.11 [independent source audit](../../../insurance-bench/results/meta/v11-candidate-independent-audit.json),
[runtime review](../../../insurance-bench/results/meta/allocation-runner-independent-review-v0.11.json)
and [controller review](../../../insurance-bench/results/meta/v11-controller-independent-review.json)
cover source `9c8a799a`/corpus `4334b018`,12tasks/36states/684facts/648 eligibility projections,
9,437,184 independently enumerated subsets and23 actual final-tie oracles. Registration was committed at `2e85` before calls, binding reviewed source `9c8a799a`/corpus `4334b018`. Panel01 Sol-high is terminal at100 macro/100 diagnostic on six cases, estimated cost$2.246036; the earlier incremental audit agreed on6/6 with a1/4 incomplete header. The [final native audit](../../../insurance-bench/results/meta/v11-development-independent-audit.json) now approves all four terminal panels/24 episodes without issues or pending coverage; the earlier first-panel checkpoint is historical. The post01 content-free reservation checkpoint is$69.76839048750024/$75, leaving$5.2316095125; these are estimates/reservations, not an invoice or a live/final balance. The original fixed$6.25 whole-plan forecast remains historical, and further dispatch uses the authoritative shared ledger. No held evaluation is registered. Final V0.11 scores in registered order are 100/100,83.33/97.67,0/84.90 and83.33/97.67; current optimal writes are 6/5/1/5 of 6. The [feature experiment ledger](experiments.md) records exact facts, recovered JSON events, costs and descriptive diagnostic-only contrasts. Sol-high retains a ceiling; no accepted calibration or professional validity follows. The bounded Opus review approves engineering only. All final
optima select only two packages; three labels remain correlated.19fact/8business fields stay fixed,
but18 eligible IDs expand output bytes and public source payloads measure about16.6–17.0KB.

The [historical coupled post-finish audit](../../../insurance-bench/results/meta/coupled-postfinish-independent-audit.json)
finds a same-batch runner-reachable frozen boundary defect but no actual intent after finish in
15runs/39episodes/434turns/976actions or473 supplementary snapshots. No historical native grade
is changed or automatically superseded. Only the new v0.11 snapshot repairs this boundary;
post-finish protected intent now records critical-zero in synthetic controls.

Historical v0.2 verification before the accounting amendment totaled **36 focused passing tests**.
Its broad run encountered unrelated timing failures under load, and the focused Jev rerun passed
13 cases; that earlier failed broad run is preserved as history, not the current check status.
Review evidence and measurement limitations are detailed in [`experiments.md`](experiments.md).
A subsequent accounting-only bounded lock-retry amendment adds a worker-thread regression: **37
focused tests pass**, with post-patch root TypeScript checks passing. Interrupted Claude/Qwen/GPT-OSS holdout artifacts are excluded
from headline results; the fresh full Claude run and preregistered matched H6 fresh-process comparisons are complete.

V0.12 [design](v12-design-candidate.md)/[author receipt](../../../insurance-bench/results/meta/dependency-allocation-author-controls-v0.12.json)
records a conditional new prerequisite/exclusion source/runner/CLI prototype:12 tasks/36states,
18packages/19facts/8business fields,9,437,184 independently coded author-recursion leaves and35
actual final-tie tool oracles. All14 author controls/check/lint pass; frozen repairedv11workflows
remain unchanged. Final plans select4–5components. Sourcebytes increase about19–20%; outputs shrink
with shortIDs. Shared graphs/initial patterns and author-only controls do not establish empirical
hardness or independent correctness. The [full independent source audit](../../../insurance-bench/results/meta/v12-candidate-independent-audit.json)
and [runtime review](../../../insurance-bench/results/meta/dependency-allocation-runner-independent-review-v0.12.json)
approve engineering at source `3591d68f`/corpus `f8e0df62`, with 22 owned controls passing. Source-only
[Opus engineering review](../../../insurance-bench/results/meta/v12-independent-opus-review.json) is now approved with partial hand coverage disclosed in the [experiment ledger](experiments.md). Final typechecking passes after the report-admission typing repair. The separate [report-runtime review](../../../insurance-bench/results/meta/current-report-runtime-independent-review.json) approves the pure helper/source repair; the earlier 21-focused/28-independent checkpoint, full checking and direct ignored-script strict checking remain preserved. The earlier combined-delta report condition was independently approved at source `bbc0b2c5`, with 23 focused and 30 independent controls, full checking and direct-builder strict checking passed. The [new source-only V0.12 report-builder review](../../../insurance-bench/results/meta/current-report-v12-builder-independent-review.json) now approves 10 in-memory controls and direct strict compilation (builder `8288`, review `f168`, [reproduction](../../../insurance-bench/results/meta/current-report-v12-builder-independent-review-repro.txt) `4815`). This does not execute the real builder or publish a report. A later real-builder attempt found a legacy V0.9 holdout freeze/source-versus-release binding defect. Report admission-only repair is now [independently approved](../../../insurance-bench/results/meta/current-report-final-integration-independent-review.json), binding the legacy holdout source/freeze to its separately hashed release parent; benchmark grading is unchanged. The actual static builder passes and generates the report, but publication/protected preview/Chrome acceptance subsequently passed for the exact static synthetic artifact in [CA-IB04 receipt](../../../insurance-bench/results/meta/preview-acceptance-v12-research.json). The [latest local verification](../../../insurance-bench/results/meta/v12-implementation-verification.json) and [reproduction](../../../insurance-bench/results/meta/v12-implementation-verification-repro.txt) record 51 focused controls (22 dependency, 23 report plus admission/JSON controls), current full typechecking and exact source/review hashes. The earlier 1,212-test legacy receipt remains historical; the separate [post-v0.12 SERIAL receipt](../../../insurance-bench/results/meta/post-v12-serialized-legacy-verification.json) now passes1,241 tests/208 suites at2e85, without claiming a default concurrent-suite pass. Controller/registration freeze `774a4c5` preceded both now-terminal development panels. Final native audit approves all six episodes and recorded criteria; no held evaluation was registered. Current findings and transport-attribution limits are recorded below.

| IB-19 | Common 32-task matched panel | Implemented; actual execution running | `selfrun-public-sources.ts`, `selfrun-synthetic.ts`, `selfrun-coordinator.ts`, source receipt | Independent data review verifies25source hashes/66synthetic fields/8PNG pages;17 focused source/data controls pass. No expert validity or live score claimed |
| IB-20 | Exact requested CLI profiles/usage | Verified engineering; actual run active | `selfrun-transport.ts`, coordinator18profiles |23 transport controls and harmless final/tool-canary probes pass; observed provider identity absent; full benchmark dispatch pending |
| IB-21 | Frozen regraded static publication | In progress | Coordinator/builder and `/self-runs/` modules | Independent integration review found real-ID path, canonical jury and arbitrary-summary admission defects; repairs pass11 coordinator/5 UI regressions and full typechecking. Final independent re-review approved,16coordinator/UI controls pass; actual dispatch active, raw-result admission and CA-IB06 pending |
| IB-22 | Calibration/external handoff | In progress | Prospective hypotheses in matched self-run design; answer-free packet builder | OpenAI dispatch active, no complete scores yet; external-provider execution pending; exact availability/effort/controller gaps remain explicit |

## Deviations and open issues

The pilot has no independent insurance-expert calibration. It must be described as an engineering
pilot, not an accepted industry benchmark or a percentage of safely automatable insurance work.
Provider access and exact tested IDs are recorded by actual probes/runs; unavailable candidates
retain their gaps. A synthetic
static preview does not establish production-classified staging acceptance.

The v0.6 pre-paid audit validates the closed fictional policies and implementation, not observed
model difficulty. Final controls cover highest eligible signed endorsement revision, handoff closure
precedence, substantive enclosure changes, tool-level finalization intent and `Object.hasOwn`
extra-key rejection. Limit-source fields are explicitly `operativeLimitSourceId` and
`controllingLimitSourceId`. The [initial adversarial review](review-v0.6.md) and
[pre-repair audit](../../../insurance-bench/results/meta/workflow-source-audit-v0.6-before-semantic-review-repair.json)
remain historical. Shared source bundles can make evidence credit track facts; arbitrary memo
prose is not semantically graded. Paid v0.6 low panels began and were interrupted at 02:48 UTC for
the undocumented business-update kind. [Generation b](difficulty-calibration-v0.6.md#pre-holdout-measurement-repair-generation-b)
stated `kind` equals the public family and exposed `acceptedKind` in the recoverable error.
Both low reruns completed: Sol100/Luna94.37; the
[development failure audit](../../../insurance-bench/results/meta/v06b-development-failure-audit.json)
remains raw historical evidence. Later ambiguity in `remainingAuthorityScopes` superseded the
weighted candidate; high panels were interrupted unscored and no v0.6 holdout ran. Original v0.7
and generation-b weighted results are also superseded for disclosed contract/evidence-location
defects, with original raw artifacts and freezes retained. Original Luna had two terminal episodes
and an unscored deadline partial; no aggregate was manufactured for that incomplete generation.

Current generation c passed Opus4.8 review, 12 independent controls and all 22 actual optimal-history
paths. Complete dev observations are Sol low/high100/100 and Luna50.90→92.09, with no truncation,
transport or false-grade flags in all four panels. These are valid narrow descriptive comparisons;
Sol has no effort gain and remains at ceiling. Fresh final observations under the04:05:29UTC
freeze are Sol100/Luna93.01,57/57 versus54/57facts, all-pass 3/3 versus0/3; both models wrote3/3
current feasible optimal reviewed outcomes. Luna's sameQ2 eligibility omission propagates through
correlated criteria, not independent business failures. Its recovered16k deadline truncation makes
the clean holdout tier contrast unavailable: no interval, selective rerun or clean ranking claim.
The final [audit](../../../insurance-bench/results/meta/v07c-holdout-failure-audit.json), receipt4e0194cc,
checks all six native-hydrated episodes with raw/source bytes unchanged. The frontier50–60 target
remains unmet. CA-IB03 verifies the extended c report at `901c0218`; this predates the later v0.8 fault update, whose next preview acceptance remains open.

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

The user-approved TOTAL cap is $75, with no reset of prior spend. The extended audit snapshot is
$33.5775521875 at 21:39:51 UTC; after both retained Gemini access reservations the pre-v0.8 ledger was
$33.6430881875/$75. Uncertain-call reservations and estimates are not invoices.
Exact-ISO normalization and memo40/reason20 floors remain disclosed. Shared source bundles can
make evidence track facts; arbitrary prose is not expert-graded. Three correlated families and
single attempts support weak descriptive comparisons. A wrong selected plan alone loses roughly
3.57 weighted points, so actual feasible-optimal written outcomes remain a separate measure.

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

The [v0.9 investigation track](v09-design-candidate.md) was admitted after independent repairs
and frozen at commit `cf4075d6`, source `7b8ed81c` and corpus `b8735f01`. Its
[source audit](../../../insurance-bench/results/meta/investigation-source-audit-v0.9.json) covers72
snapshots,1,152 factual outputs,1,292 sufficient proof paths and12 full-tool oracles. These are
engineering controls; the native model observations are recorded separately in the
[development failure audit](../../../insurance-bench/results/meta/investigation-development-independent-audit-v0.9.json).

All six registered development panels are terminal (18 episodes): Sol high/low, Astra high and
Sol-high verify-before-finish each achieve100 macro completed-task success and100 weighted
diagnostics; Luna low/high achieve0 macro success with33.89/58.79 weighted diagnostics. The
independent audit approves all six panels/18 terminal episodes as source-consistent and reports
no false grades. Luna failures include actual JSON serialization, insufficient
proofs, wrong fields and incomplete current handoffs, so weighted differences are not a pure
reasoning effect. The reminder adds zero score improvement descriptively; different variant
harness identities preclude a normalized causal comparison. The
[development comparisons](../../../insurance-bench/results/meta/v09-development-comparisons.json)
and [experiment ledger](experiments.md) retain coverage, costs and exact conditions. V0.9 fresh holdouts were
separately released at `74b40433`; Sol-high and Astra-high are both terminal100 macro/100 weighted across three fresh cases each.
The independent holdout audit verifies all six episodes without false grades or truncation.
Professional validity remains open.

Frozen limits remain20 turns,600-second requests,16384 inclusive output tokens for OpenAI and8192
for Bedrock; historical provider conditions remain unchanged. The macro endpoint has33.33-point
resolution on three correlated single-attempt anchors, so it cannot localize50–60 difficulty.
Frontier ceilings and the Sol high/low null leave the target unmet. The historically adopted shared ledger ceiling
remains$75 without a reset; current spending and reservations belong to the authoritative ledger
and dispatch receipts, not a documentation snapshot. The separate
[JSON diagnostic](v09-json-diagnostic-plan.md) and [interaction candidate](v10-design-candidate.md)
are registered/frozen at `bf83e682`. JSON01 is terminal/audited0 macro/51.35 weighted with zero
malformed JSON;02 is terminal0/72.40 with a final turn-limited incomplete task. Both final
independent audit approves all six episodes; paired per-case weighted diagnostic difference is21.04points while both headline scores remain0. The three-case descriptive bootstrap interval spans−9.37 to40.42, so the sample does not establish a general effort advantage. V0.10 source `a6922f85`, corpus
`80077360`, has both six-case panels terminal/fully audited: Sol-high100/100, estimated cost$3.825038; Luna-high0/67.56, cost$0.5691586, three completed and three incomplete at20 turns. No parse/truncation/provider/model/spend issues or false grades are reported. The [paired comparison](../../../insurance-bench/results/meta/v10-development-comparisons.json) records32.45 diagnostic/100 macro points, six wins and descriptive three-family interval15.10–43.33; no general ranking follows. The two-panel$5.50 forecast is historical; no held evaluation is registered. V0.11 source `9c8a799a`, corpus `4334b018`,
has full source/runtime/Opus/controller engineering approval and [registration committed](../../../insurance-bench/results/meta/v11-registration.json) at2e85 before calls. Sol-high01 is terminal100/100, cost$2.246036, independently consistent on6/6; the final four-panel native audit now approves all24 terminal episodes without issues or pending coverage, superseding the historical1/4 incomplete checkpoint.
V0.12 graph source/runner/CLI has engineering approval at3591d68f/f8e0df62 and committed774a4c5 freeze; both high-effort tier panels are terminal/audited at66.67 macro/95.34 diagnostic, tied. No held evaluation was registered; calibration/discrimination remain unmet.
Professional insurance validity and the frontier target remain open.

Development/holdout IDs are separate but templated scenarios remain correlated. Current c final
panels ran once; historical v0.2 GPT repetitions show observed variation, not population confidence.
No mock/oracle outputs may appear as real leaderboard rows, and no scientifically accepted
industry-benchmark claim is established.

## Implementation history

| Date       | Change                                                                                      | Requirements | Evidence                                                                  |
| ---------- | ------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------- |
| 2026-10-03 | Frozen v0.2 synthetic harness; genuine development null-results; provider/holdout/Chrome acceptance in progress | IB-01–IB-11  | 36 focused tests; `npm run check`; freeze manifest; experiment ledger; remaining acceptance rows above |

## Initial Chrome report check

Parent-recorded initial Chrome acceptance used the dedicated SSO-protected deployment
`https://insurance-bench-10surx6q9-sentanis.vercel.app` from first implementation commit `d7634d92`.
Chrome rendered the report, expanded GPT experiment details and checked a 390-pixel-wide viewport:
document width was 390, with the 831-pixel results table contained in a 358-pixel horizontal-scroll
region. Console/network checks reported zero errors. This is historical initial-deployment evidence;
final preview acceptance below closes CA-IB01.
The dedicated first deployment was automatically production-classified by Vercel, not an AWS
staging or production claims-application release.

## Final Chrome preview acceptance

**Verified 2026-10-03 22:40:38 UTC** through the real Chrome extension against
[the protected final preview](https://insurance-bench-kg7dli0a0-sentanis.vercel.app).
The [durable receipt](../../../insurance-bench/results/meta/preview-acceptance.json) binds deployed
code **`11778593d85f12f8836472c23954133130c73d77`**, deployment
`dpl_3hdJVgiQPoP5dt7EwfRZEYmjJ1bM`, dedicated project `prj_CqiaZtGLLlPL3q9CKKKAVYFcrMXf`,
READY state and **preview** target. SSO protection covers all deployments; anonymous HTTP returns
302. No claims application alias or runtime was changed.

Chrome displayed six primary rows: five complete model panels plus Kimi with all three headline
metrics unavailable. Clicking Claude details showed facts 97.9, evidence 82.9, workflow 100 and
boundaries 83.3; keyboard Return collapsed those details, and reload retained the report. At a
390-pixel viewport, document width was 390, with the 807-pixel table scrolling within a 358-pixel
container and no horizontal body overflow. Temporary viewport changes were reset.

Console: **0 errors / 0 warnings**. Reload network contained the report origin, injected
`vercel.live` feedback resources, Vercel JWE resources and a data icon; **no model-provider or
claims-application requests** appeared. Build output contained only `config.json` and
`static/index.html`; the builder removed an injected stale function marker. The local screenshot
hash is preserved in the receipt, while screenshot pixels remain uncommitted.

Historical pilot HTML SHA256 **`5e2d0b26cb215070875fd038e7a44eca79f416e6dd1d73aff8926f363df288bb`**
matched the deployed receipt and its local pilot artifact. **IB-10 / CA-IB01 are verified for that
synthetic engineering pilot.** The changed coupled report has separately verified CA-IB02
deployment/Chrome acceptance below. Insurance-expert calibration, latest unavailable provider access, real-world
benchmark validity and production-classified AWS staging acceptance remain open.


## Coupled report Chrome acceptance

[Receipt](../../../insurance-bench/results/meta/preview-acceptance-v0.7c.json) binds report commit
`b23fb66fff0cc00912dffaaef6dbd9cd7fcfe75f`, protected preview
[insurance-bench-i58xaxzg1](https://insurance-bench-i58xaxzg1-sentanis.vercel.app) and report SHA256
`c47f82256834d8064c77d1d217752512a2ed767f4989726a9102042cef617df4`.
Hosted bytes match the committed report after excluding one163-byte Vercel toolbar injection.
Real Chrome renders two primary rows100/93.01,3/3 coverage each,100% actual optimal outcomes
for both, Luna truncation disclosure, four clean development contrasts and historical evidence.
Current Luna details expose all failed criteria; keyboard collapse and reload pass. At 390px the
page width is390 and table container358, with contained horizontal scroll. Console warnings/errors
are zero; a fresh complete five-request capture uses report/toolbar/data origins, no provider or
claims app. The temporary viewport is reset. CLI verification's self-created automation bypass
was revoked without regeneration; original bypass configuration, all-deployment SSO protection,
anonymous302 and authenticated Chrome rendering were reverified. CA-IB02 is closed for this
synthetic static development report. Frontier difficulty, expert validity, provider completion
and production-classified AWS staging are not accepted by these checks.

The hosted contents are **as of this receipt**, before the approved $75 cap amendment and resumed
reference panels. The earlier URL retains that historical report. CA-IB03 separately accepts the extended c artifact
below; neither receipt accepts the later v0.8 fault update.

Historical superseded v0.8 pre-paid engineering evidence: [independent Opus review](../../../insurance-bench/results/meta/evidence-independent-opus-review-v0.8.json) and [verification receipt](../../../insurance-bench/results/meta/v08-prepaid-verification.json). Generated documents remain version1; invalid-version controls are engineered validator tests, not source replacement episodes. Evidence accepts a sufficient certificate with extra valid current references; citation precision and arbitrary prose quality are ungraded.

## Extended c Chrome acceptance — CA-IB03

The [durable receipt](../../../insurance-bench/results/meta/preview-acceptance-v0.7c-extended.json)
records parent-observed real Chrome acceptance of the protected [extended report](https://insurance-bench-ghxqxmua9-sentanis.vercel.app),
deployment `dpl_6ZrCyVtKLiMV3Q5rCpQbjmSZ6aBM`, code `901c0218d9688705cf2a2c2b4ae5cfffe483d6d7`.
All-deployment SSO remains enabled, anonymous HTTP302/authenticated200 pass, and no bypass key was
used. Seven holdout/two dev rows match source; Astra shows 3/3 all-pass/actual optima and three passed
case details. The 46-row history opens with mouse, closes with Enter and reloads collapsed.
Console errors/warnings are zero. Fresh reload has seven requests on report/Vercel/non-HTTP origins,
with no claims-app or model-provider request. At 390px the document is 390px and 358px table containers
use contained overflow; the temporary viewport was reset.

Source HTML SHA256 `daae4b5b17f65f8e072374ec737fa869be0167a8bedcff67c109a656fcb00873` and served
SHA256 `acc1836486b7cb568882389ab7898bbdaadb33aac36e3319d6a0a5d8e2caf8ec` differ only by a 163-byte
Vercel live-toolbar insertion, SHA256 `9f03d8f7ba42300cb6d7b492e1738e844a462a1a682c63c4284d9f7ac308f4f5`.
Ignored screenshots and their hashes are in the receipt; no screenshot is committed. CA-IB02's
receipt is unchanged. **This accepted artifact predates the v0.8 source-propagation-fault update.**
The later changed-report [CA-IB04](../../chrome-acceptance-register.md) is now accepted for the exact protected static synthetic artifact at1a543f26; its [new receipt](../../../insurance-bench/results/meta/preview-acceptance-v12-research.json) is separate from this historical artifact. Benchmark
validity, achieved difficulty, expert calibration and AWS staging are not accepted by this check.

## Final pre-inference v0.9 repair gate

The independent non-author runtime review reproduced a false100 pass when an otherwise correct
agent emitted `finish` followed by prohibited human signoff in the same action batch. The earlier
qualified static Opus review missed this reachable defect; its raw approval and audit snapshots are
preserved. Protected intent now precedes both finished-state and stale-token guards. A real runner
regression checks both prohibited tools after a complete100 oracle. Initial historical approvals now
refer only to already disclosed sources, without withheld registry-response dependency IDs.

Public absence wording now matches its conjunctive proof requirements; origin IDs are explicitly
provenance rather than a corroboration-count criterion. Canonical certificate alternatives match
across all72 source states. The [composite independent review](../../../insurance-bench/results/meta/investigation-independent-opus-review-v0.9.json)
records the earlier miss, the confirmed runtime rejection, bounded repairs and final Opus repair
approval. All52 focused controls and the final typecheck/lint pass. No paid v0.9 calls preceded these
repairs. The prior author controls and d3aeb/501e source snapshots remain historical.

Functional broad checks passed with declared resource bounds:1168 legacy tests with concurrency1,
1679 architecture tests plus3skips with one worker, and815 web tests with default settings. The
normal full command failed twice on the existing Jev3second wall-clock gate; the default architecture
run had six5second timeouts. Those failures remain recorded and are not described as a standard
`npm test` pass. The final small repairs were separately verified by all52 focused tests and typecheck.

`unresolvedSubjectIds` is empty at the final generation in every current source case, a known
aggregate-field shortcut limitation. Current fixtures use one policy pack per activity and no rule
counts independent source origins. Professional validity and actual calibrated difficulty remain
open. Registration and development freeze subsequently passed at cf4075d6; all six development panels
are terminal and independently approved as source-consistent. Fresh holdouts were separately released at74b40433; Sol-high and Astra-high are both terminal100 macro/100 weighted, independently audited across all six episodes. See [experiments](experiments.md) for the native observations; later engineering-only
candidates do not modify this frozen source or these grades.


## Separate JSON and interaction engineering admission

The [JSON candidate audit](../../../insurance-bench/results/meta/v09j-candidate-independent-audit.json)
binds `107e4af6`, unchanged semantic corpus and private-gold projection. The
[repaired gate review](../../../insurance-bench/results/meta/candidate-prepaid-gate-independent-review.json)
approves current canonical ledger, committed provenance, one-time claims, serial dispatch and fresh
release controls for JSON and interaction candidates; original rejection evidence is retained.
Both development registrations were frozen at `bf83e682`. JSON01 is terminal/audited0 macro/51.35 weighted with zero malformed JSON;02 is terminal0/72.40 with a turn-limited incomplete task and final two-panel audit approved. V0.10 is development-only registered: both six-case panels terminal/fully audited, Sol-high100/100 at estimated cost$3.825038 and Luna-high0/67.56 at$0.5691586. The final independent audit approves all 12 episodes and exact 41-criterion replay without false grades; no held evaluation is registered.

The [full third-interpreter interaction audit](../../../insurance-bench/results/meta/v10-candidate-independent-audit.json)
binds `a6922f85`/corpus `80077360`:12 cases,72 states,1,152 fields,1,267 alternative proof paths,
1,152 empty-proof negatives and12 full public-tool oracles. All checks pass engineering-only.
The [independent Opus review](../../../insurance-bench/results/meta/v10-independent-opus-review.json)
is a separate partial hand derivation of1/12task through four operational phases plus a fraud
spot-check, not exhaustive72-state verification. V0.10 retains one pack lineage per activity and
coverage/evidence share status vectors, so three family labels do not prove independent breadth.
Native JSON is intended to reduce known serialization failures; valid JSON alone does not establish
schema or semantic correctness. Both new conditions use it; v0.10 changes sources and transport
relative to v0.9, precluding a causal difficulty ablation.

The historical35-control/1,193-test [candidate verification](../../../insurance-bench/results/meta/candidate-implementation-verification.json)
retains its exact log hashes. The [historical v0.11 verification](../../../insurance-bench/results/meta/v11-implementation-verification.json)
passes43 focused controls, typechecking, narrow lint and1,212 serialized legacy tests; known
default-suite timing limits remain. Engineering approval does not establish difficulty, expert
validity or changed-report Chrome acceptance. V0.9 fresh holdouts are terminal and independently
audited100/100 for both frontier models; JSON final independent audit approves both panels, with macro0 at both efforts and weighted51.35/72.40, v0.10 both panels are fully audited (Sol-high100/100, Luna-high0/67.56), and v0.11 is committed at2e85 and all four development panels/24 episodes are terminal and independently audited without issues.


Historical V0.12 pre-paid admission preparation (superseded by the completed development findings below): [new prospective development plan](v12-development-plan.md) fixes one high-effort tier contrast, Sol-high then Luna-high on the same three development cases once each, with a$2.50 whole forecast. The parent-confirmed post-V0.11 terminal checkpoint is$72.26526888750007/$75, leaving$2.7347311125 (API estimates/reservations, not an invoice/live balance). The [new controller review](../../../insurance-bench/results/meta/v12-controller-independent-review.json) approves 23 mocked controls and strict compilation at review `c2ab`, controller `a971` and plan `753c`; its [reproducible copy](../../../insurance-bench/results/meta/v12-controller-repro.txt) and [prospective registration](../../../insurance-bench/results/meta/v12-registration.json) now exist. Preparation performed no API call, ledger change or reset. Committed freeze and dispatch-time affordability are still required; no V0.12 ability call or held evaluation exists. Registration-bound [native-audit readiness](../../../insurance-bench/results/meta/v12-development-independent-audit.json) passes 70 mocked metadata controls (source `c62c`, artifact `8de2`), with **zero actual episodes audited**. The [prospective freeze verification](../../../insurance-bench/results/meta/v12-prospective-freeze-verification.json) records this preparation; it is not evaluated ability evidence. Three cases/33.33-point resolution cannot localize50–60 or establish accepted calibration; the engineering design and old frozen conditions stay unchanged.


Current V0.12 development is complete under freeze `774a4c5`. The [final native audit](../../../insurance-bench/results/meta/v12-development-independent-audit.json) and [reproduction](../../../insurance-bench/results/meta/v12-development-independent-audit-repro.txt) approve2/2 panels/all6 episodes and all48 recorded criteria per episode without source/grade inconsistency. Sol-high and Luna-high each score66.6667 macro/95.34 diagnostic, complete3/3 with2/3 all-pass/current-optimal writes; costs are$1.104356/$0.1226235 (total$1.2269795). Their shared B2 amount-only/medical-enclosure eligibility error causes six correlated criterion losses. The tier outcome is tied, failing discrimination guidance;50–60 calibration/professional breadth remain unmet. The [experiment ledger](experiments.md#final-v012-development-findings-and-transport-limit) records exact plans and limitations.

The [response-phase transport review](../../../insurance-bench/results/meta/response-phase-transport-independent-review.json) finds lost phase/block metadata; two recovered Luna protocol events cannot be confidently assigned to model JSON, provider behavior or pure insurance reasoning, and no causal grading impact is established. A prospective phase-preserving matched transport plus representative independent cases and effort/tier replicates is needed before accepted calibration. No historical grade changes. Canonical post-panel checkpoint$73.49224838750004/$75 leaves$1.5077516125 (estimates/reservations, not invoice/live balance); another$2.50 pair does not fit. Report admission-only repair of the legacy V0.9 holdout freeze/source-versus-release binding is independently approved; actual static build passes with27 primary rows/74 retained runs/15 diagnostic contrasts. Publication/protected preview/CA-IB04 acceptance passed for the exact static synthetic report at1a543f26; expert validity and AWS staging/application release remain open. The [final research-report verification](../../../insurance-bench/results/meta/final-research-report-verification.json) records passing controlled test runs, typechecking/lint and the stopped default concurrent architecture attempt; no passing default test:ci claim is made.


Current report closeout: the [final integration review](../../../insurance-bench/results/meta/current-report-final-integration-independent-review.json) approves admission-only parent binding (helper42463db5/reviewe62464;18 mocked/25 focused controls and direct strict compilation). The [real build receipt](../../../insurance-bench/results/meta/final-research-report-verification.json) confirms27 primary rows,74 retained runs and15 diagnostic contrasts; static output was generated and subsequently passed publication/protected preview/CA-IB04 acceptance at1a543f26; expert validity and AWS staging/application release remain open. Integrated legacy1292/216, controlled architecture3582 pass/45 skipped and web985 pass, full typecheck/lint/direct strict and delivery-policy checks pass. The default concurrent architecture attempt stopped at exit143 after timeouts and a pre-merge portability snapshot failure; no passing default test:ci claim is made. Exact logs, HTML hash and conditions belong to the [experiment ledger](experiments.md#final-static-report-build-and-controlled-verification).


## Protected static research-report Chrome acceptance — CA-IB04

The [final Chrome receipt](../../../insurance-bench/results/meta/preview-acceptance-v12-research.json) passes on2026-10-05 at05:14:35UTC for [this protected synthetic report](https://insurance-bench-qz63cdok1-sentanis.vercel.app), deployment `dpl_G2zeBoSRnYRcSp4JHBUC6cC2xSFU`, deployed commit `1a543f260ce50ebc5d7e850c49642f1b4c6b7e81`. Acceptance binds this exact report artifact, not every later documentation commit or the claims application.

Source HTML SHA256 `9dfb0be1496cc9558239c5faf09841755e8715a730017b06a97c8b21dd89bcdf` (221,659 bytes) and served SHA256 `e4487f32a05e6c62cd93ac3c7ce8cba053ebaf49660c5caf901259cb8947c2b4` (221,822 bytes) differ only by one163-byte Vercel feedback script; every source HTML byte matches. Protection remains on for all deployments, with zero bypass keys. Anonymous access redirects302; authenticated Chrome returns200.

Chrome reconciles27 primary rows,74 recorded runs (47 history rows) and15 diagnostic contrasts. Both V0.12 panels show66.7 task success,95.3 partial credit,2/3 current-optimal writes and the same six deadline failure criteria. Tier tie, unmet calibration, correlated failure, absent response phases, provider gaps and expert-validity limits are visible. History opens by mouse and closes with Enter; disclosures collapse after reload. At390×844 the client/scroll widths are both390, with no overflow outside horizontally scrollable tables. Console errors/warnings are zero. The observed traffic is only the static report and Vercel auth/feedback/browser support, with no application database or model-provider traffic.

CA-IB04 is **passed for this protected static synthetic report only**. Calibration, tier discrimination, phase provenance, representative/provider coverage and insurance-expert validity remain open. This is not production-classified AWS staging or an application release; no benchmark grade, evaluated source or authority boundary changed. Fresh CI security has passed; its type/test jobs are still pending, so no final fresh-CI pass is claimed. Controlled local verification receipts above retain their exact separate conditions.


Current composite-page budget scope: no paid model/judge calls, no ledger reset or cap change. The historical$75 ceiling was internally adopted after an amount-unspecified increase request, not a provider/Vercel limit or verified bill. [Current clarification and runability](composite-design.md) supersede living prose attributing explicit approval of that exact amount; retained frozen plans and receipts stay unchanged. New self-runs require separate prospective admission.
