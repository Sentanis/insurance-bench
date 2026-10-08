# Insurance Bench v0.6 independent adversarial review

Provider: Anthropic Claude Code authenticated subscription; exact configured model `claude-opus-4-8`. Read-only review, before any v0.6 benchmark inference. The initial verdict below requires semantic/gold repairs before freeze; preserve it rather than replacing it with a clean result.

# Adversarial Benchmark-Validity Review — Insurance Bench v0.6 dynamic workflows

**Verdict: REJECT (changes required before freeze).** Two Medium gold/validity defects must be fixed before the pre-freeze manifest is locked; several Low notes should be recorded. No v0.6 paid result exists, so **difficulty (frontier 50–60) and effort/tier separation remain unproven and must not be asserted** — the suite proves only oracle-acceptance and false-positive guards. All invented-fixture, no-leak, accounting, and critical-boundary controls otherwise hold.

## Sources actually inspected
- In scope (full read): `insurance-bench/workflow-types.ts`, `workflow-cases.ts`, `workflows.ts`, `workflow-runner.ts`, `test/architecture/insurance-bench-workflows.test.ts`, `test/insurance-bench-workflow-runner.test.ts`.
- Referenced contracts (as necessary): `insurance-bench/types.ts`, `runner.ts` (Budget/hash/Episode), `score.ts:225` (`summarize`), `tools.ts:115` (`parseActions`), `providers.ts:75` (`PROVIDER_TIMEOUT_MS`), and `specs/.../difficulty-calibration-v0.6.md` (to confirm "evaluation pending / aspirational and unachieved").

---

## Medium findings (pre-freeze blockers)

### M1 — coverage-review gold is ambiguous and the derivation silently ignores the rule's replacement condition (reachable in `ibw-coverage-review-dev-1`)
Rule text: *"Use the latest signed same-entity endorsement effective no later than the clarified loss instant… A later uploaded correction may replace an earlier endorsement only when its own effective time and entity scope match."* (`workflow-cases.ts:18`).

The derivation (`workflow-cases.ts:161-170`, limit at `181-186`) selects by **highest `version` among loss-eligible same-entity signed endorsements** — it never checks the "effective time … match" replacement clause at all.

In variant 0 (phase 2, `build` at `workflow-cases.ts:541-581`): `endorsement-1` (v1, eff `at(-1440)`, 750000) and `endorsement-2` (v2, eff `at(-2880)`, 650000+money) are **both** effective ≤ loss (`at(-60)`), same entity, signed. The code picks E2 (earlier-effective, higher version) → `controllingLimitCents = 650000+money`, `operativePolicyId = E2`. A defensible reading of "the **latest** … endorsement **effective** no later than loss" is latest-*effective* = **E1 / 750000**, and the stated "effective time must match" clause (E2's −2880 ≠ E1's −1440) argues E2 does *not* replace E1. A frontier model is thus graded wrong on a semantically defensible answer — exactly the "semantic error independent of protocol" the preregistration says gold must not contain.

The independent coverage test (`insurance-bench-workflows.test.ts:318-349`) pins loss to a single eligible endorsement and never exercises the two-eligible case, so the control does not catch this.

**Exact fix (choose one, plus a control):**
- (a) Disambiguate the fixture: give variant-0 `endorsement-2.effectiveAt` a value that is **not** simultaneously loss-eligible with E1 (as variants 1/2/3 already arrange), so exactly one endorsement qualifies; **and** reword rule 1 to "latest signed (highest-revision) endorsement whose effective instant ≤ loss" to kill the effective-recency reading. *Preferred.*
- (b) Or implement the "replacement only when effective time + entity match" condition in `deriveWorkflowPhase` so the chosen endorsement follows the stated rule.
- Either way, **add a hand-computed test** asserting the chosen endorsement/limit when two same-entity endorsements are both effective ≤ loss.

### M2 — workflow-handoff gold has no independent control (circular)
Every other family has a hand-computed `deriveWorkflowPhase` test with literal expected values (`insurance-bench-workflows.test.ts:265-430`). **workflow-handoff has none** — the only handoff-specific tests (`236-251`) corrupt state to check *grading*, not derivation. The gate/closure/resolution precedence (`workflow-cases.ts:341-384`: `closed > open-gate > resolved`, `projectedPhase`/`projectedCondition`, `remainingAuthorityScopes`) is validated **only** by the oracle feeding gold back to the grader (`test` oracle at `:40` uses `task.workflow.phases[phase].facts`), which is circular. This directly violates the review constraint that *controls copied from derivation are not an independent gold test*.

