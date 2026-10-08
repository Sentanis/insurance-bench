# Insurance Bench v0.7 independent review

Anthropic Claude Code authenticated subscription, exact model claude-opus-4-8. Read-only pre-paid review; raw completed report preserved below.

I've completed a full read of all in-scope files. I did not execute tests or tools (read-only). Below is the independent adversarial review.

---

# Insurance Bench v0.7 — Pre-Freeze Review

**VERDICT: APPROVE** (freeze permitted) with recorded residual validity limits. No defect was found that produces a false grading positive (crediting a wrong/forged/unrecorded plan) or a false negative against the disclosed rules on any hand-checked path. The concerns below are measurement/independence limits, not blockers.

## What I verified as sound

**Grading gate (coupled-engine.ts).** `validActualPlan` correctly requires, conjunctively: `state.phase===2`, `plan.valid && feasible && optimal`, `state.business.selectedCostCents/Value` equal to the recomputed plan, **and** a `matchingWrite` history entry at the current material/draft revision whose payload `proposedPackageIds/cost/value` match. Rebinding only overwrites the three plan fields of `accepted`; the five capacity diagnostics come from the true `phases[2].business`, so `stateCorrect` and the history-payload check in `gradeWorkflowTask` both force correct capacities in state **and** in the recorded write. Forging one side without the other fails. Ties are honored (any plan with `priority===optimalValue`), order-independent (`sameIds` sorts). No weights or caps changed (0.4/0.25/0.25/0.1 preserved; `workflow` recomputed over the 7 coupled criteria). These match the "prepaid criterion mapping" decision: the plan is folded into `workflow:current-state`, not a duplicate criterion. **No false positive path found:** empty plan, all-packages (infeasible), suboptimal, duplicate, wrong-cost, and write-stripped states are all rejected (confirmed in both test files and by trace).

**Derivation (coupled-cases.ts) against the rules.** I traced every rule in `RULES[]` against `deriveCoupledPhase` and the hand-checks:
- Temporal/version/identity endorsement selection (highest version with effective ≤ loss; upload irrelevant; scope/entity/coverage/policy match; expiration exclusive) — correct; `limitSourceA` tests (E-A2→E-A1 on policy/effective flips) pass.
- Dedup by `transactionKey` keeping highest version; unsigned/unposted/future excluded; duplicate identical versions dropped — correct.
- Linked reversal uses the linked indemnity's coverage/claimant, ignores the reversal's own labels, bounded by linked amount, deduped by own key — correct (netPaidA = 6200+j−1200 = 5000+j; penny test).
- Unknown allocation: stays unallocated until resolved, blocks only packages naming its key (`requiredAllocationKey` T-U → Q8/Q12), never becomes zero — correct.
- Reserve replacement (highest version ≤ clock, replaces not adds); PD isolated from BI; occurrence erosion includes unallocated net paid and all BI reserves — correct (reserveTotalBI 9100→7900 test; occurrenceAvailable 15300 with jitter canceling by construction).
- Demand/receipt/extension: replacement root, amount_only inheritance of original receipt/root/duration (999 ignored), strict `received < unextended` cutoff, deadline equality treated as on-time (`< now` late filter vs `>= now` eligibility) — correct.
- Package eligibility = covered ∧ complete receipt ∧ deadline ≥ now ∧ required key resolved; feasibility (person/occurrence capacity) is separate — matches rule 6.

**Leakage / source integrity (workflows.ts).** `publicWorkflowTask` exposes only {id, family, instruction, clock}; `instruction` carries field names/types, never gold values. `optimalValue/optimalPlans/eligible/costCents` are never in documents, `read_record`, `list_documents`, or `instruction` (architecture test confirms). Future-phase docs and future revisions are unreadable (`source_unavailable`). `currentSource` requires exact row-JSON identity at the current material revision, rejecting stale-revision citations. Fingerprint hashes all 10 source files at init; `harnessHash` binds prompt+limits. Budget reserves pessimistically and does not settle failed calls (documented). Authority preserved: `request_external_action`/`declare_human_signoff`/finalization flags are denied and critical; prior human decision and pin retained; history sequence/monotonicity and both phase transitions required.

**Independent control.** `independentMaximum` is a genuinely separate recursive enumerator and is asserted equal to `optimalValue`/`feasiblePlanCount` across all 36 phases; the literal hand-checks pin specific derivation outputs. `subsetsExamined===4096` (2¹²) matches the preregistered ≤4096 bound; `solveCoupled` throws above 12 packages.

## Residual validity limits (must be recorded, not fixed to freeze)

1. **High invariant-credit floor / weak discrimination on the novel component.** The genuinely hard coupled optimization is worth only ~5.7 points of 100: `workflow:current-state` is 1 of 7 workflow criteria (25%/7 ≈ 3.57) plus the single `optimalPriorityValue` fact (40%/19 ≈ 2.1). A model that handles the protocol (phase reconciliation, packet/draft/review binding) and the 18 other facts but **never solves the knapsack** still scores ≈94–96. Consequently the 0–100 headline has a high floor and limited dynamic range for the coupled task's distinctive difficulty; effort/tier separation (CO-2/CO-3) will largely ride on protocol-reconciliation and arithmetic facts, not on the optimization. This does not contradict the spec, which explicitly treats difficulty as unproven and instructs reporting a >60 overshoot rather than forcing it down — but the frozen report must state that the paired/headline deltas are **not** primarily attributable to the coupled optimizer, and `allPass` (binary) remains the only clean optimization discriminator.

