# Matched self-run evaluation

Status: independent engineering/data review approved; prospective source committed at c69a5e73; actual frozen cohort matched-selfrun-9cac367c55cbc95a is running. Complete scores and CA-IB06 remain pending. The published reference page and historical native experiments remain separate.

## Common tasks and score — IB-19

`matched-selfrun-v1` measures one common 32-task development panel. It uses the reference index's weights with different, explicitly adapted component metrics:

| Component | Tasks | Weight | Metric |
| --- | ---: | ---: | --- |
| Legal agent work | 3 | 25% | Public Harvey insurance text artifacts; original 38/39/40 criteria; mean of two fixed blinded juries' task all-pass judgments |
| Legal reasoning | 18 | 15% | Balanced LegalBench insurance-policy subset accuracy, with five official demonstrations |
| Documents | 4 | 20% | Original fictional two-page PNG tasks; exact typed field all-pass |
| Professional work | 4 | 20% | Original fictional accounting, vendor, schedule and forecast tasks; exact typed field all-pass |
| Insurance workflows | 3 | 20% | Fresh synthetic dependency-allocation development episodes, seed 202610071; existing simulator task all-pass |

Each component is an equal task mean. Composite = 0.25 legal-agent + 0.15 legal-reasoning + 0.20 documents + 0.20 professional + 0.20 insurance. A missing measurement makes its component and the composite null; missing access is never zero ability. A completed incorrect answer is zero. Exhausting 20 completed native turns is a measured resource-budget failure; each response permits at most 20 actions. These small development samples are descriptive, with no stable ranking, confidence or independent insurance-expert validity claim.

The legal sources are pinned in `selfrun-source-receipt.json`. Harvey's release is MIT; retain the full copyright/permission notice in each redistributed actor packet. The selected LegalBench task is CC BY 4.0; retain attribution, license and modification notice. Original synthetic tasks contain no live or claim-derived material. OCRBench v2 and OmniDocBench remain future research candidates with undefined research/commercial boundaries. No restricted OCR images are in this cohort. GDPval's historical expert preference metric and Vals' private native scores are not reproduced here.

## Model and transport conditions — IB-20

The canonical profile catalog contains GPT-6.1 Sol, GPT-6 Sol, GPT-6 Luna, GPT-6 Astra, GPT-5.6 Sol and GPT-5.6 Luna, each at low, high and max (18 profiles). A cohort may freeze the full catalog or an explicit canonical profile-ID subset before dispatch; omitted profiles are outside that cohort, not failures. Explicit dispatch uses the existing signed-in ChatGPT Codex CLI, with at most three registered profiles active at a time. No direct metered provider API fallback is permitted within this cohort. The historical $75 ledger is neither a new cap nor spending authority for this run.

LegalBench uses one fresh 18-case batch in frozen order. Each other static task starts a fresh request. Each native turn starts a fresh request carrying the chronological public simulator conversation as text. This is a configured agent-system evaluation, not a native Responses API role/phase comparison. No source browsing, shell, file tool, extra subagents, self-grading or provider fallback is allowed. The transport rejects any observed tool event, explicit non-final message, ambiguous final, model mismatch, sensitive payload or unconfirmed termination. Scoped CLI feature switches plus a harmless functional tool canary provide enforcement evidence, without establishing operating-system filesystem isolation. Missing provider identity remains unknown rather than verified from configured flags.

Harvey juries are fixed GPT-6.1 Sol high and GPT-6 Astra high across all candidates. Their usage is separate from candidate usage. Actual CLI input, cached-input and output counters are retained; cached input is a subset of total input. Reasoning tokens are optional. Cost is unknown, not zero. Request latency totals are not elapsed wall-clock runtime. Failed requests with observed token usage still contribute to usage totals.

## Freeze, admission and publication — IB-21

Preparation creates an answer-free actor directory outside the repository and a separate ignored private controller/result directory. Freeze hashes cover code dependencies, public source receipts, exact profiles/juries/limits/weights/context policy, PNG bytes and aggregate private grading state. Exclusive claims prevent ordinary retries, collisions and silent replacement. Resume attempts only previously unattempted slots. A repaired transport or altered task suite needs a new cohort; historical responses are never overwritten.

Static publication must derive grades and telemetry from frozen registration and durable raw response evidence, rather than admitting arbitrary summary JSON. Public projection exposes component scores/counts, missingness, configured profile, usage and aggregate provenance only. It excludes raw candidates, rubrics, gold answers, hidden future phases, diagnoses and absolute private paths. `/self-runs/` is a separate matched cohort; it does not fill gaps in the published native reference table. The original `/research.html` remains byte-preserved.

The first live calls require passing transport/source/data/coordinator review and a committed prospective protocol. CA-IB06 must then verify the exact protected Vercel build in real Chrome. This is static synthetic preview acceptance, not production-classified AWS staging or application workflow acceptance.

## Prospective hypotheses and next loop — IB-22

Record these hypotheses before examining scored outputs:

1. Higher effort increases deterministic success within at least one model family, particularly in stateful revision/dependency tasks.
2. Stronger tiers outperform lower tiers on at least one component; an unchanged ceiling or correlated failure is evidence to revise the panel, not proof that tiers are equivalent.
3. Image-only field reconciliation and original professional-work products add discrimination beyond the sampled legal classification tasks.
4. Harvey jury disagreements are material measurement uncertainty; report them separately from exact deterministic outcomes and avoid attributing a difference to reasoning effort without repeats.

The desired frontier range is approximately 50–60%, with room for improvement. This first frozen panel is a calibration screen, not a guarantee of that difficulty. Report ceilings, floors, ties, partial coverage and strict-format failures. Propose a later preregistered experiment rather than modifying tasks, labels or grading after observing this cohort.

Claude/Google handoff packets must use the same answer-free inputs and declared context policy. Unsupported model IDs or effort levels stay explicit. A highest supported effort mapped to `max` is a mapping, not a separately measured native max condition. Stateful tasks require the controller's turn-by-turn exchange; a single chat answer cannot reproduce their full score.

## H5 deadline feasibility follow-up

The first GPT-6.1 Sol max Harvey candidate exceeded the registered600-second transport deadline, without a final response or scored answer. Preserve that parent gap. Before any additional call, register one separately claimed H5 experiment on that exact public prompt/model/effort with a3600-second deadline. It tests whether a usable final is reachable under a longer deadline; it is not a parent retry, score, jury run or best-of selection. Concurrent baseline traffic and cache effects prevent causal latency conclusions. No additional API billing or new provider authority is introduced. The private registration/transport summary retain input/code hashes and actual nullable usage; the parent frozen source remains unchanged.