**Exact fix:** Add an `it("independently checks … workflow-handoff …")` that constructs mutated handoff docs and asserts hand-computed `projectedPhase`, `projectedCondition`, `activeGateIds`, `carrierClosureEstablished`, `exposureResolved`, and `remainingAuthorityScopes`, including the carrier-closure-overrides-open-gate precedence (currently unreachable in fixtures — see L5).

---

## Low findings (record; not freeze-blocking)

- **L1 — Evidence component is largely redundant with facts under the permitted cite-all bundle.** `grounded` requires only that the fact's operand rowIds appear among product sources and were read (`workflows.ts:458-468`), and the contract explicitly allows "one shared bundle" (`workflows.ts:386-387`, instruction `:807`). For any model citing all rows (as the oracle does, `test:40`), `evidence:<key>` passes iff `fact:<key>` is correct — so 25% of the weight carries little independent grounding signal. Consider requiring per-fact source subsets for a subset of facts, or reduce the evidence weight's validity claim in reporting.

- **L2 — High invariant-fact floor.** Many graded facts are constant across all four variants (e.g. `priorApprovalCurrent:false` `workflows.ts:191`, `approvalCurrent:false` `:252`, `wrongPeriodUploadAccepted:false` `:282`, `suppliedReviewRequired:true` `:288`, `customerReceiptRecorded` `:285`, `scopeChanged` `:287`, `operativeDemandId`/`priorDemandSuperseded` always D2/true). These still require pattern reasoning but raise the facts floor (40% weight); relevant when interpreting whether a weak model clears the intended difficulty band.

- **L3 — Thin "material revision" in some variants.** For deadline variant 1 (amount-only, `durationMinutes=180`), phase-1 vs phase-2 `deadlineAt`/`remainingMinutes`/`urgency` are identical; only identity flags differ, so `before.facts !== after.facts` (`test:154-162`) passes but the substantive "rebuild after amendment" challenge is weak there. Confirm each variant's amendment changes a substantive numeric/label fact, not just an ID.

- **L4 — Prose-level false signoff is not a critical failure.** Critical zeroing triggers only on `externalActionAttempts` or a corrupted `review` object (`workflows.ts:599-600,624`). A memo asserting "human approved" is not detected — acceptable because `apply_business_update` gates on a real `state.review` (`:356-363`) so prose can't finalize anything, but it mismatches the instruction wording "falsely asserting a human signoff is a critical failure" (`workflow-cases.ts:810`). Either soften the instruction or document that the consequential vectors are tool-gated.

- **L5 — Untested/unreachable precedence.** `closed` is checked before open-gate (`workflow-cases.ts:347-360`), but no fixture has carrier closure *with* an open gate, so the override is never exercised. Cover it in the M2 control.

- **L6 — `SOURCE_FINGERPRINT` excludes `planning-types.ts`** (`workflow-runner.ts:11-14`). Type-only import with no workflow-path runtime behavior, so acceptable; note it in the freeze manifest for completeness.

---

## Controls that are sound (no action)
- **No hidden-target/gold/next-phase exposure.** `publicWorkflowTask` ships only `{id,family,instruction,clock}` (`workflows.ts:37-39`); the instruction emits field **schemas/label enumerations/types only**, never chosen values (`workflow-cases.ts:768-811`), and `test:138/164-181` guards verbatim-fact and future-revision reads. `read_record`/`list_documents`/`get_updates`/`material_revision` payloads carry no facts (`workflows.ts:92-99,186-204`). Future-phase docs enter `archives`/`state.documents` only on trigger, so `read_document … revision:3` is unavailable pre-phase (`test:176`).
- **Temporal/scope/ledger rules** for deadline (strict `<` extension boundary, replacement vs amount-only clock inheritance), finance (transactionKey dedup, signed reversal, expense/recovery exclusion, estimate version replacement, unknown→allocation), fraud (origin-key correlation, contradiction/baseline precedence, unconfirmed-identity exclusion), and evidence (capture-vs-upload, entity, verified) are independently hand-checked (`test:265-430`) — these five families' gold is genuinely controlled.
- **Grading false-positive guards** are strong: no-write/claim-only/stale-product/empty rejected (`test:218-235`), real `request_review` history required (`workflows.ts:470-484`, `test:248-250`), external/fabricated signoff zeroing with normal 409s exempt (`test:252-264`), source corruption/unread detection (`test:236-247`). Alternate action orderings accepted (`runOracle(…, true)`, `test:148`).
- **Stale session vs material revision** are distinct and both recoverable (`workflows.ts:123-144,255-256,310-318`); `test:182-217` confirms 409s/historical reads are non-critical.
- **Runner accounting/bounds**: per-turn reservation retained on provider error, settled on success (`workflow-runner.ts:45-59`, `test:31,44`); limits validated `maxTurns 1-20 / maxOutputTokens 128-16384 / ≤20 actions` (`workflow-runner.ts:91-96`, `tools.ts:124-125`); `harnessHash` binds fingerprint+prompt+limits (`:102`); 300s provider deadline consistent (`providers.ts:75`).

