# Insurance Bench composite reference site

Status: protected static preview accepted by [CA-IB05](../../../insurance-bench/results/meta/composite-preview-acceptance.json), with independent source/engineering and Claude Opus reviews. Repository integration remains pending because wider checks fail and GitHub CI is blocked by account billing. This presentation does not establish insurance capability or professional validity.

## Scores, coverage and profiles — IB-16

The canonical index has fixed component weights:

| Component | Weight | Recorded metric |
| --- | ---: | --- |
| Legal agent work | 25% | Harvey LAB task all-pass, averaged across two judges in the imported Vals cohort |
| Grounded legal reasoning | 15% | Vals LegalBench overall accuracy; this does not itself measure retrieval grounding |
| Document understanding | 20% | OmniDocBench `v1.6_full` end-to-end Overall |
| Professional work | 20% | Historical GDPval human-expert win-or-tie rate |
| Insurance workflows | 20% | Audited frozen V0.12 equally family-weighted completed-task success |

These different metrics form a declared reference index; their common percentage range does not make their harnesses, task pools, human judgments or difficulty equivalent. A canonical score is computed only when a source-qualified profile has exactly one eligible observation for every component. Missing, excluded and conflicting eligible observations remain visible. Conflicts fail closed rather than selecting the largest or newest score. A genuine observed zero is scored evidence, not missingness.

With normalized global weights `w`, observed components `O` and unknown components `M`, the displayed numeric bounds are `L = sum(w[i] * score[i], i in O)` and `U = L + 100 * sum(w[i], i in M)`. Coverage is the observed share of the declared global weights. These are mathematical missing-data bounds, **not confidence intervals**, imputed performance or a ranking. Observed weights are never renormalized separately for each model. The custom view normalizes one user-selected nonnegative weight vector globally; excluded zero-weight components and custom subsets are labeled. Its score never replaces the fixed canonical column.

Published/Our Runs origin controls actually filter observations and recompute both views, coverage and bounds. Search, provider and coverage controls change visible rows. Model identities retain publisher/source profiles and reported settings. Vals profiles can join LegalBench and LAB columns on the same exact publisher identity while preserving their different harness conditions; document systems, historical GDPval and local high-effort profiles remain distinct. Similar family names or guessed effort do not justify cross-source joins. Published evidence availability is separate from currently verified runtime/API access.

The 2026-10-07 snapshot has212 source-qualified profiles and269 observations:149 LegalBench (Vals),76 Harvey LAB (Vals),35 OmniDocBench,7 historical GDPval and2 local V0.12. There are268 eligible observations: the recorded LAB fallback result remains visible but is excluded from single-model composite calculation. **No profile has complete five-component coverage, so there are zero complete canonical scores; this does not mean zero model ability.** Counts/hashes are pinned in the [build receipt](../../../insurance-bench/results/meta/composite-build-receipt.json), [published source receipt](../../../insurance-bench/results/meta/composite-published-source-receipt.json) and [supplemental source receipt](../../../insurance-bench/results/meta/composite-supplemental-source-receipt.json). Future snapshots require their own receipts; these counts are not a promise about live leaderboards.

## Can we run these ourselves? — IB-17

The browser guide at `/benchmarks/` is generated from [composite-docs.json](../../../insurance-bench/composite-docs.json), with primary-source links, metrics, grading, reproducibility and data terms for eight benchmarks:

