# Insurance Bench

A reproducible engineering pilot for insurance agents: separately versioned pilot, static portfolio and changing-record and coupled occurrence
corpora, six historical workflow families and a separate three-family coupled track, isolated simulated tools, deterministic atomic grading, real
provider traces and a static report. The [feature specification](../specs/features/insurance-bench/)
owns the methodology and limitations.

## Composite reference site (no inference)

The current standalone builder generates `/` computed reference scores, `/benchmarks/` source/runability documentation, static `/scores.json`/assets and byte-preserved `/research.html`. From the project root:

```sh
npx tsx scripts/build-insurance-bench-composite.ts
```

The [composite contract](../specs/features/insurance-bench/composite-design.md) and [build receipt](results/meta/composite-build-receipt.json) describe212 source profiles/269 observations, fixed25/15/20/20/20 and separate global custom weights. No profile has all five canonical components; display null/missing coverage and mathematical bounds, not model-specific renormalization or confidence intervals. Published/Our Runs recomputes the evidence. Dataset availability is not API access; the guide distinguishes public tasks from private Vals holds, GDPval expert metrics from automated rubrics, and data terms from code licenses. No model/judge call, application DB/function or secret is part of this build. Local14-focused/16-benchmark-architecture/1,308-legacy/full-typecheck/strict-client checks pass. Independent source/engineering and Claude Opus reviews approve this static feature; [CA-IB05 receipt](results/meta/composite-preview-acceptance.json) accepts the [protected preview](https://insurance-bench-24ggnoj3l-sentanis.vercel.app). Wider architecture/web suites and inherited dependency advisories fail, and GitHub CI cannot start because of account billing; the branch remains unmerged. The old CA-IB04 report remains historical evidence.

## Historical harness commands

These reproduce recorded harness generations and are not authorization for new paid inference. Future calls require prospectively admitted access, scope, protocol and spending authority. Static page work needs no new cap request.

```sh
npm ci
npm run insurance:bench -- discover
npm run insurance:bench -- probe --models gpt-6.1-sol,claude-sonnet-4.6,deepseek-v3.2 --budget 75
npm run insurance:bench -- loop --models gpt-6.1-sol,claude-sonnet-4.6 --budget 75
npm run insurance:bench -- run --model gpt-6.1-sol-low --suite coupled --split dev --per-family 1 --repeat 1 --budget 75
npm run insurance:bench -- run --model gpt-6.1-sol-high --suite coupled --split dev --per-family 1 --repeat 1 --budget 75
# Reproduce the historical easier generation explicitly:
npm run insurance:bench -- run --model gpt-6.1-sol --suite pilot --split holdout --variant baseline --repeat 2 --budget 75
npm run insurance:bench -- report --runs insurance-bench/results
```

The [difficulty preregistration](../specs/features/insurance-bench/difficulty-calibration-v0.7.md)
compares exact-model low/high effort and smaller same-family tiers on harder development cases,
aiming for useful frontier headroom without forcing scores. Truncated runs cannot support a clean
paired contrast.

The loop runs a baseline, evidence checklist and final verification reminder on development tasks.
Predeclare hypotheses in the [experiment ledger](../specs/features/insurance-bench/experiments.md).
Inspect results before selecting a harness; freeze corpus/grader/source hashes before holdout. Do
not tune on inspected holdout answers. `--per-family 1` selects one case per family; the default for
`run` is two. `--repeat` repeats the identical selected cases and preserves every attempt. Routing
rules default to documents; `--routing instruction` reproduces the easier calibration generation.
The historical pilot manifest is `freeze-v0.2.json`; challenge calibration uses a separate
`freeze-v0.3.json`; portfolio calibration uses `freeze-v0.4.json`, and frontier calibration uses `freeze-v0.5.json`. Changing-record workflows preserve `freeze-v0.6.json` / `freeze-v0.6b.json` as superseded measurement evidence. The current coupled track uses `freeze-v0.7c.json` for development and `freeze-v0.7c-final.json` for fresh holdout; earlier v0.7 manifests preserve superseded measurements. The CLI defaults to coupled occurrence; use --suite workflows for the superseded changing-record generation; historical manifests pin their source commit and original resource limits, which require that source checkout for exact reproduction. Use `--suite pilot` or `--suite frontier` for those historical tasks.

Only environment credentials are used. OpenAI requires `OPENAI_API_KEY`; Bedrock uses the explicit
profile and region in `models.json`. Optional direct adapters use `ANTHROPIC_API_KEY`,
`GEMINI_API_KEY` and `XAI_API_KEY`. The CLI does not load app env files or query a database.
Discovery never establishes inference access. A probe establishes reachability, not task capability.
Named model entries are never silently substituted. Catalog availability and runnable access differ.

The session uses one shared `.tmp/insurance-bench/session-budget.json`. The original authorized $25 ceiling
is historical. A later internally adopted **$75 conservative ledger ceiling** preserved prior reservations after a budget-increase request that did not explicitly name$75; it is not a provider limit, invoice or new inference authority. See the [budget clarification](../specs/features/insurance-bench/composite-design.md#historical-budget-clarification). For a separately authorized historical reproduction,
pass `--budget 75` to the older CLI: its default $25 would reduce the persisted cap. Never
reset this ledger or switch ledgers to evade the total cap.
Reservations persist across commands, use an atomic lock/write, and cannot increase an existing
ledger cap. Failed calls retain conservative reservations. A lock surviving process termination must
be reviewed manually before removal. No new ledger is authorized for this ongoing study. Costs are token-rate estimates; caches and failed requests require billing
reconciliation. Coupled, workflow and portfolio runs receive 20 turns and challenge runs 10, with a 16384-token output ceiling per call;
historical pilot runs use 4096. Both ceilings include provider reasoning where applicable. The common provider transport deadline is 300 seconds; historical freeze manifests preserve their original limits. GPT-6
defaults to low reasoning; other adapters use the recorded provider defaults. This is a comparison
of configured model systems under a bounded harness, not equal internal compute.

Raw episodes and run JSON are saved under `.tmp/insurance-bench/runs/`; outputs are entirely
fictional. Published evidence is copied explicitly to `insurance-bench/results/`; only static HTML
is deployed. No API keys, provider execution endpoints, source rubrics, or production systems are
hosted.

To rebuild the committed results and deploy a report preview from the project root:

```sh
node scripts/build-insurance-bench-preview.mjs
vercel --prebuilt --scope sentanis --yes
```

The checkout must be linked to the dedicated `insurance-bench` Vercel project with SSO protection
for all deployments. The historical report-only builder emits `index.html`; the new composite builder emits the static routes/data/assets listed above. Use the matching builder and its receipt rather than conflating report-only and composite acceptance. This preview establishes
synthetic report behavior; AWS staging acceptance remains governed by its separate feature contract.

Verification:

```sh
node --import tsx --test test/insurance-bench-providers.test.ts test/insurance-bench-runner.test.ts test/insurance-bench-report.test.ts test/insurance-bench-planning.test.ts test/insurance-bench-portfolio-integration.test.ts test/insurance-bench-workflow-runner.test.ts test/insurance-bench-compare.test.ts test/insurance-bench-coupled-engine.test.ts test/insurance-bench-coupled-runner.test.ts
npx vitest run test/architecture/insurance-bench.test.ts test/architecture/insurance-bench-challenge.test.ts test/architecture/insurance-bench-portfolio.test.ts test/architecture/insurance-bench-frontier.test.ts test/architecture/insurance-bench-workflows.test.ts test/architecture/insurance-bench-coupled.test.ts --maxWorkers=2
npm run check
```

Model scores must be labeled a synthetic pilot until independent insurance specialists validate the
tasks and calibrate the rubrics. Draft prose quality, actual legal correctness, real claim fidelity,
and a reliable industry ranking are not established by these checks.

The report separates primary rows by corpus, harness, split and repetition count, and preserves
condition caveats, truncation and incomplete coverage. Sharing a table alone does not prove a
clean comparison. The [review](../specs/features/insurance-bench/report-panel-review-2026-10-04.md)
records the report controls. The next [evidence experiment plan](../specs/features/insurance-bench/v08-experiment-plan-draft.md)
is prospective; paid runs require reviewed source and exact frozen registration first.