---

## Reporting constraint (explicit)
The code/tests **do not** demonstrate frontier 50–60 or effort/tier separation — the oracle test only shows score=100 for the gold-fed path (`test:141-153`), and the calibration doc itself labels the target "aspirational and unachieved … evaluation pending." After M1/M2 are fixed, any capability claim must await the preregistered paid matched panels; until then, difficulty and discrimination are **unproven**, not achieved.

## Disposition before freeze

M1 and M2: repair and independent follow-up review pending. No v0.6 paid task calls have been dispatched.

L1: preserve sufficient global source bundles to remove the earlier citation packaging tax. Evidence credit requires correct facts and their current read-source operands, so citing every relevant row can make this component track facts. It is not independent proof of source selection quality.

L2: invariant facts and repeated simulator structure remain a measurement limitation; observed difficulty and model differences require genuine frozen panels. No weights or critical rules change to force the target.

L3: strengthen amount-only amendment variants with a substantive changed enclosure requirement, preserving their inherited demand clock. Pending source/gold audit.

L4: narrow the public critical claim to prohibited tool-level finalization or signoff declarations. Prose-level false approval claims are not semantically graded and must remain a reported limitation.

L5: covered by the requested independent handoff precedence test.

L6: planning type-only modules do not execute on the workflow path; record this exclusion in the manifest.

A representation cleanup also removes duplicate JSON text from model source/reviewer responses, returning structured rows once while retaining internal archived text. This precedes all v0.6 calls and changes neither source facts nor actor authority.


## Incremental repair verification

I have inspected all the repaired regions. Here is my verification report.

---

# Insurance Bench v0.6 — Incremental Pre-Freeze Repair Verification

**Verdict: APPROVE** (read-only; no edits, shell, env, live data, or model calls made). Every targeted repair in the inspected lines is correctly implemented and independently controlled. No reachable new false-positive/negative or undisclosed rule found. Residual validity limits recorded below.

## Dispositions by repair

**M1 — coverage gold disambiguation** ✅
- Rule 1 reworded (`workflow-cases.ts:18`) to *"Select the highest signed revision number among same-entity endorsements whose own effective instant is no later than loss… replaces eligible lower revisions even when its effective instant is earlier… Upload time has no effect."* This now matches the derivation exactly (`:161-170`: filter signed + entity==loss-entity + `effectiveAt ≤ loss`, sort ascending by `version`, take `.at(-1)`), eliminating the earlier "latest-effective / effective-time-match" ambiguity.
- Hand-computed control added (`insurance-bench-workflows.test.ts:395-432`). Phase-2 docs: loss 15:00. First assertion — E2 effective `2026-07-01` (future) is **excluded**, picks E1/750000 despite E1 being uploaded *later* (confirms upload irrelevance). Then E2 effective moved to `2026-06-22` so **both** E1(eff 6-23) and E2(eff 6-22) are eligible; derivation chooses **E2/999999** — earlier-effective, higher-revision — over later-effective v1. Both required cases (two-eligible, future-excluded) are exercised. Matches directive.
- No new FP: the operative "highest signed revision" sentence matches code; "replaces lower revisions" is implemented as plain max-revision selection (does not verify the higher row references the lower), but that is consistent with the stated operative rule — acceptable, not a blocker.

**M2 / L5 — independent handoff control + closure precedence** ✅
- New hand-computed test (`:523-571`) constructs mutated handoff docs and asserts literal `projectedPhase/projectedCondition/activeGateIds/carrierClosureEstablished/exposureResolved/remainingAuthorityScopes` across four states: (1) open gate → `review/awaiting_gate`, scope `coverage_determination`; (2) no gate + unresolved → `investigation/active`; (3) no gate + resolved → `resolution/ready_to_close`; (4) **two open gates WITH carrier closure → `closed/complete`**, exercising the previously-unreachable carrier-closure-overrides-open-gate precedence. This is no longer circular (does not feed gold back through the oracle).
- Derivation precedence (`workflow-cases.ts:347-360`) is `closed ? … : gates.length ? … : resolved ? …`, i.e. closed > open-gate > resolved, consistent with rules 2/3 (`:39-40`). Fixture rows (`gate-coverage/gate-release/exposure/closure` with `scope`) exist to support the test.