| Benchmark | Self-run boundary |
| --- | --- |
| Harvey LAB | Public release is runnable with a pinned task/harness version, isolated document sandbox, supported solver and separately available judges; DOCX grading requires document tooling such as pandoc. Public tasks do not reproduce Vals' private held-out cohort. Judge costs and judge disagreement are separate from solver costs/results. |
| LegalBench | Public tasks/prompts/evaluators are runnable with per-task data-license checks. A local prompt/subset/harness is a separate observation from Vals' published overall accuracy. |
| LegalBench-RAG | Public retrieval/span evaluation is a diagnostic, not an imported canonical language-model score or a substitute for missing LegalBench. Control retrieval resources and parent-document overlap. |
| OmniDocBench | Released images/annotations and scorer can be run technically, but the dataset declares research-only/noncommercial use. Apache-licensed code does not override dataset terms; the research/commercial boundary is undefined. Unpaid comparative research may qualify; absence of a sale alone does not establish permission for product-directed model development or selection. Pin `v1.6_full` and the end-to-end metric. The site copies numeric references, not the PDF dataset. |
| OCRBench v2 | Public image/task scoring is a diagnostic with an explicit research-only/noncommercial dataset statement and an unresolved use boundary; no OCRBench observation fills a missing OmniDocBench component. Keep native vision and OCR-assisted tracks separate. |
| GDPval | The220-task public gold subset is runnable; the original1320-task evaluation is not wholly public. Local automated rubric performance is not the historical human-expert win-or-tie rate, nor reproducible historical judgments. The seven imported scores are historical rather than current reruns. |
| FinQA | Public numerical/program evaluation is a deterministic financial diagnostic with data-term checks and safe program interpretation; it does not fill a missing GDPval expert-comparison rate. |
| Local Insurance Bench | We own the fictional harness and can prospectively run admitted profiles, but frozen V0.12 results retain their phase-transport/calibration limits. New phase-preserving comparisons need independent review, frozen conditions, runtime access and prospective inference authority. |

Dataset/code availability does not establish model access, a configured adapter, judge availability, sufficient spending authority, license permission or an equivalent reproduced benchmark. This page build dispatches no solver or judge and provisions no credentials. Exact advertised scores and conditions are source evidence, not a claim that every displayed profile can be called now.

## Static deployment and acceptance — IB-18

The stable UI/build has212 profiles,269 observations,268 eligible observations and zero complete canonical scores, in six static files. Legacy tests pass1,308/1,308 and benchmark architecture16/16. Default architecture tests report38 failures/3,782 passes/48 skips; separate web tests report5 failures/1,018 passes. The57 expansion-artifact inputs and SQL-guard violation files are unchanged from the base; concurrent timeouts remain unresolved. Inherited dependency advisories also fail, and GitHub CI cannot start because of account billing. No complete test:ci or blanket full-suite pass is claimed.

New standalone source comprises [composite.ts](../../../insurance-bench/composite.ts), [curated data](../../../insurance-bench/composite-data.json), documentation, renderer/client/styles and [builder](../../../scripts/build-insurance-bench-composite.ts). Run `npx tsx scripts/build-insurance-bench-composite.ts` from the repository root to assemble the static Build Output and receipt. The root-owned package script may wrap this same builder. The route contract is:

- `/`: canonical/custom reference table, missing coverage, controls and provenance disclosures.
- `/benchmarks/`: benchmark descriptions and self-run/data-term boundaries.
- `/scores.json` and static assets: the same attributed data and client code; no credential or provider endpoint.
- `/research.html`: preserved historical report, source SHA256 `9dfb0be1496cc9558239c5faf09841755e8715a730017b06a97c8b21dd89bcdf`.

The build is static configuration/files only: no application database, API/server functions, model-provider calls, secret access, worker jobs, production claim material or changed product authority. Historical grades, native traces and frozen plans remain unchanged. Prior CA-IB04 accepted the old report artifact; it does not accept the new routes or controls. CA-IB05 requires a commit-bound protected synthetic preview and real Chrome verification of canonical nulls/bounds, globally applied custom weights, actual Published/Our Runs recomputation, identity/provenance exclusions, documentation and research navigation, keyboard/reload/narrow layout, console/network and exact served/build integrity. The [new receipt](../../../insurance-bench/results/meta/composite-preview-acceptance.json) passes for commit `fbffc1145ed4d892a2958872edfaac3f475664ab` at [this protected preview](https://insurance-bench-24ggnoj3l-sentanis.vercel.app). Score/docs/research served bytes match after the single163-byte Vercel feedback injection; embedded score data matches the registered projection. Standalone JSON navigation was blocked by a client extension and is not independently accepted. Repository integration, AWS staging and application release remain open.

## Historical budget clarification

The historical `$75` was an internally adopted conservative evaluation-ledger ceiling after the user's request to increase the budget; that request did not explicitly name `$75`. It is not an OpenAI, Vercel or Bedrock limit, a verified bill, or new inference authority. The prior ledger and reservation evidence remain unchanged. Previous living prose attributing explicit approval of that exact amount is corrected here; frozen plans/receipts are retained as history. The current static page uses no paid model/judge calls and needs no new budget increase. Future self-runs require separate prospective scope/access/spend admission, rather than treating a reproduction command or displayed dataset as authorization.
