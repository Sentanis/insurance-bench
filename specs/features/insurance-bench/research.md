# Insurance Bench research and design record

Reviewed **2026-10-03**. Sources below are primary publisher/researcher documents. Design choices
are Insurance Bench proposals, not claims that another benchmark validated insurance performance.

## Relevant benchmarks

| Source                                                                                                           | Verified design                                                                                                                                 | Insurance Bench implication                                                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [Harvey Legal Agent Benchmark, May 6 2026](https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark) | Short assignments, a closed client matter, reviewable work product and atomic rubrics. Its completion measure requires every criterion to pass. | Use a synthetic claim dossier, deliverable and next step. Pair all-pass completion with diagnostic partial credit.      |
| [Harvey BigLaw Bench, August 29 2024](https://www.harvey.ai/blog/introducing-biglaw-bench)                       | Bespoke task rubrics distinguish substantive answers from verifiable source support.                                                            | Report factual and evidence components separately; a plausible unsupported memo must lose traceability credit.          |
| [SWE-bench Verified](https://www.swebench.com/verified.html)                                                     | Human-filtered solvable tasks and a fixed minimal agent setup for model comparisons; harness versions affect comparability.                     | Test the grader independently, inspect solvability, record harness version and compare identical task panels.           |
| [Terminal-Bench 2.0 and Harbor](https://www.tbench.ai/news/announcement-2-0)                                     | Task quality review addresses brittle external dependencies; agent evaluation has a portable environment/harness.                               | Freeze a local document/tool environment and avoid external websites or changing real-world clocks inside scored tasks. |
| [Original tau2-bench paper](https://arxiv.org/abs/2506.07982)                                                    | Compositional verifiable tasks and a shared tool environment distinguish reasoning from communication/coordination failures.                    | Grade required state/action outcomes and traces rather than trusting statements that an action happened.                |

Harvey LAB is the closest structural model for this request. Its expert-written rubrics and breadth
are materially stronger than this initial pilot. Insurance Bench must acquire its own insurance
expert review rather than inherit Harvey's validity. No Harvey/coding tasks or datasets are copied.

Version caution: the [Terminal-Bench homepage](https://www.tbench.ai/) now presents **4.0**; the
[tau2 repository](https://github.com/sierra-research/tau2-bench) now introduces **tau3** and records
July 2026 grading corrections with comparability consequences. This design cites the specific
original methods above, not a claim that 2.0/tau2 are the latest editions.

## Source-level Sentanis mapping

The following documents supply product vocabulary and authority boundaries. They contain system
contracts, not a sampled production dataset.

| Task family              | App contract inspiration                                                                                     | Fabricated scored work                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Deadline triage          | [`../../logic.md`](../../logic.md), TLD Material Reading and Human Review Gates                              | Reconcile demand receipt/version/deadline, assign urgency and review follow-up using a fixed clock.               |
| Coverage review          | [`../canonical-claim-model/specification.md`](../canonical-claim-model/specification.md), policies/coverages | Reconcile policy period, limits and endorsements; identify ambiguity and route human review.                      |
| Financial reconciliation | Canonical `financial_items` payment/reserve ledger                                                           | Distinguish indemnity from expense, paid from outstanding reserve, detect duplicated ledger entries.              |
| Evidence brief           | [`../document-intelligence/`](../document-intelligence/) and [`../decision-support/`](../decision-support/)  | Build facts from discovered documents, cite support and preserve unresolved contradictions.                       |
| Fraud referral           | [`../../logic.md`](../../logic.md), Fraud and SIU Triage                                                     | Distinguish signals from findings, cite observations and propose SIU review without accusation/adverse action.    |
| Workflow handoff         | [`../claim-workflow-state/`](../claim-workflow-state/)                                                       | Identify operational wait/owner, create a simulated follow-up and propose rather than confirm a state transition. |

Shared tooling exercises document discovery, selective reads, structured submission and state
proposals. Scenario rules are supplied in the dossier, so the pilot measures evidence-grounded
execution instead of uncited jurisdiction-specific legal recollection. Distinct policy versions,
irrelevant documents, missing facts, contradictory notes and embedded malicious instructions should
probe common errors.

## Iteration plan and hypotheses

- **H1, evidence checklist:** asking for a source-linked fact inventory before submission improves
  evidence/all-pass scores. Falsified if matched task scores stay flat or regress, or only token
  spend rises. Check whether extra citations are fabricated.
- **H2, validate before submit:** a final completeness check against the public output/tool contract
  improves required follow-up and workflow completion. It may increase latency or overfit
  formatting; it must never reveal hidden expected facts.
- **H3, measurement audit:** repeated near-perfect scores may mean easy tasks or a permissive grader.
  Test corrupted facts/citations, blocked-action attempts, omitted follow-ups and alternate correct
  expressions independently before making tasks harder. A detected rubric defect creates a new
  version and requires regrading/rerunning affected panels.

- **H4, workflow discovery:** require agents to recover action routing from source documents rather
  than copy exact arguments printed in the assignment. Independently verify solvability and compare
  models only on the same revised corpus. Corpus difficulty changes cannot count as harness gains.

The [experiment ledger](experiments.md) records calibration corrections, matched genuine-provider
results, null H1/H2 outcomes and preregistered H4. The first matched GPT panel returned the same
98.96/100 score and 83.33% all-pass completion for baseline and both reminders; an omitted
fact-specific current-gate citation persisted. This does not establish a generally superior prompt.

The v0.2 generation freezes document-discovered routing, common tool batching and the
exactly-one-follow-up requirement before holdout. Provider finish reasons are traced. The heldout
outputs are evaluation evidence; they cannot drive edits to this frozen generation.

Development iterations use a small accessible model panel rather than the entire catalog. Compare
variants on the same tasks and resource bounds; select by score, safety failures and cost rather
than one favorable example. Freeze before running holdout. The first corpus is small and templates
may be correlated: family scores and per-task failures are more informative than fine rank ordering.

## Validity gaps and next evidence

Engineering labels have not been calibrated against independent adjusters or coverage counsel. The
pilot omits image/PDF perception, genuinely long document collections, real user coordination,
product UI execution and external systems. Exact field/anchor checks, mandatory document-read trace
and memo keywords are useful for controlled correctness but do not grade legal writing or fully
assess an insurance brief.

Next evidence should include independent expert rubric review, alternative correct answers,
false-positive grader audits, genuinely different holdout scenario mechanisms, at least three
repeated trials for reliability estimates, and more difficult cases if the first edition saturates.
A public benchmark release should keep an unseen evaluation set and specify contamination policy;
publicly committed pilot cases cannot remain secret holdouts.

The completed v0.2 GPT holdout (12 cases, two attempts) scored 97.88 with 19/24 all-pass and no
critical failures. Its exact-string rubric rejected `Medical attachment M-2` against `M-2` despite
the same identified missing attachment. This is a measurement false negative to report honestly,
not grounds to retune a frozen holdout. Future identifier normalization and semantic prose review
require independent calibration in a new generation. See the ledger for repetition variation and
fact-specific citation failures.

Completed open-model holdouts further separate weighted score from strict completion: DeepSeek
90.52/33.33%, Qwen 88.85/8.33%, GPT-OSS 86.15/8.33%. Matched development reminders do not improve
all models; DeepSeek verification improved its six-case score and all-pass count, while other
conditions produced weighted-score/all-pass conflicts. These small, single-trial comparisons are
hypothesis evidence, not a stable industry ranking or permission to automate claims decisions.

Claude Sonnet 4.6 completed its 12-case holdout at 93.23 with 25% all-pass, 0 critical failures and
82.92 evidence support. The complete pilot panel is GPT, Claude 4.6, DeepSeek, Qwen and GPT-OSS;
Kimi lacks a complete panel, tested latest Anthropic/Grok candidates lack access on the configured
path, and Gemini is an access/credential gap. These gaps remain explicit rather than silently
substituting older reachable models for claims about the latest slate.
