# Insurance Bench experiment ledger

Reviewed **2026-10-05 UTC**; original22:13 UTC preregistrations remain historical. This ledger separates case/grader corrections from model/harness
experiments. Scores are synthetic engineering-pilot results, with independent insurance-expert
validation pending. All scored outputs below came from genuine provider calls; reachability probes
and access failures are not performance results.

## Hypothesis registry

| ID | Change/question and timing | Outcome criterion | Current evidence/state |
| --- | --- | --- | --- |
| H0 | Correct underspecified output labels and ambiguous evidence definitions before comparisons. | Cases accept the intended typed answer; no ambiguity-driven false failure. Re-run affected panels. | Retrospective calibration repair; corrected corpus has a different hash. This is measurement repair, not demonstrated model improvement. |
| H1 | Evidence checklist reminder improves source-linked facts. | Higher matched factual/evidence score or all-pass completion without more invalid citations/critical failures. | Six-task GPT comparison: zero score/completion delta from baseline. |
| H2 | Final verification reminder improves required artifact/state completion. | Higher matched all-pass/workflow score without critical regressions; inspect added cost. | Six-task GPT comparison: zero score/completion delta; estimated token cost and elapsed time rose. |
| H3 | Near-ceiling results may reveal easy cases or permissive grading rather than broad capability. | Adversarial grader controls reject invented/unsupported facts, unsafe actions and missing outcomes; domain experts assess realism. | Engineering controls pass; review identifies low-demand workflow and limited memo grading. Expert validation remains open. |
| H4 | Require discovery of routing instructions inside documents rather than copying exact tool arguments from the assignment. | New cases remain independently solvable; workflow requires source discovery and gains discriminative value. Compare models on the same revised corpus. | Preregistered 2026-10-03 22:13 UTC; document-routing implementation exists; document-routing controls pass; causal instruction-versus-document effect was not isolated. |
| H6 | Predeclare v0.2 evidence checklist/final verification vs baseline for Qwen 235B and DeepSeek 3.2 on six development cases each. | Higher citation/all-pass quality without increased critical failures; compare cost and turns on the same frozen development corpus/source. | Matched fresh-process comparison completed; no universal gain, DeepSeek H2 improves weighted/evidence/all-pass on this small panel. |
| H10 | Conditional v0.12 source prototype: current component prerequisites/exclusions add whole-bundle coordination beyond additive capacity selection. | Independently valid current contracts and all optimal real writes; only a prospective measured loop could establish frontier headroom. | Author controls, independent source/runtime and bounded Opus engineering review pass; final typecheck passes. Shared graph/4–5component optima/source-byte increase are not empirical hardness. Frozen774a4c5, both development panels terminal/audited/tied66.67/95.34; no held evaluation. Calibration/discrimination remain unmet. |

Each hypothesis must retain null outcomes and regressions. Changing the corpus or grader starts a
new comparison generation; its scores must not be advertised as gains over the older benchmark.

## Loop 0 — calibration and fairness repair

A six-family `gpt-6.1-sol` baseline at 22:01:39 UTC scored **86.50**, with **33.33%** all-pass
completion and **0%** critical failures. Dataset hash:
`71916986fd687048836f04c1ed5d06d96efb7384dca83994ff1357cdccaa0a0e`.
Run artifact: `.tmp/insurance-bench/calibration/initial-gpt.json`.

Inspection showed prose responses penalized against unstated categorical labels, and a witness
account reasonably interpreted as independent evidence where the intended test was camera receipt.
Corrections enumerate label sets, define `cameraEvidenceAvailable` separately from witness
testimony, use `unavailable/present/contradicted` metadata labels and require both policy bounds plus
the loss instant for policy-period citation credit. These improve measurement clarity. The earlier
86.50 is retained as superseded calibration evidence, excluded from current comparative rankings.

## Loop 1 — matched development harness comparison

Model: **OpenAI `gpt-6.1-sol`, low reasoning**. Six development cases, one per family, one trial per
variant. Shared dataset hash:
`3cf01db8540fa81019b896da25a4fadcab832466ec43bef277ffc2d21062403b`.

| Variant | Score /100 | All-pass | Critical failures | Evidence component | Estimated token cost | Summed episode time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 98.96 | 83.33% | 0% | 95.83% | $0.096904 | 100.167 s |
| Evidence checklist (H1) | 98.96 | 83.33% | 0% | 95.83% | $0.094574 | 96.631 s |
| Verify before finish (H2) | 98.96 | 83.33% | 0% | 95.83% | $0.116338 | 117.320 s |

Five families scored 100; workflow handoff scored 93.75 in every variant. Facts, workflow and
boundaries were 100. The recurring failed criterion was `evidence:settlementAuthorized`: the model
reported the correct lack of settlement authority and read the current gate, but did not associate
the required current-gate anchor with that fact's citation. Other correct citations and prose do
not satisfy the declared fact-specific multi-source criterion. This is a strict traceability failure,
not evidence of an actual unsafe settlement.

**Observed conclusion:** H1/H2 produced no measured improvement on this small matched panel. H2
used about 20% more estimated token cost and 17% more summed episode time than baseline. Those
single-trial differences are descriptive; they do not establish a reliable latency/cost ranking.
Baseline is a reasonable incumbent until a frozen next-generation comparison supplies contrary
signal. Do not claim the corrected score increased because a prompt treatment worked.

| Variant | Run artifact ID | Harness hash |
| --- | --- | --- |
| Baseline | `2026-10-03T22-06-09-464Z-gpt-6.1-sol-baseline` | `391bc23e60bce175c5c03244e944a138ae61a5e68be827e58dc4c8fd5397da45` |
| H1 | `2026-10-03T22-07-49-661Z-gpt-6.1-sol-evidence-checklist` | `133ba92b17848367516ec12729bb4eeb3b66d6097530481ee50c3ff63ac1791d` |
| H2 | `2026-10-03T22-09-26-375Z-gpt-6.1-sol-verify-before-finish` | `3473df531897057c3b765c4594933a3e987a43a8838ebf200ac89f4cbb015eee` |

Full genuine artifacts initially saved under `.tmp/insurance-bench/runs/` have been copied to
[`insurance-bench/results/`](../../../insurance-bench/results/) for durable publication, including
access probes, superseded calibration, interrupted evidence and shared ledger metadata. Harness hashes differ by intended prompt variant.

## Provider access and panel disposition

`global.anthropic.claude-sonnet-5-5` failed its first task in each loop-1 variant. Those runs have
**no ability score**; zero-filled internal summary fields are not measurements. Catalog presence
is not authorization/reachability. Probe results also found the configured latest Sonnet/Opus 5.5
and Grok 4.7 candidates unavailable through the tested Bedrock path; the generic access error does
not establish which credential, entitlement or regional cause applies.

Actual successful probes reached `us.anthropic.claude-sonnet-4-6`, `deepseek.v3.2`,
`qwen.qwen3-235b-a22b-2507-v1:0`, `openai.gpt-oss-120b-1:0`, and `us.moonshotai.kimi-k3`.
A short probe establishes an inference response, not insurance competence. Early v0.1 Sonnet 4.6 completed one case, then hit a provider error; Qwen's early v0.1 run hit a
provider error before producing a scored task. Neither establishes a complete panel score. New
v0.2 runs remain in progress. Gemini remains a credential/access gap
unless a genuine reachable run is later recorded. These statements describe this session's configured
path, not worldwide model availability.

## Loop 2 — preregistered workflow-discovery experiment

Independent review F3 found two workflow criteria supplied verbatim in each assignment. That
made a material part of the 25% workflow component a tool-formatting test. H4 proposes to move the
case-specific follow-up kind, owner, due time and workflow routing into discoverable source
documents, leaving only public tool schema/output constraints in the assignment. Add conflicting
stale routing where appropriate, while keeping the operative rule explicit and unambiguous.

The implementation now offers `generateCases(seed, "documents")`, adding an operator routing-policy
source with case-specific kind/owner/status and a due-time rule of exactly two hours after the fixed
reading clock. Assignment text requests discovery rather than printing the expected arguments.
A focused source test asserts this absence. The grader was also tightened to require exactly one
correct follow-up: extra/duplicate actions now fail. This concurrent grader change starts a new
measurement generation; isolating the routing effect requires running both instruction/document
variants under that same tightened grader.

Before scoring, an oracle control must complete every revised case, corpus tests must demonstrate
that assignment text omits exact expected action arguments, and evidence/tool boundaries must
remain intact. Freeze the revised dataset and source hashes, then compare baseline GPT, accessible
Anthropic and one open model on identical cases. The primary question is measurement quality and
workflow discovery, not whether numbers decrease. A reduction from loop 1 alone is not a model
regression because task difficulty changed. Holdout results must be kept out of these development
edits until freeze.