2. **Eligibility/capacity derivation is not independently recomputed per case.** The independent enumerator and `evaluateCoupledPlan` both consume the production-derived `eligible/costCents/allocations/personAvailable/occurrenceAvailable`; the only fully independent checks on the upstream coverage∧deadline∧receipt∧unresolved composition are the literal hand-checks, which cover tasks[0] plus the one amount-only case — not all 12 cases/36 phases. A latent eligibility-composition error in an unexercised variant would be inherited by the "independent" control and still reach paid gold. Recommended (non-blocking) follow-up: add a per-case raw-record recomputation of each package's `eligible` and the three capacities from documents, asserted against stored constraints.

3. **Corpus breadth & screen size.** 12 cases, 3 correlated families (shared occurrence model, not independent domains), 2 dev + 2 holdout each; the actual dev/holdout screens use only the first case per family (3+3). Family macro-averaging over 3 clusters with single attempts and a weak bootstrap cannot support stable rankings or effort claims — already disclosed; retain that framing and all null/truncated outcomes.

4. **ISO formatting is an undocumented representation requirement.** Facts `deadlineA/B/C`, `lateDemandClaimantIds`, and `followUp.dueAt` compare by exact string; the gold uses the millisecond-stripped `...:00Z` form (via `at()`), and the only format hint to the model is `task.clock`. A model emitting `.000Z` fails an otherwise-correct value. This is exactly the representation-vs-substance confound the spec warns against; recommend either normalizing timestamps before `equal()` or disclosing the format. Minor; flag spurious timestamp failures in the report rather than reading them as reasoning errors.

5. **Disclosed-but-unavoidable redundancies.** (a) Evidence (25%) is near-duplicative of facts: a broad shared bundle makes `grounded` trivially true whenever the fact is correct, so evidence ≈ facts. (b) The five capacity fields must be submitted in both work-product facts and business state. Both are acknowledged limitations; they inflate the correlation between components and should not be read as independent signal.

6. **Soft quantitative thresholds undisclosed:** memo ≥40 chars and proposal reason ≥20 chars are not stated in the tool manual. Practically harmless (any reviewable prose exceeds them); note so a terse-but-valid memo failure isn't misattributed.

## Scope notes / caveats
- Read-only review; I did **not** run the three test suites, so "tests pass" rests on reading their assertions against the implementation, not execution. All assertions I traced are consistent with the code.
- Historical records, `report.ts`, `cli.ts`, and non-coupled families were out of scope and not assessed.
- I confirmed `kind=occurrence-${family}` follow-up, single follow-up, family `kind` for `apply_business_update`, and the `unknown_business_field`/"exactly these fields" contract are all disclosed via instruction/tool manual — no hidden label/kind requirement was found in the graded paths.

**Bottom line:** the coupled gate is adversarially sound (no credit without a real, feasible, objective-optimal, recorded write; all ties accepted; no gold leakage; authority/history preserved; weights/caps unchanged), and the derivation matches the fictional rules on every hand-checked path. Freeze is acceptable provided the report records limits 1–6, especially that headline/paired deltas are not chiefly driven by the coupled optimizer, that eligibility/capacity lack a fully independent per-case recomputation, and that no 50–60 difficulty or expert-validation claim is asserted.

## Disposition before freeze

Approved engineering review is retained. Independent raw-record recomputation subsequently/alongside the review checked all36phases,684facts,288business fields,432packages and all147456subsets, closing the per-case derivation gap in finding2. See results/meta/coupled-source-audit-v0.7.json. The architecture test received a test-only non-null assertion; full npmruncheck and11architecture checks pass.

Findings4/6: before paid dispatch, the isolated coupled adapter will accept equivalent valid ISO8601 deadline/follow-up instants without changing raw traces, and the coupled system prompt will disclose memo/reason length floors. Existing historical grader remains frozen. Independent narrow verification and updated source hashes precede freeze.

Findings1/3/5 remain validity limitations: the optimizer is only one factual value plus supporting evidence and current-state validation, while packet/review protocol carries other workflow credit. A wrong plan alone loses3.57points; an incorrect optimum also affects that fact/evidence and strict current-draft credit. Headline differences must not be attributed chiefly to optimization. Report actual feasible-optimal business outcomes separately; do not reweight to force50–60. Three correlated families, single attempts, source-bundle/facts correlation, repeated capacity values and ungraded prose remain disclosed.

Final bounded representation review approved before paid dispatch: all8 independent timestamp controls pass, including3/6-digit zero fractions, nonzero timezone/date-crossover equivalents, rejection of shifted microseconds/seconds and invalid calendars/hours, with raw state unchanged. All22 independently derived optimal histories still pass100. Six node controls,18 combined node controls, narrow ESLint and full npmruncheck pass. Final audit records exact source hashes (engine6ff25bf5, runner17000c14, architecture591557b8, cases1a0e2359). No paid outcome informed this repair.

Generation b bounded contract review approved before high/holdout dispatch; results/meta/coupled-source-audit-v0.7b.json records final runner13996919. The bare sourceId output and complete global source bundle are now explicit. unavailable matches unknown loss, out-of-period loss and unmatched base policy, independent of zero/late planning capacity. Original Luna correctly named three source IDs in prose under an ambiguous contract; raw losses remain historical. Cases, engine, numerical gold and weights remain unchanged; both full low panels rerun after b freeze.
