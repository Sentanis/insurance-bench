# Insurance Bench candidate 2 independent review

Provider: Anthropic Claude Code authenticated subscription; exact configured review model `claude-opus-4-8`. Read-only engine review, before scored portfolio calls.

I've read all three files end to end. Below is an evidence-first hostile pass on the engine only (`planning.ts`, `planning-types.ts`, and the test file). I did **not** run anything (read-only), so solver tractability claims are reasoned, not executed.

## What I verified holds up

I tried hard to break the solver's completeness/pruning and could not find a reachable miss:

- **Fixed topological `order` is complete** (`planning.ts:134-139`). Because `index` increments by exactly 1 in both the place branch (`:176`) and the skip branch (`:181`), the set of remaining jobs is fully determined by `index`. Any feasible schedule respects the topological order, and each job is tried as place-at-every-candidate or skip, so every feasible value is reachable. Decision order ≠ timeline order, so same-reviewer jobs placed "out of time order" still work via the occupancy mask.
- **B&B bounds are admissible.** `suffixRequiredCost` (`:154`) is a true lower bound on remaining mandatory cost; `suffixValue` (`:153`) is a true upper bound on remaining value (all values are `>=0`, enforced by `integer` at `:26`). So `:162` never prunes the optimum.
- **Memoization is sound.** The key (`:164`) captures `(index, cost, occupied[], ends-of-needed-later)`. `neededLater[index]` (`:156`) provably contains every dependency any future job reads at `:169-170`, including deps placed at earlier indices. Future max value is a pure function of exactly these components, and the `seen >= value` rule (`:166`) only prunes dominated revisits; strictly-higher-value revisits (`v2 > v1`) pass through, so no underestimate of the optimum is possible — the dangerous direction is safe.
- **Solver/grader agree** on windows, `allowedStarts`, reviewer availability, overlap, approval, dependency finish-before-start, and budget. Unapproved/zero-candidate jobs are uniformly unplaceable; if such a job is in the mandatory closure, `:150` throws (test `:92` covers it).
- **Transactionality** is real: `schedule_review` evaluates a *copy* `[...bookings, booking]` (`:107`) and only mutates on feasibility; `cancel_review` blocks on booked dependents before splicing (`:116`). Tests `:51-67` cover this.
- **No optimum/rubric leakage** through tools: `current()` returns only `value/cost/budgetRemaining/missingMandatory` (`:94`); rejection `violations` describe the submitted plan only. Test `:63` asserts `optimalValue`/`optimal` absent.

## Findings (reachable only)

**F1 — Low/Med · Bounded verification not total over the validated input domain · `planning.ts:161`**
`validate` admits up to 20 jobs / 3 reviewers / 8 slots, but `solvePlanning` throws `"…optimum remains unverified"` past `MAX_SEARCH_NODES`. So an in-spec scenario at the upper bound can make the solver *refuse to produce a gold value*. This fails loud (good), but it means the engine's correctness guarantee is conditional on the (unreviewed) cases corpus staying under budget.
- Counterexample shape (not executed): ~15-20 independent approved non-mandatory jobs with wide windows → large distinct-`occupied` state space; memo helps but worst-case node count is not bounded by anything the validator enforces.
- Test gap: largest test scenario is 5 jobs / 2 reviewers / 4 slots (`test:71,112`). Nothing exercises the spec's upper bound or the node-limit path. Add a near-ceiling tractability test and an explicit `assert.throws(/unverified/)` fixture.

**F2 — Low · Permissive window validation · `planning.ts:27`**
`validate` checks `releaseSlot < deadlineSlot <= slots` and `duration <= slots`, but never `releaseSlot + duration <= deadlineSlot` (only the optional `allowedStarts` path enforces fit, `:30`). A mandatory job with `releaseSlot:0, deadlineSlot:1, duration:3` passes validation yet has zero candidates → `solvePlanning` throws at `:150` instead of the validator rejecting a structurally impossible case early. Graceful, but inconsistent with the `allowedStarts` branch and shifts a validation failure into the solver. No test covers a too-small window without `allowedStarts`.

