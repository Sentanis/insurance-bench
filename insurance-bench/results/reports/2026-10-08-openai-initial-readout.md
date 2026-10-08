# Insurance Bench: initial OpenAI self-run readout

**Prepared:** 2026-10-08

**Evidence:** frozen `matched-selfrun-v1` cohorts `matched-selfrun-9cac367c55cbc95a` and `matched-selfrun-8461cd93e1516cee`
**Scope:** synthetic insurance workflows plus pinned public LegalBench/Harvey-derived tasks. No live claim records were used.

## Readout

Three model/effort profiles currently have complete, admissible composite scores. Two are the same model at low and high effort; one is a different model at high effort. The newer high-effort cohort finished all five profiles, but four profiles contain task gaps and therefore have no composite score.

| Model | Effort | Composite | Coverage | Status |
|---|---:|---:|---:|---|
| GPT-6.1 Sol | Low | **63.3** | 32/32 | Fully scored |
| GPT-6.1 Sol | High | **63.3** | 32/32 | Fully scored |
| GPT-5.6 Sol | High | **55.0** | 32/32 | Fully scored |

Composite weights are fixed at 25% legal-agent (Harvey adaptation), 15% legal reasoning (18-case LegalBench subset), 20% documents, 20% knowledge work, and 20% synthetic insurance workflows. Scores are task success percentages under this pilot's deterministic criteria; they are not published benchmark scores, expert-validated insurance accuracy, or a safety certification.

## Component scores for fully scored profiles

| Model / effort | Legal agent | Legal reasoning | Documents | Knowledge work | Insurance workflows | Composite |
|---|---:|---:|---:|---:|---:|---:|
| GPT-6.1 Sol Low | 0.0 | 66.7 | 100.0 | 100.0 | 66.7 | **63.3** |
| GPT-6.1 Sol High | 0.0 | 66.7 | 100.0 | 100.0 | 66.7 | **63.3** |
| GPT-5.6 Sol High | 0.0 | 44.4 | 100.0 | 75.0 | 66.7 | **55.0** |

## Why GPT-6.1 Sol Low and High tie

I checked the raw task receipts because the exact tie looked suspicious. The profiles have separate request records; candidate requests are recorded with the requested Low versus High effort, and their LegalBench batch final-response hashes differ. There is no sign that one profile reused the other's saved result files.

The aggregate tie hides case-level movement. Both profiles score 12/18 on LegalBench, but six case outcomes differ: three cases move from fail at Low to pass at High, and three move from pass at Low to fail at High. The other four component outcome totals are identical: 0/3 Harvey tasks, 4/4 documents, 4/4 knowledge-work tasks, and 2/3 insurance workflows. The frozen weighted formula therefore produces the same 63.3 composite for both.

This is a real calibration warning: the score is coarse enough to erase meaningful per-case changes. It is not evidence that additional reasoning effort had no effect. The transport records requested model/effort but does not independently capture provider-reported model identity, so profile identity remains qualified by the configured CLI selection.

The legal-agent result is 0/3 for each fully scored profile under two fixed blinded juries and the original Harvey criteria. This is a pronounced floor effect that needs investigation before treating the overall score as well-calibrated.

## Other high-effort profiles

These profiles completed execution but did not achieve full measured coverage. Their overall scores are intentionally null and are excluded from comparisons.

| Model | Measured | Gaps | Observed gaps |
|---|---:|---:|---|
| GPT-6 Sol | 29/32 | 3 | One interrupted Harvey task; two synthetic workflow transport failures (`CLI_ERROR`) |
| GPT-6 Luna | 31/32 | 1 | One interrupted Harvey task |
| GPT-6 Astra | 31/32 | 1 | One interrupted Harvey task |
| GPT-5.6 Luna | 31/32 | 1 | One synthetic workflow response rejected by the final-output validator |

Interrupted claims were not retried, as required by the frozen protocol. The affected records remain visible as gaps rather than being filled with a new attempt. The workflow `CLI_ERROR` and invalid-final gaps are transport/protocol failures, not proof of a model's reasoning failure.

## Calibration signals and next experiments

1. **Effort discrimination is weak so far.** GPT-6.1 Sol Low and High are exactly tied on all five component scores. This single pair is not enough to conclude that effort has no effect, but the benchmark has not demonstrated effort separation yet.
2. **The Harvey adaptation may be too difficult, underspecified, or poorly aligned to its jury rubric.** All three fully scored profiles receive 0/3. Review task instructions, jury disagreement, and criterion-level evidence before changing difficulty or weights.
3. **The model-tier signal is promising but underpowered.** GPT-5.6 Sol High scores 55.0 versus 63.3 for GPT-6.1 Sol Low/High, but this is one complete profile per family and several benchmark components are coarse-grained.
4. **Improve run continuity and protocol handling before the next matched panel.** Preserve durable progress across interruptions; keep the no-retry rule for any task already claimed, and fix the synthetic workflow transport/validator failures in a new frozen cohort.

## Measurement limits

- Each profile has 32 tasks. The balanced LegalBench subset has 18 cases; it is not a full LegalBench score. Harvey tasks use the original criteria but custom jury scoring; expert validation remains open.
- Documents and knowledge-work tasks are original fictional tasks. Insurance workflows use a synthetic simulator, not staging or production.
- Reported coverage is measured-task fraction. Any gap makes its component and composite score null.
- Cost telemetry is unavailable (`costUsd: null`). Elapsed time is the sum of request latencies, not end-to-end wall-clock completion time.
- The two frozen cohorts have different registered profile sets. Only complete profiles with identical task definitions and protocol are used here; partial profiles are shown only for run diagnosis.

## Source records

Private raw requests, answers, traces, and grader artifacts remain in the local ignored `.tmp/insurance-bench/selfrun/` tree. This report contains only aggregate scores, task identifiers, gap categories, and methodological notes. The source cohort registrations and their hashes are retained in the local run artifacts; the raw results have not been added to Git.
