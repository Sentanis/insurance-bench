# Insurance Bench candidate 3 independent review

Provider: Anthropic Claude Code authenticated subscription; exact configured reviewer `claude-opus-4-8`. Read-only source review. This reviews engineering correctness and measurement limits, not observed model difficulty.

I've completed a close read of all scoped files and the contracts they depend on (`planning.ts`, `portfolio-cases.ts`, `score.ts`, `types.ts`). Here is the adversarial review.

## Verdict: APPROVE (no blockers) — with documented false-negative/validity findings

No reachable wrong gold, no infeasible planted witness, no hidden-oracle leakage, and nothing that spuriously zeros a correct plan. The suite's triple cross-validation is genuinely strong. The material findings are over-strict evidence certificates and one inert difficulty mechanic — both consistent with the project's own v0.4 audit note ("known citation-certificate false negatives … frontier optimal-planning success limited the intended difficulty discrimination").

---

### What is solid (code-level verification)

- **No reachable wrong gold / source disagreement.** Gold is cross-checked three independent ways per case: `rawScenario` re-parses jobs/staff/approval/budget purely from document text and asserts `toEqual(task.planning)` (`insurance-bench-frontier.test.ts:271-273`); `solvePlanning` and the separate MRV solver `independentOptimum` must agree on `optimalValue` (`:275`, `:281`). I also hand-derived the non-solver facts (closure membership, `mandatoryClosureWorkSlots`, budget, locked set, qualified reviewers, deadline) from the raw docs and they match. The jobs-doc column order written at `frontier-cases.ts:232-244` matches the reader at `insurance-bench-frontier.test.ts:168-204`, and job IDs contain no commas, so CSV parsing is safe.
- **Planted witness is always feasible/mandatory-complete.** Build-time guard `frontier-cases.ts:216-220` throws otherwise. Tracing `set()`: each lane runs early→middle→primary sequentially on one reviewer (no overlap), every dependency finishes exactly at the dependent's start (early+middle=4 per lane, primaries start at 4), `requiredSkill` is drawn from the assigned lane reviewer's own skills, and `startSlot` is always in the generated `allowedStarts`. The booked set is exactly the 11-job closure, so `independentOptimum`'s empty-optional subset is guaranteed feasible and it won't throw.
- **`mandatoryClosureWorkSlots` invariant is exact, not lucky.** Because middle duration = `4 − earlyDuration`, early+middle always sum to 12; total work = 12 + primarySum + last0 + last1 = 21/21/23/22 for variants 0/1/2/3. The `[21,23]` test bound (`:252-253`) holds for every seed/family, so that gold can never drift out of range.
- **Closure is the true mandatory closure.** Mandatory = {2,3,4,11,12}; dependencies only ever point "down" (primary→middle→early, 11/12→primary), and every lane's primary/middle forces its middle/early, so the transitive closure is exactly the hardcoded 11 — matching `jobClosure` size 11 (`:251`).
- **Budget never starves the mandatory closure.** `budget = cap = closureCost + allowance` (allowance ∈ {1,2,3}), so the closure always fits with 1–3 credits of slack for the knapsack over optional jobs 6/19/20. All passes `validate()` bounds (durations 1–3, windows ≤ 8, unique allowedStarts, every skill covered by ≥1 reviewer).
- **No hidden-oracle leakage.** `optimalValue`/`startSlot"`/`approved` header absence and follow-up owner exclusion are all enforced (`:327-333`); the witness `planted[]` and `planning` live only on the task object, never in `documents`.
- **Equal-optima and critical-zeroing behave.** `evaluatePlan.optimal` is purely value-based (`planning.ts:90`), so every equal-value feasible plan passes; empty/partial bookings → `mandatoryComplete=false` → `criticalFailure` → score 0 (`score.ts:149`, test `:290-292`). Oracle reaches 100 (`:289`), so a perfect agent is not capped into any 50–60 band.
- **providers.ts 300s limit is clean.** Single `PROVIDER_TIMEOUT_MS=300_000` applied uniformly to `execFile` (timeout+SIGKILL), AWS CLI (`--cli-connect-timeout 10`, `--cli-read-timeout 295`), and fetch via `AbortController` (`providers.ts:75,90,142-145,179`). Errors withhold payloads, don't retry, and the exec-kill path reports "billing status uncertain." Fully covered by `insurance-bench-providers.test.ts:221-239`. `runner.ts` only consumes it for a status string (`runner.ts:289`); no gold interaction.