**F3 — Low · `optimalValue` validation deferred · `planning.ts:91` vs `:53`**
`createPlanner` runs `validate(scenario)` (which does **not** check `optimalValue`); a malformed `optimalValue` surfaces only on the first tool call via `evaluatePlan` (`:53`). Authoring-time bug, not security-relevant (optimum isn't exposed), but construction succeeding on an invalid scenario is a sharp edge. No test.

**F4 — Info / Test-independence gap · `test:112-135`**
The "independent brute-force" oracle calls `evaluatePlan` for feasibility, so solver and oracle share the grader. A defect living in a dimension both read identically (e.g., `allowedStarts` or dependency-timing handling) would pass this cross-check. The enumerator also never exercises 3 reviewers (it pushes only `r2` → 2), `duration > 2`, `slots > 4`, `allowedStarts` beyond `[0]`, or dependency chains deeper than 1. Recommend a truly independent feasibility oracle and widening the fuzz ranges.

**F5 — Info · Tool-path coverage gap · test file**
Approval rejection is tested only through `evaluatePlan` directly (`test:43`), never through `schedule_review` (the `!job.approved` → infeasible → `"Booking rejected"` path at `:108`). Also no assertion on `schedule_review` returning `violations` content. Cheap to add; closes the authority-boundary check on the actual tool surface.

## Non-findings I explicitly cleared
Value/cost are added before some `continue`s in `evaluatePlan` (`:61` before `:64`/`:67`), but only on already-infeasible plans and planner bookings are always feasible, so no grading or tool-reporting error. Self-dependencies and cycles are caught (`:36-46`). Mask overflow is impossible (max bit 7, `:146`). Tied optima are accepted by the grader (test `:17`) and the solver only needs the *value*, so memo-pruning tied alternatives is harmless.

## Merge verdict
**Approve the engine with nits.** The solver is complete and correctly pruned, the grader accepts tied optima, tools are transactional and leak-free, and verification failures are explicit rather than guessed. No reachable incorrectness found in `planning.ts`/`planning-types.ts`.

Gate merge on: (F1) confirming the cases corpus stays within `MAX_SEARCH_NODES` and adding a ceiling-tractability + node-limit test; optionally (F2) tightening window validation and (F4/F5) adding a solver-independent oracle plus tool-path approval/violation tests. F3 is cosmetic.

## Verification limits
Read-only pass: I did not execute the tests or the solver, so F1's tractability at the input ceiling is reasoned, not measured. Per scope I did not review the cases module or root integration (reported in progress) — the solver↔grader↔tool contract is only validated here against the in-file tests; whatever feeds `PlanningScenario` (notably `optimalValue` provenance and scenario sizes) is outside this pass. No shell/network/DB/credentials were touched.

## Disposition

F1: All 24 portfolios re-solved in 106 ms, maximum 260 nodes versus 2,000,000 hardbound. Added deterministic lower-bound ceiling tests that cannot raise the hard cap. F2: structural window validation now requires duration to fit. F3: planner construction validates the optimum. F4: replaced shared-grader feasibility in the brute-force oracle with independent direct row/slot checks and added aneight-slot, three-reviewer dependency-chain fixture. F5: actual scheduling-tool approval denial and violations tested. All 11 planner tests pass. A separate source parser reconstructed 432 jobs, 48 staff records and 240 gold facts from raw visible records, all matching hidden normalized data; its optimizer uses the production engine, while corpus tests provide separate optimizer checks.

Integration/corpus review approved below; expert insurance validity remains open.

## Integration and corpus review

I've completed a thorough read-only inspection. Here is my adversarial review.

# Insurance Bench candidate2 v0.4 — Independent Adversarial Review

**Scope:** `portfolio-cases.ts`, `planning.ts`, `planning-types.ts`, `score.ts`, `tools.ts`, `runner.ts`, `cli.ts`, three new portfolio tests, plus `providers.ts` (timeout) and the v0.4 preregistration. Read-only; no files modified, no commands run, no env/credential access.

## Verdict: **Approve.** No reachable correctness or fairness blocker found in verified engine behavior. Five minor findings below (none critical); actual difficulty/model separation remains **pending paid calibration**, not verified.

---

## What I verified (engine behavior, not model outcomes)

**No answer leakage.** `publicTask` exposes only `{id, family, instruction, clock}`; `rubric` and `planning` (incl. `optimalValue`) are never serialized to the model (`tools.ts:133`, `runner.ts:166`). The jobs register publishes `approval_ref` but no `approved` column, so locked status must be derived (`portfolio-cases.ts:298-313`). `optimalValue` appears in no document (computed only). The legacy doc's "1000-point" and "all approved" cache are explicit decoys, and the instruction forbids copying it. The architecture test independently asserts visible JSON lacks `optimalValue`/`bookings`, that `instruction` omits the follow-up owner/kind, and that `routing` omits `dueAt` (`insurance-bench-portfolio.test.ts:297-312`). ✔

**Raw packet vs hidden approvals/gold.** Approval is derived from grant/replacement/condition events; the architecture test re-derives `approved` and `lockedJobIds` from raw rows via a wholly separate parser and matches the engine for all 24 tasks (`:206-264`). I hand-checked the trap cases and they are consistent: job 14 (replacement effective 16:30 > 16:00 clock → timing-gap lock), job 15 (wrong-scope `other-matter`), job 16 (pending condition), job 17 (unsigned draft), job 18 v3 (prior-version proof `A18-v1` ≠ required `A18-v2`), job 6 v1 (future verification 16:10) and v3 (prior-version proof). Mandatory set `{2,3,4,11,12}` and their closure `{1,2,3,4,5,9,11,12}` are always approved, so the locks never strand a mandatory review. ✔

**Gold is dual-verified.** `solvePlanning` (branch-and-bound with memo/prune) computes the hidden optimum, then re-checks its own result through `evaluatePlan` (`planning.ts:201-202`). The architecture test cross-checks every optimum against a structurally independent subset-enumeration + CSP forward-checker (`independentOptimum`, `:192-205`), and the unit tests add brute-force oracles over 8 slots/3 reviewers (`insurance-bench-planning.test.ts:160-219`). This directly closes the "wrong gold" risk. ✔ (Caveat per preregistration §"Gold verification": this is a solver-checked-by-its-own-evaluator + independent-code audit, **not** expert realism validation.)

**Valid alternative schedules accepted.** `evaluatePlan` grants `optimal` on `feasible && mandatoryComplete && value === optimalValue` — any tie, any reviewer assignment, any booking order (`planning.ts:90`; test `:44-51`). `list_schedule` never returns the target (`tools.ts:16`; test `:93`, `:32-33`). ✔

**Critical-zero = public mandatory obligations, not score caps.** For portfolio tasks `criticalFailure` reduces to (a) any external-action attempt, or (b) `!plan.feasible || !plan.mandatoryComplete` (`score.ts:130-136`). No portfolio fact sets `critical: true`, so the `missedCriticalFact` and deadline-triage follow-up clauses never fire — zeroing is driven solely by the publicly-declared booking/deadline obligation. The integration test confirms a perfect prose packet with **no reservations scores 0**, and only rises to 100 after the optimum is actually booked (`insurance-bench-portfolio-integration.test.ts:22-26`). ✔

**Fixed matched effort/tier limits.** Portfolio runs use 20 turns and 16384 output tokens; `runPanel` bounds are inclusive (`maxTurns ≤ 20`, `maxOutputTokens ≤ 16384`), and `cli.ts:186-189` sets exactly these for the `portfolio` suite. Provider deadline `PROVIDER_TIMEOUT_MS = 120_000` is enforced for both OpenAI (AbortController) and Bedrock paths (`providers.ts:75,89,158,177-178`). `harnessHash` folds in `maxTurns`/`maxOutputTokens`/system prompt and `datasetHash` folds in the frozen corpus, so paired comparisons are structurally matched; reasoning effort is the recorded independent variable. The note correctly warns the 16384 ceiling is inclusive of hidden reasoning. ✔

**Minimal-sufficient evidence (v0.3 overcitation addressed).** Every anchor is an operand or operative rule for its fact, not generic boilerplate: `lockedJobIds` cites the replacement journal rows + the unsigned-draft grant row + the relevant condition lines + the two precedence rules; `reviewBudgetCredits` cites B-base/B-add/CAP + the receipt; `earliestMandatoryDeadlineAt` cites the mandatory rows + the slot→UTC rule. `supported()` accepts any doc substring containing the anchor, so lossless presentation choices don't fail (`score.ts:153-171`). This is the direct remedy for the v0.3 citation false-negatives. ✔

---

## Findings (all minor; none blocks approval)

1. **`optimalPriorityValue` evidence does not require a reserved/verified schedule (permissive-leaning; diverges from preregistration §Gold-verification #5).** `fact:optimalPriorityValue` + `evidence:optimalPriorityValue` are earnable by stating the correct number and citing the job header + "maximize the sum of priority_units" rule — **without any booked optimal schedule** (`score.ts:37-52`, `portfolio-cases.ts:515-518`). The preregistration states an "optimum-value evidence certificate requires an actually reserved and verified optimal schedule; a quoted … optimum alone is insufficient." The booked demonstration *is* gated, but only by the separate `workflow:priority-optimal` criterion, not by this fact's evidence. **Mitigant:** stating the correct optimum still requires solving the problem (it is nowhere leaked), and full optimality credit (workflow) remains schedule-gated. Severity: low; worth aligning the evidence gate with the written criterion or documenting the intentional split.

2. **Workflow-proposal `owner` is inferred, not explicitly stated.** `routing` names `portfolio-supervisor` as the follow-up owner and gives only the workflow *status* (`portfolio-cases.ts:413`); the rubric also requires `workflow.owner = …portfolio-supervisor` (`:552`). The branch convention (one owner per branch, applied to both the follow-up and the proposal, mirrored by the "Otherwise/desk" branch) makes this well-supported, so I rate it a very-minor potential false-negative, not a defect.

3. **Combined planning+fact `score=100` is asserted for only one task.** The integration test exercises full 100/all-pass end-to-end for `generatePortfolioCases()[0]` (deadline-triage); the architecture test verifies all 24 at the fact/evidence/workflow(no-plan)/boundary level and separately plays each optimum through the tools, but never asserts the *combined* 100 for all 24. Components are independent and individually verified, so risk is low — a one-line loop over all tasks would close the gap.

4. **Strict numeric-type equality.** `equal` uses `actual === expected` (`score.ts:16-26`); a model emitting `"17"` for a numeric fact fails even though the value is right. The instruction specifies the type per field and the tool accepts numbers, so this is defensible strictness, but it is a possible presentation false-negative for models that stringify numbers — the exact class of defect the preregistration asks you to watch.

---

## Pending vs verified (explicit per request)

- **Verified now (engineering controls):** leakage absence, approval derivation, dual-solver gold, tie acceptance, critical-zero semantics, matched 20-turn/16384-token/120s limits, targeted evidence — all backed by the three new test files and the preregistration's verification checklist.
- **Pending paid calibration (NOT verified):** the 50–60 difficulty target is explicitly *aspirational*; no v0.4 portfolio model run exists in-tree. The two untracked result JSONs dated `2026-10-04T01-23-*` are **superseded v0.3 challenge runs** (`"version":"insurance-bench-challenge-v0.3"`), not v0.4 portfolio data, and predate the v0.4 registration timestamp (01:37:33Z). Substantive difficulty (PC-1), effort effect (PC-2), tier separation (PC-3), the plan-vs-prose gap (PC-4), and expert realism therefore remain unestablished until the preregistered matched screen and fresh-holdout runs execute.

**Bottom line:** The v0.4 portfolio engine is correct and fair on every reachable path I could inspect, and the superseded-v0.3 failure modes (factual saturation, citation false-negatives) are structurally addressed. The engine nits are limited to finding #1 (evidence/schedule coupling for the optimum certificate) and the cosmetic items above. Difficulty and model-discrimination conclusions must await the pending paid panel.

## Final pre-call dispositions

Finding1 was fixed before freeze: optional portfolio evidence certificates require a verified optimal reserved schedule. Finding3 is covered by all24 complete oracle episodes at100/all-pass in the final architecture tests. Final certificates bind relevant fields to their source row beginning with its exact record ID, with sufficient alternatives and grounded derived operands. The reviewer read earlier source during concurrent completion, so its observations about former quote anchors are historical. The existing explicit numeric types remain a declared protocol requirement; any corresponding formatting-only failure will be disclosed separately. Finding2 remains a minor wording limitation: routing names the branch owner for follow-up and implies the same owner for the workflow proposal. It does not add a critical failure. No post-outcome corpus edits were made.