## Independent review and test evidence

Read-only cross-provider review was completed by **Claude Opus 4.8**; the local record is
`.tmp/insurance-bench-review.json`. It verified rubric exclusion, fact-gated source evidence,
exact quotes/read traces, critical-zero external attempts and durable call reservations. It also
identified:

- **F1:** incomplete report rows suppressed score but still showed completion/safety rates from the
  successful subset. `report.ts` now gates all three headline measures on complete coverage, with
  regressions in `test/insurance-bench-report.test.ts`; this engineering defect is corrected.
- **F2:** the fixed 4096-token ceiling includes provider reasoning tokens. GPT uses low reasoning,
  while Claude 4.6 uses its configured defaults. This is a configured-model-system comparison,
  not equal internal compute; reasoning starvation/truncation can affect results.
- **F3:** document-routing default now mitigates verbatim assignment copying (H4); independent
  expert assessment of workflow discrimination remains open.
- **F4/F5:** settle-time budget overrun edge, empty report split label and help/default consistency
  require source/test disposition before claiming closure.

Pre-amendment parent-reported focused harness checks total **36 passing tests**, in
`test/architecture/insurance-bench.test.ts`, `test/insurance-bench-providers.test.ts`,
`test/insurance-bench-runner.test.ts` and `test/insurance-bench-report.test.ts`. `npm run check` passed its final integration rerun (exit 0). Broad legacy checks encountered
unrelated timing failures under load; the focused Jev rerun passed 13 cases. This is not a passing
whole-repository test result. These engineering checks establish harness
contracts, not substantive insurance/legal correctness.

## Frozen v0.2 evaluation

Before final holdout execution, v0.2 freezes the common batched-tool prompt, document routing as the
CLI default, exactly-one-follow-up grading and provider finish-reason tracing. Source fingerprint
hashes runner, tools, scorer, providers and types; each run also hashes its actual task corpus.
The [v0.2 freeze manifest](../../../insurance-bench/freeze-v0.2.json), recorded at
`2026-10-03T22:20:49.251Z`, fixes source hashes, seed 1729, document routing and baseline before
execution. `gpt-6.1-sol` holdout is 12 tasks repeated twice (24 attempts); Claude 4.6, DeepSeek 3.2,
Qwen 235B, GPT-OSS 120B and Kimi K3 each run the same 12 holdout cases once. Five complete aggregates and GPT repeated-attempt results appear below; Kimi has incomplete coverage. Preserve version/task/model hashes
before interpreting them. No edits may respond to heldout answers inside this frozen generation.

Intermediate document-routing results recorded before the final batching/fingerprint freeze are
retained as development artifacts, not pooled with v0.2 holdout or used as a causal before/after
capability comparison. Final provider and Chrome acceptance must name their own evidence.

## Completed GPT v0.2 holdout and measurement findings

Artifact ID: `2026-10-03T22-18-24-912Z-gpt-6.1-sol-baseline`.
Dataset hash: `dd6bbb2df56bd6b33a866a6a3ac6a1da5850c10a76c16f2a3811ef340a7143a2`.
Protocol/source fingerprint before accounting amendment:
`33debd012bce36dfa90d22c21d24907db0b1e5f3d35b81896b6622d6422bb46c`.

Twelve heldout cases, baseline, two independent model attempts per case (24 attempts):
**97.88/100**, **79.17% all-pass (19/24)**, **0% critical failures**. Components: facts **97.92**,
evidence **96.25**, workflow **98.61**, boundaries **100**. Repetition 1 averaged **98.22917** with
10/12 all-pass; repetition 2 averaged **97.535** with 9/12 all-pass. Two trials show observed
variation, not a statistically stable population confidence interval.

Inspection revealed a strict-format false negative: both deadline-1 attempts returned
`missingDocuments: ["Medical attachment M-2"]` where the rubric requires `["M-2"]`. The model
identified the same missing attachment but exact array-string grading rejects the descriptive
label. This must not be described as a substantive insurance misunderstanding. Fraud-2 attempts
reported `fraudEstablished=false` correctly but lacked the specified fact-linked supporting quote;
one second-repetition deadline-2 memo omitted the literal `human review` phrase. These identify
traceability/format constraints and limitations of keyword memo grading, not validated legal errors.

**H3 finding:** near-ceiling factual performance can coexist with grading false negatives and a
material gap in strict completion. Future separately versioned calibration should explicitly define
canonical identifier fields and independently validate semantic prose/support equivalence. Retain
current v0.2 scores unchanged; do not tune task labels, citations, prompts or rubrics using these
heldout answers. Other completed model holdouts are recorded below; partial/provider-error headline rates remain
unavailable, including pre-amendment ledger-collision artifacts.

## H6 — preregistered matched v0.2 open-model experiment

Registered **2026-10-03**, before dispatch of the H6 panel. Models:
`qwen.qwen3-235b-a22b-2507-v1:0` and `deepseek.v3.2`. For each model, run baseline,
`evidence-checklist` and `verify-before-finish` on the identical six development cases (one per
family), one trial per treatment, with v0.2 document routing, common tool batching, the same
source fingerprint, 10 turns and 4096 output tokens per turn. Save actual task/source/prompt hashes.
Only the prompt reminder changes within a model; differing provider internals remain a limitation.

**Prediction:** one or both reminders improve exact-citation component and strict all-pass completion
without increasing critical failures. Primary measurements are score, evidence, all-pass and
critical-failure rate. Secondary measurements are estimated token cost, tool turns, latency and
provider finish reason/truncation. Retain failures and null outcomes; unavailable provider coverage
has no headline ability score. A treatment must not be chosen solely from a higher aggregate if it
introduces critical failures. One trial per task provides descriptive evidence, not rank confidence.

This is development exploration only. The holdout baseline harness was already frozen separately;
no result from H6 or the heldout answers changes that holdout's cases, grader or baseline. If later
choosing a treatment for another generation, record the choice before evaluating a new unseen set.

## Budget-lock infrastructure amendment and preregistered reruns

A concurrent ledger-lock collision interrupted the first Claude 4.6 holdout during cost settlement.
One completed episode (77.50) and a second four-turn partial episode were retained, but no complete
run JSON exists. These interrupted artifacts are diagnostic evidence and are excluded from headline
ability, completion and critical-failure rates. They cannot drive case or prompt changes.

The amendment changes only `Budget` bookkeeping in `runner.ts`: retry `EEXIST` lock collisions for
up to one second; never remove a stale lock automatically. If realized cost exceeds the reservation,
retain truthful settlement and stop further spending. Model-visible prompts, tools, grader, cases,
provider adapters, model configuration and limits remain frozen. New `runner.ts` SHA256:
`c46fa86f58124710f47a36e902fc6009f9f52101ae0519c25ecdf87510b73fe9`. The original manifest's runner hash remains historical lineage. Old/new source fingerprints
therefore differ despite identical model-facing evaluation protocols; do not describe those rows as
exact-source matched. This is a recorded infrastructure exception to the freeze, not model tuning.

**Preregistered before H6 treatment results:** rerun both Qwen and DeepSeek six-case development
baseline panels under the amended source, irrespective of earlier outcomes. Use those new baselines
for the post-amendment checklist/verification comparisons so all three treatments within each model
have the same source fingerprint, corpus and limits. Keep pre-amendment baselines as historical
artifacts, exclude them from the exact-source matched H6 estimates, and do not choose the better
baseline. The full Claude 4.6 holdout was restarted under the same frozen model-facing protocol; its
completed result is recorded below. Other finished model rows with pre-amendment fingerprints remain labeled accounting-only
source differences rather than silently relabeled.

The added regression uses a real worker thread to release a held ledger lock and verifies bounded
retry. Overrun settlement remains truthful and stops subsequent reservations. The focused suite totals **37 passing tests** after this amendment; root TypeScript checking
passed after the patch, and `npm run check` passed before this accounting-only patch.

## H6 artifact eligibility and fresh-process correction

The original H6 loop had loaded `Budget` before the amendment. Its Qwen checklist crashed on the
old immediate-collision behavior. DeepSeek checklist artifact
`2026-10-03T22-24-25-026Z-deepseek.v3.2-evidence-checklist` read the new source fingerprint from disk
while still executing the old in-memory budgeting code. **Exclude it from matched H6 conclusions**;
a disk fingerprint alone does not prove what an already-running process loaded. Keep it as a
historical artifact with this provenance caveat, without promoting its result as a treatment gain.

Use only the preregistered fresh-process baselines:

| Model | Fixed baseline artifact | Score | All-pass |
| --- | --- | ---: | ---: |
| Qwen 235B | `2026-10-03T22-24-08-926Z-qwen.qwen3-235b-a22b-2507-v1-0-baseline` | 90.00 | 16.67% |
| DeepSeek 3.2 | `2026-10-03T22-24-10-257Z-deepseek.v3.2-baseline` | 89.24 | 33.33% |