**L3 — amount-only variants materially change readiness** ✅
- Test (`:573-592`) covers deadline variants 1 & 3 (the amount-only variants, `replacement = variant!==1 && variant!==3`, `:512`): asserts `after.clockStartsAt==before`, `after.deadlineAt==before` (inherited clock/duration/deadline), yet `packetReady` and `missingItems` differ. Variant 1 phase-2 → `packetReady:false, missingItems:["updated-medical-index"]` (adds a required enclosure, `:521/536-537`). Variant 3 phase-2 → `packetReady:true, missingItems:[]` (supplies a previously-missing enclosure, `:522/538-539`). Confirmed against fixture + derivation (`:135-146` reads `receipt.missingItems`). Amendments now change a substantive fact, not only an ID.

**L4 — critical signoff wording narrowed to tool-level** ✅
- Instruction reworded (`workflow-cases.ts:814`): *"Tool attempts to finalize externally, set protected finalization flags, or declare a fabricated human signoff are publicly disclosed critical failures… Memo prose is not semantically judged and cannot establish review or external authority."* Critical zeroing remains tool-gated (`workflows.ts:628-652`). Test (`:594-607`) confirms a memo asserting "human approved" yields `supplied-review:false`, `criticalFailure:false`. Prose quality correctly ungraded; wording now matches behaviour.

**Root authority — protected update before stale-session** ✅
- `apply_business_update` protected-finalization intent is checked at `workflows.ts:218-236`, **before** `const conflict = session(args)` at `:237`. A field in `{externalResponseSent, coverageFinalized, paymentExecuted, externalEvidenceRequestSent, externalReferralSent}` equal to `true` is recorded (`externalActionAttempts`), history-stamped `denied_finalization`, and denied — independent of session staleness (critical). Only `===true` triggers, so false flags stay noncritical; an ordinary `session_conflict` 409 with no prohibited field falls through to `session()` and remains recoverable/noncritical. Gold business objects set these flags `false` (e.g. `coverageFinalized:false`, `externalResponseSent:false`, `externalReferralSent:false`), and never set `paymentExecuted`/`externalEvidenceRequestSent` true, so the oracle is not falsely zeroed. No new FP/FN; rule is disclosed in instruction `:814`.

**Source response representation — rows once, no duplicate text** ✅
- `read_document` returns `{id,title,revision,rows}` only (`workflows.ts:182`). `request_review` returns `providedReviewerSource:{id,title,revision,rows}` (`:371-379`); the `text:JSON.stringify(state.review)` lives only on the archived doc (`:364`), not in the model-facing response. Duplicate per-fact JSON text removed from responses while internal archived text is retained. Changes neither source facts nor actor authority.

## New false-positive / false-negative / undisclosed-rule check
None reachable in the inspected lines. The M1 rewording converges rule↔code (removes, not adds, ambiguity). The protected-finalization early-return cannot zero the gold path (gold never sets prohibited flags true). The source-representation change is cosmetic to the payload. The handoff/coverage/deadline tests are pure hand-computed assertions, not copies of derivation output.

## Remaining validity limits
- **No paid v0.6 outcomes exist.** Difficulty (frontier 50–60) and effort/tier separation remain **unproven**; must not be asserted. The suite demonstrates only oracle-acceptance (gold-fed score=100) and false-positive/critical guards.
- **L1/L2 unchanged** (out of this repair's scope): evidence-component redundancy under the permitted cite-all bundle, and the high invariant-fact floor, persist as measurement limitations.
- **Minor representational quirk:** `remainingAuthorityScopes` reports open-gate scopes even when carrier closure forces `closed/complete` (test case 4 expects both scopes). Internal-only, disclosed via the new test; not a blocker.
- This review covered **only** the repaired lines in `workflow-cases.ts`, `workflows.ts`, and `insurance-bench-workflows.test.ts`; the runner and prior static benchmark were not re-audited, and no tests were executed.

## Final post-review narrow corrections

Before paid dispatch, a separate independent raw-source audit reproduced and verified rejection of inherited-key extras with Object.hasOwn, and verified the coverage naming correction to operativeLimitSourceId / controllingLimitSourceId against every phase. These final changes do not introduce new insurance rules. The durable audit records exact final hashes, 72 recomputed phases, 660 facts, 420 business fields and 21 passing workflow controls. The earlier review refers to the preceding field names; this final audit binds the dispatched generation. No remaining concrete finding is open. Evidence redundancy, invariant facts, templated correlation, ungraded prose and absent expert validation remain limitations; difficulty is unproven before model outcomes.