---

### Findings (expert-validity judgments, not code defects)

**F1 — The capacity-debit mechanic is mathematically inert; its mandated citation is a false negative. (Medium)**
`frontier-cases.ts:209-213`: `gross = closureCost+allowance+debit`, `cap = closureCost+allowance`, `budget = min(gross−debit, cap)`. Since `gross−debit == cap` identically, **and** the naive `min(gross, cap)` path also equals `cap`, the debit can never change `reviewBudgetCredits` — the answer is always `cap`. The only real skill it tests is "report CAP, not the inflated base." Yet `reviewBudgetCredits` is built with a **single** `evidencePlan` requiring all five sources including the two family-capacity debit citations (`:361-371`), with **no** alternate plan (unlike `earliestMandatoryDeadlineAt` at `:373-378`). So an agent that computes the correct value via the genuinely binding cap+receipt, but omits the outcome-irrelevant debit flags, is marked fact-correct / evidence-failed. To make the debit bind, set `cap` strictly above `gross−debit` (e.g. `closureCost+allowance+1`); otherwise consider adding a cap-only evidence plan.

**F2 — The F1 false negative cascades into `optimalPriorityValue`. (Low–Medium)**
`optimalPriorityValue`'s plan lists `facts: ["lockedJobIds","reviewBudgetCredits"]` (`:389-395`), and `supported()` requires each dependency fact to be *equal and supported* (`score.ts:213-220`). So the same correct-value-but-didn't-cite-the-debit agent loses two evidence sub-criteria (~5 pts), not one. Not a zeroing, but amplifies F1.

**F3 — `approvedJobCount` requires citing all 20 rows. (Low)**
`:352-360` demands a plain citation for every job (jobs-doc or grants-doc plan) to support a count. Defensible as "enumerate to count," but it's the heaviest certificate and a likely false-negative source for agents that cite only the locked rows and infer the remainder. Flagging as part of the known certificate-strictness class, not a blocker.

**F4 — Fixtures are fair/heterogeneous, with one note.** 24 distinct job-shapes are enforced (`:266`), splits are balanced, and variation is seed/family/variant-driven. The one thing *not* bounded is solver cost: the suite only asserts `searchNodes < 2e6` / `< 1e6` (`:276,:283`) rather than measuring headroom. If any future seed pushes a case near the ceiling the suite could become fragile; currently fine but worth a margin check before changing the seed.

---

Bottom line: the planting, feasibility, optimum, and leakage guarantees are sound and well-defended; missing mandatory reviews correctly zero; all equal optima pass; and nothing imposes an artificial score band. The only reachable issues are evidence-sub-criterion false negatives (F1–F3) driven by over-strict/redundant certificates — the exact class your v0.4 audit already recorded — none of which corrupt gold or penalize a valid schedule.

## Disposition and timing

F1: The reviewer read the earlier capacity formula while corpus completion continued. Before freeze or any candidate-3 paid call, the cap changed to closure cost + allowance + 1, while gross remains closure cost + allowance + 2. Independent raw-source audit records two binding debit cases and 22 cap-binding cases. The frozen hash identifies the corrected corpus; the old review observation is preserved above.

F2 and F3: Evidence certificates can reject a correct derivation when sufficient quotations are attached to another fact in the same saved memo. This is an observed measurement limitation, audited separately from factual and actual optimal-plan success. Preserve frozen grades; do not interpret citation losses as substantive frontier headroom. The approved-count certificate remains particularly burdensome.

F4: Independent corpus checks record maximum 346 search nodes versus the hard limit of 2,000,000. This establishes current fixture tractability, not future-seed completeness.

The reviewer approved the implementation with no blockers. Current development outcomes must determine whether the user's 50–60 frontier target and effort/tier discrimination hold. Engineering approval does not establish insurance-expert validity or benchmark difficulty.