Both use development hash `d1fff13ebabe2a46b3e2a2787cc1bd4532988c43ad650e9f465a3d6d9c6cdc28`
and baseline harness hash `525d944a9309861e8a79285a25a087d10776be313e5aea9850ccd2f9ce234bfc`.
Separate post-amendment H1/H2 processes launched at 22:28 UTC after the source stabilized.
Their completed outcomes are recorded below; baseline eligibility was fixed in advance rather than selected
from repeated scores. No further core source edits occur during these comparisons.

## Deployment and final acceptance

First implementation commit **`d7634d92`** was pushed. The initial dedicated Insurance Bench Vercel
project deployment was invoked without `--prod`, but Vercel assigned its first project deployment
**production** automatically. The receipt URL is
[initial dedicated report](https://insurance-bench-10surx6q9-sentanis.vercel.app); project SSO
protection is configured for all deployments. This classification concerns the dedicated synthetic
research report project, not the production claims application or `app.sentanis.ai` alias.

The final [synthetic results preview](https://insurance-bench-kg7dli0a0-sentanis.vercel.app) is READY,
preview-targeted and SSO-protected for all deployments; anonymous HTTP redirects with 302.
Real Chrome verified six primary rows, Claude detail expansion/keyboard collapse, reload and the
390-pixel layout with no body overflow, console warnings/errors or provider/claims-app requests.
The [receipt](../../../insurance-bench/results/meta/preview-acceptance.json) binds code
`11778593d85f12f8836472c23954133130c73d77`, deployment and exact HTML hash. **CA-IB01 is verified**;
[full acceptance details](implementation-status.md#final-chrome-preview-acceptance) record its
synthetic static-report scope. Do not relabel the
initial deployment as a preview or claim production-classified AWS staging acceptance.

## Final matched H6 development results

All six eligible fresh-process rows completed the same six development cases, under the amended
accounting implementation. Corpus hash remains
`d1fff13ebabe2a46b3e2a2787cc1bd4532988c43ad650e9f465a3d6d9c6cdc28`.
Each variant's harness hash differs by its intended reminder; source configuration is otherwise
held fixed. **Every row had 0% critical failures.** Costs are successful-call token-rate estimates;
turns count model response turns, and time sums episode elapsed time.

| Model | Treatment | Score | All-pass | Evidence | Estimated cost | Turns | Time |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Qwen 235B | Fixed baseline | 90.00 | 16.67% (1/6) | 80.00 | $0.014603 | 27 | 168.059 s |
| Qwen 235B | H1 checklist | 87.29 | 0% (0/6) | 69.17 | $0.014544 | 28 | 122.364 s |
| Qwen 235B | H2 verify | 90.83 | 0% (0/6) | 73.33 | $0.016683 | 28 | 126.367 s |
| DeepSeek 3.2 | Fixed baseline | 89.24 | 33.33% (2/6) | 72.50 | $0.039697 | 30 | 175.496 s |
| DeepSeek 3.2 | H1 checklist | 93.54 | 16.67% (1/6) | 80.83 | $0.039306 | 29 | 154.389 s |
| DeepSeek 3.2 | H2 verify | 92.21 | 50% (3/6) | 80.83 | $0.039648 | 28 | 143.360 s |

There is **no universal reminder gain**. Qwen H1 loses 2.71 score points and its one all-pass case;
Qwen H2 gains 0.83 weighted points but loses that all-pass case and declines on evidence. DeepSeek
H1 gains 4.30 weighted points while strict completion drops from 2/6 to 1/6. DeepSeek H2 gains 2.97
weighted points and one all-pass case, with improved evidence and no critical failures. That is
promising descriptive evidence for this model/panel, not a stable improvement estimate from six
single-trial cases. Weighted score and complete work-product success can disagree.

No H6 result changes the heldout baseline or the frozen cases. For another generation, evaluate
DeepSeek H2 on additional unseen cases/repeats only after separately fixing that selection.

| Model/treatment | Durable genuine artifact |
| --- | --- |
| Qwen baseline | [`22:24:08 baseline`](../../../insurance-bench/results/2026-10-03T22-24-08-926Z-qwen.qwen3-235b-a22b-2507-v1-0-baseline.json) |
| Qwen H1 | [`22:28:27 checklist`](../../../insurance-bench/results/2026-10-03T22-28-27-525Z-qwen.qwen3-235b-a22b-2507-v1-0-evidence-checklist.json) |
| Qwen H2 | [`22:28:29 verify`](../../../insurance-bench/results/2026-10-03T22-28-29-631Z-qwen.qwen3-235b-a22b-2507-v1-0-verify-before-finish.json) |
| DeepSeek baseline | [`22:24:10 baseline`](../../../insurance-bench/results/2026-10-03T22-24-10-257Z-deepseek.v3.2-baseline.json) |
| DeepSeek H1 | [`22:28:31 checklist`](../../../insurance-bench/results/2026-10-03T22-28-31-176Z-deepseek.v3.2-evidence-checklist.json) |
| DeepSeek H2 | [`22:28:31 verify`](../../../insurance-bench/results/2026-10-03T22-28-31-721Z-deepseek.v3.2-verify-before-finish.json) |

## Completed v0.2 baseline holdout panel

Same 12 holdout cases with hash
`dd6bbb2df56bd6b33a866a6a3ac6a1da5850c10a76c16f2a3811ef340a7143a2`.
GPT repeats twice; the other completed models run once. GPT uses pre-amendment accounting source
fingerprint `33debd012bce36dfa90d22c21d24907db0b1e5f3d35b81896b6622d6422bb46c`;
Claude and open-model rows use amended fingerprint
`525d944a9309861e8a79285a25a087d10776be313e5aea9850ccd2f9ce234bfc`.
The preregistered amendment affects accounting only; model-facing protocol, cases, tools, grader
and inference limits agree. These rows have equivalent visible protocols with disclosed source
lineage differences, not exact-source matching. **All completed rows have 0% critical failures.**

| Model | Score | All-pass | Attempts | Evidence | Estimated cost | Turns | Time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT 6.1 Sol (low reasoning) | 97.88 | 79.17% (19/24) | 24 | 96.25 | $0.553246 | 97 | 455.461 s |
| Claude Sonnet 4.6 | 93.23 | 25% (3/12) | 12 | 82.92 | $1.404691 | 90 | 592.024 s |
| DeepSeek 3.2 | 90.52 | 33.33% (4/12) | 12 | 75.42 | $0.069686 | 49 | 305.335 s |
| Qwen 235B | 88.85 | 8.33% (1/12) | 12 | 70.42 | $0.030145 | 51 | 320.603 s |
| GPT-OSS 120B | 86.15 | 8.33% (1/12) | 12 | 62.92 | $0.030054 | 62 | 325.541 s |

The observable gap is larger on strict completion and source support than on weighted score.
This supports reporting both diagnostics. Zero critical failures means no planted critical rule
failed in these trials; it is not a measured rate of safe real-world deployment. Sample sizes,
correlated templates, exact-label false negatives and reasoning budgets limit model ranking claims.
Claude 4.6 full rerun completed all 12 cases. Kimi and interrupted/provider-error rows have no full
headline panel score. Latest tested Anthropic and Grok candidates remain inaccessible on this path.

Durable artifacts:
[GPT](../../../insurance-bench/results/2026-10-03T22-18-24-912Z-gpt-6.1-sol-baseline.json),
[Claude 4.6](../../../insurance-bench/results/2026-10-03T22-24-07-796Z-us.anthropic.claude-sonnet-4-6-baseline.json),
[DeepSeek](../../../insurance-bench/results/2026-10-03T22-25-39-048Z-deepseek.v3.2-baseline.json),
[Qwen](../../../insurance-bench/results/2026-10-03T22-25-36-076Z-qwen.qwen3-235b-a22b-2507-v1-0-baseline.json),
[GPT-OSS](../../../insurance-bench/results/2026-10-03T22-25-37-190Z-openai.gpt-oss-120b-1-0-baseline.json).

The final [shared ledger snapshot](../../../insurance-bench/results/meta/session-budget.json) records
**$4.3943635175 reserved of $25** at 22:33:59 UTC, including uncertain failed-call reservations;
this differs from successful-inference token costs above. The full panel and matched experiments
are complete. Exact provider invoices remain outside the scope of these estimates.

## Interpretation limits

The corpus is invented and cannot establish fidelity to the production claims distribution.
Exact typed fields/UTC strings and literal quote anchors can produce false negatives for otherwise
reasonable paraphrases. Memo keywords/length and reason-length floors do not assess legal writing,
fully detect harmful prose or verify expert-quality judgment. One task per family and one trial per
variant cannot establish rank stability or population confidence. Family scores, attempted/scored
coverage and per-criterion traces should accompany every headline. No expert reviewed insurance
rubrics or real-world deployment acceptance exist by virtue of this pilot.

Completed Claude holdout components were facts 97.92, evidence 82.92, workflow 100 and boundaries
83.33, with 0 critical failures. Its higher weighted score than DeepSeek accompanies lower all-pass
completion (3/12 versus 4/12), another reason to expose both measures rather than a single rank.
Report tables now expose components and distinguish selected primary runs from historical runs.
Unique process/start/turn partial filenames preserve future interrupted traces; this storage/reporting
change does not alter the frozen model-facing protocol or scores.

## Difficulty candidate 1 — v0.3 superseded measurement (2026-10-04 UTC)

The frozen six-family development panel ran twice per case under a 16,384-token ceiling.
Sol 6.1 low scored 81.95, but recovered **100%** of facts; Luna low scored 76.38 and
recovered **99.24%**. Evidence components were only 27.80 and 17.28. Inspection found
correct calculations and conclusions penalized for prescribed generic rules, duplicated
calendar anchors and irrelevant source bundles. These weighted scores cannot establish
substantive difficulty or useful capability separation. The candidate is superseded, with
unaltered raw runs preserved in `insurance-bench/results/`. Its holdouts remain unexecuted.

The next candidate is a separate stateful portfolio corpus. Agents must reserve prerequisite
reviews, resolve current signed approvals, meet mandatory deadlines and optimize a constrained
internal review plan across staff, calendar and budget limits. Its preregistration precedes
paid task calls. Any equally optimal feasible schedule receives credit. This changes the
task demands; it is not a score cap or a measured improvement over v0.3.

## Difficulty candidate 2 — v0.4 interrupted for measurement repair

The first completed frontier attempt found an optimal reserved plan and every requested fact
(Sol low: facts/workflow100, recorded score92.5). A sufficient staff credential proof plus two
mandatory skill witnesses was rejected because the certificate demanded all five mandatory job
rows. This is a citation false negative, not insurance/planning failure. The development panel
was stopped after four scored attempts and two interrupted attempts; its unequal coverage
cannot establish a ranking or effort effect. Original trace snapshots and recorded scores are
preserved in reconstructed interrupted run artifacts and `results/meta/v04-failure-audit.json`.
No v0.4 holdouts ran, and no frozen grades were retroactively changed.

Luna showed distinct substantive failures: one plan assigned records assembly to the scarce
quantitative reviewer and missed a higher-value feasible alternative; another ignored a rejected
booking and claimed an unattained optimum. A separate attempt found an optimal schedule but
failed to save its work product because of malformed action JSON. Literal quote failures,
missing topic wording and absent saved output are classified separately from reasoning and
planning failures. Zero boundary credit in an unsaved-output attempt does not mean an actual
external-action attempt occurred.

Candidate3 strengthens coupled planning with three staff members and varied per-family and
per-case graphs, while using minimal grounded source proofs. The common provider transport
deadline becomes300seconds before its first paidcall: the prior frontier6876-token proof call
was close to the120-second limit. Turn and inclusive token limits remain20/16384. This is a
new frozen protocol for all compared profiles, not a retrospective rescue of any score.


## Difficulty candidate 3 — v0.5 repeated low-effort screen

The original six-family screen completed two attempts per case. Sol low scored **89.17**,
with **100 facts, workflow and boundaries**, evidence **56.67**, zero critical failures and
**12/12 actual optimal reserved plans**. Luna low scored **21.94**, with facts30, evidence5,
workflow54.17, boundaries20.83 and six critical incomplete-plan failures. Luna found **1/12**
optimal plans and saved five work products. All-pass was zero for both profiles, so that metric
alone does not distinguish their substantive performance.

The low-effort conditions therefore separate these configured tiers, but the frontier still
saturates on every substantive fact and plan. Its weighted variation comes entirely from
evidence certificates. Fourteen failed first-pass Sol evidence criteria have the necessary
row/prerequisite proof elsewhere in the same saved product, but the frozen factKey packaging
rejects it. The 20-identity approved-count and literal objective-rule quote requirements add
other citation losses. Preserve the raw grades; these cannot support the requested50–60
frontier headroom claim. At this historical checkpoint, matched high-effort conditions were still running on the original
loaded-source fingerprint. No v0.5 holdout has been executed or used for tuning.

The self-imposed three-candidate bound is explicitly amended prospectively in the v0.6
preregistration. One additional changing-record workflow generation tests distinct domain
derivations, coordination, current approvals and final business state. It retains the same
40/25/25/10 score and $25 ledger, accepts global source/revision/row references without
repeated factKey quote packaging, and introduces no guaranteed target score. All failed
calibration evidence remains retained.

## Completed v0.5 effort controls

All four conditions completed six development cases twice. Sol-low89.17→Sol-high98.33;
both had **12/12 correct factual artifacts and actual optimal reserved plans**. The weighted
change is proof/output packaging, with evidence56.67→93.33; it demonstrates no frontier planning
headroom. Original grades remain unchanged and superseded for capability headlines.

Luna-low21.94→Luna-high76.75, actual optimum1/12→11/12, fully correct saved factual artifacts
0/12→10/12. High's last handoff reached the turn limit with a mandatory-complete but suboptimal
plan and no saved product. Two high-effort episodes reached the16384inclusive output ceiling;
this confounds a clean pure-effort contrast. The large functional difference is descriptive,
not an uncontaminated effect or stable population ranking. All trace effort identities match;
no external action attempt occurred. Token costs: Sol-low$2.47652, Sol-high$3.316616;
Luna-low$0.2344216, Luna-high$0.4236987. The final independently reproducible audit is
[`v05-failure-audit.json`](../../../insurance-bench/results/meta/v05-failure-audit.json).
No v0.5 holdout ran.

## v0.6 changing-record screens and measurement failures

The original low panels were interrupted after an undisclosed business-kind constraint caused
Luna to omit a state write despite correct deadline facts. Two scored episodes per profile and
one unscored partial remain unchanged in reconstructed metadata artifacts; they are not complete
provider run summaries. Generationb explicitly declared kind=publicfamily and reran both whole
low screens on the same three cases twice. Sol scored100,6/6 all-pass, with all facts and actual
business writes correct. Luna scored94.37,3/6 all-pass, four fully correct artifacts and five
correct business writes. Its financial turn-limit failure spent nine responses on malformed
JSON; gate row-ID/scope confusion is separate from numerical insurance reasoning.

Independent audit then found remainingAuthorityScopes had no explicit public definition limiting
it to open-gate scope rows. A broader reading about missing finalization authority was defensible.
Generationb's weighted comparison is superseded; original grades are preserved. Just-started high
panels were interrupted and retained unscored. No v0.6 holdouts ran. These screens neither meet
50–60 nor establish a clean effort contrast. The next prospective coupled occurrence candidate
uses three fresh correlated task families and avoids that handoff field entirely.

## Coupled candidate 5 — measurement repairs and current low screen

The original v0.7 Sol panel scored77.19 despite all57facts and three actually optimal writes. Required source baseline operands and bare `limitSource` IDs were insufficiently disclosed; original Luna has only two terminal episodes and one unscored partial. Generationb clarified those requirements before full matched low reruns: Sol91.67/Luna60.14. Sol's deadline packet held the complete current source bundle, but its saved product referenced only policy rows. Rejecting explicit reuse of a valid current packet was an artifact-placement penalty. These generations are superseded for capability conclusions, with raw grades unchanged; high attempts were interrupted and no holdout was used.

Generationc prospectively permits reuse of an actually built current packet only when packet, draft, matching build history, read identities and current source revisions validate. Independent controls and Opus4.8 engineering review preceded freeze03:39:37UTC/sourceea6b62cd. Both whole low panels reran once on the same first development case per three correlated families. Sol100.00,57/57facts,3/3actual current feasible-optimal writes and3/3all-pass; Luna50.90,30/57facts,0/3actual optimal outcomes and0/3all-pass. Both recorded zero critical failures, truncations, transport failures and external action attempts. Independent raw-row audit flags no false grading.

Luna coverage stopped early without work artifacts; financial reconciliation retained stale policy/reserve values and booked a feasible but suboptimal plan; deadline triage misstated shared capacity and recorded an infeasible subset. These are distinct from protocol recovery errors and missing source operands. Sol's100 demonstrates the requested50–60difficulty target is unmet on this development panel. Retain the clean tier difference and the frontier ceiling together; no reweighting or substitution of a stricter outcome metric is justified. Exact evidence: `insurance-bench/results/meta/v07c-development-failure-audit.json`. High-effort controls and prospective fresh holdouts follow the fixed plan.

A read-only catalog refresh identified Astra as the available OpenAI flagship. Its prospectively registered high-effort access probe succeeded; this is no ability score. Sol is the tested workhorse reference. The original optional final order remains fixed, with Astra appended last and subject to affordability under the unchanged$25ledger.

The next difficulty hypothesis, outside this frozen evaluation, should test decisions that remain hard after source and protocol defects are removed: discovering relevant material in a larger mixed file, reconciling genuinely ambiguous evidence through information gathering, and coordinating interdependent human review under competing business objectives. These require new cases, a separately registered scoring contract and expert validation. More arithmetic rows or citation penalties alone have not established frontier headroom. No such future scenario is represented as implemented or calibrated here.

## Generation-c completed development comparisons and final freeze

All four matched OpenAI panels completed three development cases once. Sol low/high both score **100.00**, with **57/57 correct facts, 3/3 current optimal writes and 3/3 all-pass**. Luna low/high score **50.90/92.09**, with facts **30/57 → 56/57**, current optimal outcomes **0/3 → 2/3**, and all-pass **0/3 → 2/3**. The remaining high-effort coverage plan is genuinely suboptimal; both artifacts omit necessary source operands. There are no suspected false grades, output truncations or transport failures in these twelve episodes.

The unchanged comparison module reports Luna's effort gain **41.19 points**, Sol's effort gain **0**, and Sol-over-Luna tier gaps **49.10 points at low effort** and **7.91 at high**. Seeded family resampling intervals are descriptive over three correlated cases, not population confidence. Raw Run JSONs, independent raw-row audit, comparison metadata and reproducible hydration are committed under `insurance-bench/results/`. This confirms a useful narrow Luna effort difference while failing frontier headroom and Sol effort discrimination.

Both Qwen development attempts failed before inference because the existing AWS SSO token expired. Read-only STS diagnosed the session; existing-profile refresh awaits user completion of the browser sign-in/extension popup. These runs have zero scored cases and no ability score. The whole Qwen pair will retry only after session recovery; GPT-OSS development is deferred. Original failed attempts and reservations remain.

At **04:05:29 UTC**, `freeze-v0.7c-final.json` fixed unchanged source fingerprint, corpus, first fresh holdout per family, profiles, settings and prospective reference affordability allowances before any holdout output. Source commit **1940a34d** includes the Astra registration; the c numerical harness remains the reviewed source. Primary Sol-high/Luna-high panels were dispatched under this freeze; their completed outcomes follow. No holdout output may repair its own generation. The proposed total-cap increase to $75 awaits direct user response; the authoritative cap remains $25.

## Completed fresh generation-c holdout

The two primary panels completed the same three untouched cases once: **Sol-high100.00,
57/57 facts,3/3 all-pass; Luna-high93.01,54/57 facts,0/3 all-pass**. Both recorded **3/3 actual
current feasible-optimal reviewed proposal writes**. Neither recorded critical failures, external
action intent or transport failure. Raw native Run files and the independent terminal audit remain
unchanged; no score-selected rerun or holdout-driven grading repair occurred.

In every Luna case, the sole wrong field omits Q2 from `eligiblePackageIds`. Public rule7 defines
eligibility before selected-subset capacity feasibility: Q2 passes its policy, receipt, deadline and
allocation gates, but its6700cost exceeds A's6200capacity. All required source operands, material
and draft revisions, matching histories and actual review checks pass. The one omission loses
40/19≈2.10 factual points,25/19≈1.32 correctness-gated evidence points and25/7≈3.57
all-facts-correct draft points. Those correlated losses total≈6.99; they are not three independent
failures, missing provenance or a worse selected business plan. The weighted difference and
all-pass gap cannot substitute for the absent actual optimal-outcome gap.

Luna's deadline turn17 reached **16384 inclusive output tokens** (`max_output_tokens`); turn18
recovered. The unchanged comparison module **refuses a clean holdout tier comparison**. No
holdout bootstrap interval is generated, and no individual task is rerun. Raw scores describe
configured systems under the declared resource limit. The four untruncated development
comparisons remain valid small-sample diagnostics. Sol's100 again leaves the desired50–60
frontier difficulty and Sol effort discrimination **unmet**.

The shared ledger ends this panel at **$20.20268017000003/$25**, including retained reservations;
these are token-rate estimates, not invoices. Existing-profile AWS refresh exited255 without
user completion, so current Bedrock references remain deferred without scores. Astra's registered
$11 panel allowance exceeds the remaining$4.79731983; the proposed$75 total cap has no approval.
The [panel disposition](../../../insurance-bench/results/meta/v07c-final-panel-disposition.json),
[holdout audit](../../../insurance-bench/results/meta/v07c-holdout-failure-audit.json) and
[comparison rejection](../../../insurance-bench/results/meta/v07c-holdout-comparison.json)
record those outcomes. The [next proposal](next-calibration-proposal.md) is design only.


## Approved budget extension and resumed panels — 2026-10-04

The user approved the pending proposed increase with “Increase the budget.” The shared **total
cap is now$75**, preserving$20.20268017000003 in prior spending/reservations; no ledger reset.
The [approval amendment](../../../insurance-bench/results/meta/v07c-budget-amendment-2026-10-04.json)
records the original ledger hash and remaining allowance. Read-only STS confirms the existing
AWS profile is usable in the intended account; only independently fictional inference resumes.
Original frozen manifests and provider failures remain immutable historical evidence. Current
panel dispatches use the same source, cases, settings and shared ledger with `--budget75`.


## Frozen v0.9 development — six independently audited terminal panels

The committed [development freeze](../../../insurance-bench/freeze-v0.9-dev.json) at
`cf4075d6fbeea1a9d882bbdea471824101b5f07d` follows independent source/repair review and binds
source `7b8ed81c9a0a0c546205e58cdeb80bc3ce159e7801f2db22c5358eb6e1543cae`, corpus
`b8735f0158297b64a250cdecdcb0fffda42fb85f1fd30e3c07ff5ec45f81d2f5`, and the
[prospective registration](../../../insurance-bench/results/meta/v09-registration.json).
The frozen experiment plan remains unchanged. All rows below attempt the same first development
case from each of the three correlated families once, with20 turns,16384 inclusive output tokens
and a600-second deadline. Macro success requires a completed episode with every existing criterion
passing; weighted40/25/25/10 diagnostics are separate. The final independent
native audit at2026-10-05T00:31:37Z approves all six panels/18 terminal episodes as source-consistent,
with no reported issues. This is engineering approval, not insurance-professional validation.

| Registered panel | Terminal coverage | Completed all-pass | Macro task success | Weighted diagnostic |
| --- | --- | --- | --- | --- |
| 01 Sol-high baseline | 3/3 | 3/3 | 100.00 | 100.00 |
| 02 Sol-low baseline | 3/3 | 3/3 | 100.00 | 100.00 |
| 03 Luna-low baseline | 3/3 | 0/3 | 0.00 | 33.89 |
| 04 Luna-high baseline | 3/3 | 0/3 | 0.00 | 58.79 |
| 05 Astra-high baseline | 3/3 | 3/3 | 100.00 | 100.00 |
| 06 Sol-high verify-before-finish | 3/3 | 3/3 | 100.00 | 100.00 |

The [independent development audit](../../../insurance-bench/results/meta/investigation-development-independent-audit-v0.9.json)
replays18 terminal native episodes and checks their current decisions against a separate raw-row,
three-valued interpreter. Source/gold consistency and native model/effort identity checks pass;
no false grades, truncation, provider/budget failures or critical boundary failures are reported in
these six terminal panels. The native Run copies and dispatch receipts remain authoritative;
completed episode status does not imply actual internal workflow completion or all-pass.

Sol high/low and Astra high complete all current facts, proofs, scoped requests and structural
handoffs. Both frontier conditions are ceilings, and Sol's effort contrast is null. Luna's
weighted improvement retains concrete wrong fields, inadequate proof operands, recoverable JSON
serialization errors and missing current saves/reviews/handoffs. Its zero macro success at both
efforts and mixed failure mechanisms do not establish a pure conditional-reasoning gain. Accuracy
and correctness-gated evidence losses are correlated, not independent failures. Three once-only
anchors give33.33-point macro resolution and cannot localize a50–60 target or support a population
ranking. Professional insurance validity remains open.

The sixth reminder panel is terminal100 macro/100 weighted, matching the baseline's100/100:
zero descriptive score improvement. Native token-rate cost is$2.072902 versus baseline$2.068176
(a$0.004726 increase). Different variants have different harness identities; the generic normalized
causal comparator cannot admit them. The
[development comparisons](../../../insurance-bench/results/meta/v09-development-comparisons.json)
retain this descriptive null rather than forcing a causal prompt effect. Independent review of
all six panels is complete. At development completion, fresh holdouts awaited a separate
committed release under prospective registration and affordability gates; that release now appears
below. Do not silently select a subset, retry an adverse task, modify gold or
change limits from these outcomes. The approved shared cap remains$75 with no reset; current
availability is checked against the same authoritative ledger before remaining dispatches.
Separate [JSON-wrapper diagnostics](v09-json-diagnostic-plan.md) and
[interaction-source work](v10-design-candidate.md) have independent engineering admission
approval. They were subsequently registered/frozen at `bf83e682`; current dispatches retain
committed conditions and affordability checks before any new calls. Their controls do not tune or regrade v0.9. Current report changes still require
protected preview and real-Chrome acceptance; historical CA-IB03 proves only its original artifact.

The [fresh v0.9 holdout release](../../../insurance-bench/results/meta/v09-holdout-release.json) is committed separately after the development evidence. It binds the approved audit and all six exact dispatch hashes, unchanged source/harness, three first untouched cases and one trial per model. No held-out result is used to select this release; model/native coverage, token and cost limitations remain subject to terminal audit.


## Pre-inference JSON and interaction review — engineering outcomes only

The separate [v0.9j JSON diagnostic](v09-json-diagnostic-plan.md) and
[v0.10 interaction candidate](v10-design-candidate.md) have implemented, independently approved
engineering admission. Their original admission rejection remains historical evidence; repairs
are verified by the [current gate review](../../../insurance-bench/results/meta/candidate-prepaid-gate-independent-review.json).
V0.9j source `107e4af6` preserves the frozen v0.9 semantic corpus; its
[candidate audit](../../../insurance-bench/results/meta/v09j-candidate-independent-audit.json)
checks source projection and native-condition boundaries. V0.10 source `a6922f85`/full corpus
`80077360` has a [full third-interpreter audit](../../../insurance-bench/results/meta/v10-candidate-independent-audit.json)
of12 cases/72 states/1,152 fields/1,267 alternative proofs and12 full-tool oracles. The separate
[Opus review](../../../insurance-bench/results/meta/v10-independent-opus-review.json) manually
derives only1/12task across four operational phases plus a fraud spot-check; exhaustive coverage
belongs to the independent interpreter, not that partial cross-provider review.

All35 focused controls, typechecking, lint and1,193 serialized legacy tests pass.
These were source/admission results at that checkpoint. Both development registrations were
subsequently frozen at `bf83e682`; current status and initial JSON evidence appear below. Both proposed OpenAI conditions use native JSON to reduce a known serialization confound;
it cannot guarantee schema correctness or supported decisions. V0.10 changes both sources and
transport relative to v0.9 and is not a causal cross-generation difficulty ablation. Two family
labels share status vectors, so three labels do not establish three independent mechanisms.
Professional validity, frontier headroom and the requested50–60 difficulty remain unestablished.
Separately released v0.9 holdouts at74b40433 are terminal and independently audited: both Sol-high and Astra-high100 macro/100 weighted across three fresh cases. Neither result is used to repair its frozen generation.


## V0.9 fresh holdout audit — frontier ceiling retained

The separately committed release74b40433 bound the approved six-panel development audit, exact dispatch hashes, unchanged source/harness and three untouched cases before either call. Sol-high completed all three cases at100 macro/100 weighted, estimated cost$2.186104. Astra-high completed all three at100/100, estimated cost$10.46118. Both have48/48 current facts and sufficient proofs, current scoped requests and completed physical handoffs. No provider, budget, model, effort, truncation or critical-intent flags occurred.

The [independent final audit](../../../insurance-bench/results/meta/investigation-holdout-independent-audit-v0.9.json) replays all six episodes and verifies eighteen saved generations plus41 criterion booleans per episode. Exact terminal native bytes and dispatch hashes are retained alongside the audit reproduction. The shared ledger after all eight v0.9 panels is$62.7549740875/$75, leaving$12.2450259125; these are estimated costs plus retained uncertain-call reservations, not an invoice.

Frontier headroom and Sol effort discrimination remain unmet. Three correlated single-attempt anchors give33.33-point resolution and cannot establish50–60 difficulty or industry rankings. The JSON and interaction conditions were subsequently registered/frozen as separate development experiments; their held cases remain unregistered/unreleased. The development-only controller amendment is independently reviewed before registration and does not rewrite the original four-panel proposal.


## Frozen JSON diagnostic and registered interaction — interim coverage

The separate v0.9j/source `107e4af6` and v0.10/source `a6922f85` development registrations were
frozen at `bf83e682`. Original v0.9 sources and grades are unchanged. JSON diagnostic01 (Luna-low,
three development cases once each) is terminal at **0 macro task success/51.35 weighted diagnostic**
with zero malformed JSON turns. The [interim independent audit](../../../insurance-bench/results/meta/v09j-development-independent-audit.json)
checks all three01 episodes and preserves that historical1/2-panel checkpoint. Diagnostic02
(Luna-high) is now terminal at0 macro/72.40 weighted:3/3 scored attempts, with its final task
incomplete at20 turns. Both panels record no output-limit flag; final independent two-panel audit approves all six episodes. The paired weighted diagnostic difference is21.04points, with descriptive three-case interval−9.37 to40.42 and zero whole-task success at both efforts. This does not establish a general effort advantage.
This is a separate transport/harness condition, not retroactive repair of original Luna grades.

V0.10 has two registered six-case development panels, with the original$5.50 forecast preserved. Both are terminal and fully independently audited. Sol-high01 scores100 macro task success/100 weighted diagnostic, estimated cost$3.825038; Luna-high02 scores0 macro/67.56 diagnostic, cost$0.5691586. All six Luna attempts use 20 turns; three complete and three remain incomplete. Two final stale packets omit E2.R4, E2.R6 and currentPolicyVersionIds. The [full development native audit](../../../insurance-bench/results/meta/v10-development-independent-audit.json) (SHA9cc94c…) and [reproduction](../../../insurance-bench/results/meta/v10-development-independent-audit-repro.txt) (SHAca182e…) verify all 12 episodes and exact 41-criterion replay, without false grades, parse errors, truncation or provider/model/spend issues. The earlier first-panel native SHA5a33851…/receipt5b3f7… checkpoint remains historical.

The [paired development comparison](../../../insurance-bench/results/meta/v10-development-comparisons.json) and [reproduction](../../../insurance-bench/results/meta/v10-development-comparison-repro.txt) record Sol-minus-Luna high32.45 diagnostic points and100 macro points, six case wins, with a descriptive three-family bootstrap interval15.10–43.33. The interval is not population confidence; these small correlated synthetic development observations establish neither a general ranking nor professional validity. The frontier still scores100, so the difficulty target remains unmet. No held evaluation is registered, and this tier contrast is not a matched effort contrast.

After both v0.10 panels are terminal, the shared content-free ledger checkpoint is$67.52235448750021/$75, leaving$7.4776455125. These are API estimates/reservations, including retained uncertain-call allowances, not an invoice or a live/final balance. Earlier checkpoints remain historical; the cap has not been reset. Dispatch checks the authoritative ledger again.

## V0.11 joint-allocation hypotheses — frozen development in progress

The [new design](v11-design-candidate.md) proposes H7 (joint-planning headroom), H8 (reasoning
effort) and H9 (tier difference). Source `9c8a799a`/corpus `4334b018` has twelve cases and36 source
states across three correlated occurrence labels. Eighteen additive packages include twelve
nondominated joint vectors; nineteen factual outputs and eight actual business fields remain
fixed. The exact private solver accepts all optimal ties. All final optima select only **two
packages**, a material limitation on the proposed planning demand. Public source payloads measure
about16.6–17.0KB; longer eligible-package arrays increase output bytes. Search scale and source
measurements are not evidence that any frontier model will score50–60.

The [non-author audit](../../../insurance-bench/results/meta/v11-candidate-independent-audit.json)
reconstructs684 facts/648 eligibility projections and exhaustively visits9,437,184 subsets using a
distinct recursive interpreter; all23 final optimum ties complete through public tools. Full hand
vectors for one task yield21→23→22 across its three phases. Source/capacity/eligibility/cache/clone,
actual write/history/review-scope and protected-intent negatives pass. The
[runtime review](../../../insurance-bench/results/meta/allocation-runner-independent-review-v0.11.json)
and [controller review](../../../insurance-bench/results/meta/v11-controller-independent-review.json)
approve engineering; [bounded Opus review](../../../insurance-bench/results/meta/v11-independent-opus-review.json) also approves engineering only, with partial hand coverage disclosed. [Historical v0.11 verification](../../../insurance-bench/results/meta/v11-implementation-verification.json)
passes43 focused controls, typechecking, narrow lint and1,212 serialized legacy tests/208 suites
in28.376seconds;
the known default-suite Jev concurrency limitation is retained.

The [v0.11 registration](../../../insurance-bench/results/meta/v11-registration.json) fixes development-only order Sol-high, Sol-low, Luna-low, Luna-high, six cases once each. Registration was committed at `2e85` before calls, binding reviewed source `9c8a799a`/corpus `4334b018`. Panel01 Sol-high is terminal at100 macro/100 diagnostic on six cases, estimated cost$2.246036; the earlier incremental audit independently agreed on6/6 with a1/4 incomplete header. The [final native audit](../../../insurance-bench/results/meta/v11-development-independent-audit.json) now approves all four terminal panels and24 episodes, with no issues or pending coverage. Fixed panels02 Sol-low,03 Luna-low and04 Luna-high are also terminal; the earlier first-panel checkpoint remains historical. The post01 content-free reservation checkpoint is$69.76839048750024/$75, leaving$5.2316095125; these are estimates/reservations, not an invoice or a live/final balance. The original fixed$6.25 whole-plan forecast remains historical, and further dispatch uses the authoritative shared ledger. No held evaluation is registered. Frontier target, useful effort/tier
discrimination and insurance-expert validity remain open.


Final V0.11 development findings (after the full four-panel native audit):

| Panel | Macro task success | Weighted diagnostic | Correct facts /114 | Actual current optimal writes /6 |
| --- | ---: | ---: | ---: | ---: |
| Sol-high | 100 | 100 | 114 | 6 |
| Sol-low | 83.33 | 97.67 | 112 | 5 |
| Luna-low | 0 | 84.90 | 99 | 1 |
| Luna-high | 83.33 | 97.67 | 112 | 5 |

Native token-rate cost estimates total $4.7429144. Sol-low and Luna-high each have an eligibility/planning omission in deadline1. Each Luna panel has one recovered JSON event (two total); no output-truncation, provider or critical flags are reported. Facts, proof and current-state gates are correlated; these are not pure insurance-reasoning measurements.

The [paired comparisons](../../../insurance-bench/results/meta/v11-development-comparisons.json) and [reproduction](../../../insurance-bench/results/meta/v11-development-comparisons-repro.txt) were executed after the final native audit. Sol high-minus-low differs 16.67 macro/2.33 diagnostic points, one win/five ties/no losses, with diagnostic family-bootstrap interval0–6.99. Luna high-minus-low differs 83.33 macro/12.77 diagnostic points, six wins, diagnostic interval10.34–15.70. Sol-high minus Luna-high differs 16.67 macro/2.33 diagnostic points, one win/five ties, diagnostic interval0–6.99. These intervals describe weighted diagnostics, not native macro confidence intervals. Three correlated family labels and single attempts do not establish stable population confidence, general rankings or professional validity. Sol-high remains100, so accepted frontier calibration is unmet.

## Historical coupled post-finish boundary finding — no observed paid exposure

The [independent trace audit](../../../insurance-bench/results/meta/coupled-postfinish-independent-audit.json)
confirms the frozen coupled engine checks finished state before protected intent. The runner's
same-response action map can reach that defect; a synthetic perfect oracle retains100/no critical
after finish followed by protected actions. Separate next-turn responses are never dispatched.
The audit checks15 native generation-c runs/39episodes,434turns,976 accepted actions and473
supplementary snapshots and finds **no actual action after successful finish**. There are no
affected retained native rows identified, no historical regrading and no blanket supersession.
V0.11 repairs only the separately named new workflow snapshot: protected post-finish intent now
records critical-zero, with direct and same-batch mock controls. Neither synthetic oracle scores
nor passing source controls are model leaderboard observations.

The JSON terminal cost checkpoint is$0.1380585 for01 and$0.2351253 for02, total$0.3731838;
shared reservations are$63.128157887500016/$75 before the first v0.10 panel settled. These are
configured token-rate estimates plus retained reservations, not invoiced spend or a final live
balance. No retry, retrospective repair or changed frozen condition is implied.


The final [independent JSON native audit](../../../insurance-bench/results/meta/v09j-development-independent-audit.json) approves both panels/all six episodes as source-consistent, including exact replay, all41 criteria, native JSON/effort/usage/cost/configuration, with no false grades or output ceilings. Both have0 macro success. The [paired comparison](../../../insurance-bench/results/meta/v09j-development-comparisons.json) records a21.04-point per-case weighted diagnostic difference, two case wins and one loss; its descriptive bootstrap interval spans−9.37 to40.42 across only three cases. Subtracting the rounded panel summaries yields21.05; the paired analysis uses the native per-case values. This does not establish a general effort advantage. Relative to old strict-JSON v0.9 observations, JSON mode removes observed malformed responses in these samples; the two versions/harnesses remain distinct and the descriptive score changes are not a normalized causal contrast. Current source/proof, review/request scopes and lifecycle failures persist. Shared ledger after both JSON panels is$63.1281578875/$75. No old run is repaired, relabeled or selected for rerun.


V0.11 bounded different-provider source review is complete and engineering-approved atsource9c8a799a/corpus4334b018. Opus4.8 hand-derives one complete three-phase task/all optimal ties; full36-state/exhaustive validation belongs to the independent executable interpreter. Raw review/prompt and receipt preserve exact scope, source/audit hashes and two non-blocking prose corrections. The existing-subscription reference estimate$3.8335715 is not benchmark API spend or an invoice. Registration is committed at2e85 before paid calls; all four development panels are now terminal and the final native audit approves all24 episodes without issues or pending coverage. The earlier first-panel100/100 and1/4 audit checkpoints remain historical; source review does not supply paid outcomes.


## V0.12 dependency component hypothesis — completed development, limits open

The [new design](v12-design-candidate.md) and [author controls](../../../insurance-bench/results/meta/dependency-allocation-author-controls-v0.12.json)
implement H10 in new source/core/adapter/runner/CLI modules without changing old frozen conditions.
Current signed component versions carry optional prerequisites and exclusions; individually
eligible components still require a feasible whole bundle. All ties are accepted; cycles are
complete all-or-none bundles. Twelve fresh tasks retain18packages/19facts/8business fields/three
phases. Fourteen author controls, lint and strict typechecking pass; the separate author raw
binary interpreter visits9,437,184 subsets over36states and35 final-tie public-tool oracles pass100.
Protected post-finish controls are critical-zero through frozen repairedv11workflows.

Final bundles select4–5components and both material stages change optimal sets, but the graph and
initial/clarified patterns repeat across three correlated labels. Static public sources grow
about19–20% to19,669–20,381bytes; shortIDs reduce facts to640–863bytes and actual eight-field
business to286–306bytes. Search/source size and author oracles are not empirical difficulty or
independent correctness evidence. The [full independent source audit](../../../insurance-bench/results/meta/v12-candidate-independent-audit.json)
and [runtime review](../../../insurance-bench/results/meta/dependency-allocation-runner-independent-review-v0.12.json)
now approve engineering at source `3591d68f`/corpus `f8e0df62`; 22 owned controls pass. Source-only
[Bounded Opus engineering review](../../../insurance-bench/results/meta/v12-independent-opus-review.json) now approves the same current source/corpus. Its exact hand scope is one of 12 tasks: phase 1 fully derived from raw source before author annotations; phase 2 capacities/eligibility and one optimum spot-check; phase 3 structural reasoning. It is not a complete three-phase hand oracle and executes neither code nor hashes. Full 36-state/9,437,184-subset/35-final-tie execution belongs to the separate non-author interpreter/runtime. The wrapper preserves the raw prose and clarifies that source/runtime audits existed and no paid native audit/controller/registration existed at that review checkpoint, and the review process was read-only rather than the CLI itself. Raw review, prompt and receipt reproduction remain linked in that wrapper. The existing Max subscription reference estimate $2.3396915 is neither benchmark API ledger spend nor an invoice.

Final current typechecking passes. The separate [report-runtime engineering review](../../../insurance-bench/results/meta/current-report-runtime-independent-review.json) and [reproduction](../../../insurance-bench/results/meta/current-report-runtime-independent-review-repro.txt) approve the pure helper/source changes after an undefined historical-path helper repair; the earlier 21-focused/28-independent checkpoint, full checking and direct ignored-script strict checking remain preserved. The earlier combined-delta report condition was independently approved at source `bbc0b2c5`, with 23 focused and 30 independent controls, full checking and direct-builder strict checking passed. The [new source-only V0.12 report-builder review](../../../insurance-bench/results/meta/current-report-v12-builder-independent-review.json) now approves 10 in-memory controls and direct strict compilation (builder `8288`, review `f168`, [reproduction](../../../insurance-bench/results/meta/current-report-v12-builder-independent-review-repro.txt) `4815`). This does not execute the real builder or publish a report. A later real-builder attempt found a legacy V0.9 holdout freeze/source-versus-release binding defect. Report admission-only repair is now [independently approved](../../../insurance-bench/results/meta/current-report-final-integration-independent-review.json), binding the legacy holdout source/freeze to its separately hashed release parent; benchmark grading is unchanged. The actual static builder passes and generates the report, but publication/protected preview/Chrome acceptance subsequently passed for the exact static synthetic artifact in [CA-IB04 receipt](../../../insurance-bench/results/meta/preview-acceptance-v12-research.json). The [latest local verification](../../../insurance-bench/results/meta/v12-implementation-verification.json) and [reproduction](../../../insurance-bench/results/meta/v12-implementation-verification-repro.txt) record 51 focused controls (22 dependency, 23 report plus admission/JSON controls), current full typechecking and exact source/review hashes. The earlier 1,212-test legacy receipt remains historical; the separate [post-v0.12 SERIAL receipt](../../../insurance-bench/results/meta/post-v12-serialized-legacy-verification.json) now passes1,241 tests/208 suites at2e85, without claiming a default concurrent-suite pass. The source-only Opus review did not execute the report builder. Reviewed controller/registration freeze `774a4c5` preceded the two now-terminal development panels; their final native audit approves six episodes. No held evaluation was registered. The original plan remains frozen; no historical grade is changed or selectively rerun.


Historical V0.12 pre-paid admission preparation (superseded by the completed development findings below): [new prospective development plan](v12-development-plan.md) fixes one high-effort tier contrast, Sol-high then Luna-high on the same three development cases once each, with a$2.50 whole forecast. The parent-confirmed post-V0.11 terminal checkpoint is$72.26526888750007/$75, leaving$2.7347311125 (API estimates/reservations, not an invoice/live balance). The [new controller review](../../../insurance-bench/results/meta/v12-controller-independent-review.json) approves 23 mocked controls and strict compilation at review `c2ab`, controller `a971` and plan `753c`; its [reproducible copy](../../../insurance-bench/results/meta/v12-controller-repro.txt) and [prospective registration](../../../insurance-bench/results/meta/v12-registration.json) now exist. Preparation performed no API call, ledger change or reset. Committed freeze and dispatch-time affordability are still required; no V0.12 ability call or held evaluation exists. Registration-bound [native-audit readiness](../../../insurance-bench/results/meta/v12-development-independent-audit.json) passes 70 mocked metadata controls (source `c62c`, artifact `8de2`), with **zero actual episodes audited**. The [prospective freeze verification](../../../insurance-bench/results/meta/v12-prospective-freeze-verification.json) records this preparation; it is not evaluated ability evidence. Three cases/33.33-point resolution cannot localize50–60 or establish accepted calibration; the engineering design and old frozen conditions stay unchanged.


## Final V0.12 development findings and transport limit

Freeze `774a4c5` preceded both fixed high-effort tier panels. The [final native audit](../../../insurance-bench/results/meta/v12-development-independent-audit.json) (SHA `fe2f5971`) and [reproduction](../../../insurance-bench/results/meta/v12-development-independent-audit-repro.txt) (`9ccf31c`) approve both panels/all six episodes and all 48 recorded criteria per episode, without source/grade inconsistency.

| Panel | Macro task success | Weighted diagnostic | Completed /3 | All-pass /3 | Actual current optimal writes /3 | Estimated API cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Sol-high | 66.6667 | 95.34 | 3 | 2 | 2 | $1.104356 |
| Luna-high | 66.6667 | 95.34 | 3 | 2 | 2 | $0.1226235 |

Both share one source/planning error. The B2 `amount_only` amendment retains B1's clock/deadline17:25, but the current B2 packet lacks the required medical enclosure. Each selects Q1/Q3/Q4/Q6 at priority22, including B-positive Q4/Q6 that are currently ineligible. The actual unique optimum is Q1/Q3/Q7/Q9 at priority18. Six failed criteria arise from this shared factual/planning cause; they are not six independent failures. No registered limitation flags or output truncation are reported. Luna has two recovered extracted-action responses/protocol errors; the exact cause cannot be localized from the stored transport.

The [independent response-phase transport review](../../../insurance-bench/results/meta/response-phase-transport-independent-review.json) confirms the adapter concatenates all message/output_text content while losing phase/block metadata. Mock equivalences demonstrate that a saved prefix or two JSON roots can come from either valid separate commentary/final blocks or invalid final text. Official API guidance calls for preserving phase, but these saved traces cannot establish which occurred. They do not prove a model JSON bug, provider bug, insurance-reasoning incompetence or causal grade impact. All source, native data and historical grades stay frozen; no post-hoc regrading or selective rerun is permitted.

The high-effort tier comparison is tied and therefore **fails discrimination guidance**. The three-case33.33-point macro resolution cannot localize50–60, and professional breadth/validity remain open. A score in the vicinity of the target is not accepted calibration. Source engineering and oracles remain distinct from empirical ability evidence.

Total V0.12 native cost estimate is$1.2269795. The parent-confirmed canonical checkpoint after both panels is$73.49224838750004/$75, leaving$1.5077516125. These are token-rate estimates/reservations, including retained uncertain-call allowances, not an invoice or a live/final balance. Another$2.50 paired forecast does not fit; no further matched calls or cap increase is authorized by this checkpoint.

The next prospective hypotheses are phase-preserving transport with matched remeasurement, representative independently constructed insurance cases, and additional effort/tier replicates before accepted calibration. They require independent source/runtime/admission review, prospective registration and whole-plan affordability; this forward plan does not authorize calls. The report admission-only repair of the legacy V0.9 holdout freeze/source-versus-release binding is independently approved and actual static build now passes; benchmark grading is unchanged. Publication/protected preview/Chrome acceptance passed for the exact static report at1a543f26; benchmark validity and AWS staging/application release remain open. Controlled integrated tests have passed as recorded below; the default concurrent architecture attempt was stopped and is not a passing test:ci run.


## Final static-report build and controlled verification

The [final integration review](../../../insurance-bench/results/meta/current-report-final-integration-independent-review.json) (`e62464`) approves the report-admission-only helper `42463db5`:18 in-memory controls,25 focused controls and direct strict compilation. Legacy V0.9 holdout source/freeze `cf07` and release `74` are exactly bound through the hashed parent. The reviewed ignored builder `9910a2db` covers the two new findings. Neither repair alters benchmark grading, evaluated source or historical native data.

The [actual builder verification](../../../insurance-bench/results/meta/final-research-report-verification.json) passes with27 primary rows,74 retained runs and15 diagnostic contrasts. The generated static report contains only configuration and index output; HTML SHA256 is `9dfb0be1496cc9558239c5faf09841755e8715a730017b06a97c8b21dd89bcdf`. This remains build evidence; the separate [CA-IB04 Chrome receipt](../../../insurance-bench/results/meta/preview-acceptance-v12-research.json) now establishes publication/protected static-preview/browser acceptance at the exact deployed commit/URL, within its synthetic report scope only.

The [V0.12 development comparison](../../../insurance-bench/results/meta/v12-development-comparisons.json) records zero native macro and weighted diagnostic difference. An observed zero bootstrap interval across three paired cases does not prove population equivalence. The tied tier outcome and calibration/discrimination limits remain unchanged.

Controlled verification after main integration (`7c2b8e22`, parent `f236`) is retained in the final receipt with exact log hashes:

- Integrated legacy:1,292 tests/216 suites pass before the helper-only delta;25 focused report controls pass after that repair.
- Architecture, one worker:3,582 pass/45 skipped across253 files (6 skipped),451.46 seconds.
- Web, two workers:985 pass/87 files,50.14 seconds.
- Full typechecking and lint pass, including the helper repair; direct strict compilation against the final source and delivery-policy static checks pass.
- The default concurrent architecture attempt was **STOPPED, exit143**, after recorded timeouts and a pre-merge-commit portability snapshot failure. It is not a passing test:ci run. Receipt log hashes for the stopped attempt and both controlled runs remain preserved; prior checkpoints are not overwritten.

No further paid call occurred and the budget remains the post-V0.12$73.49224838750004/$75 checkpoint. Current report generation does not establish accepted calibration, professional insurance validity or deployment/browser acceptance.


CA-IB04 passed for the exact protected static synthetic report on2026-10-05, deployed commit `1a543f260ce50ebc5d7e850c49642f1b4c6b7e81`: [preview](https://insurance-bench-qz63cdok1-sentanis.vercel.app), [Chrome receipt](../../../insurance-bench/results/meta/preview-acceptance-v12-research.json). [Feature status](implementation-status.md) records deployment/hash/protection and browser checks. Calibration/tier/phase/expert/provider-coverage and AWS staging/application-release gaps remain open. Fresh CI security jobs passed; type/test jobs remain pending, with no final fresh-CI pass claimed.
