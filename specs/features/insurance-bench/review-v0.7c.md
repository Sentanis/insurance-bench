# Insurance Bench generation-c independent review

Anthropic Claude Code authenticated Max subscription, exactmodelclaude-opus-4-8, read-only bounded pre-paid review. Raw report preserved below.

I have completed a thorough evidence-first trace of the bounded change. Here is my review.

## Scope reviewed
- `insurance-bench/coupled-engine.ts:21-52` — new generation-c packet-evidence reuse in `normalizedState` (merge block `:28-41`).
- `insurance-bench/coupled-runner.ts:11` (`COUPLED_VERSION` → `v0.7c`), `:12-16` (fingerprint), `:23` (new packet-sharing sentence in the system prompt).
- `test/insurance-bench-coupled-engine.test.ts:66-82` — packet-reuse controls.
- Supporting, as grounding: `workflows.ts` `sourcesValid` (`:102-122`), `build_packet`/`save`/`revise` (`:274-329`), `currentSource`/grounding (`:445-490`); `workflow-types.ts`.

## What the change does
`normalizedState` (`coupled-engine.ts:76`, invoked **only** from `gradeCoupledTask`, confirmed by grep) now clones the state and, when a recorded packet legitimately backs the current draft, unions `state.packet.sources` into `state.productSources` so the common grader's `productSources`-only evidence grounding (`workflows.ts:489`) credits a draft that cited a nonempty subset rather than re-duplicating the full bundle. This matches the new prompt contract at `coupled-runner.ts:23`.

## Guard verification (evidence)
The merge fires only if `actualPacket` (`coupled-engine.ts:29-33`) holds:
1. `packet.materialRevision === state.materialRevision` → **not stale packet**.
2. `state.draft?.materialRevision === state.materialRevision` → **not stale draft**; null draft ⇒ false.
3. `packetKeys` truthy ⇒ every packet source is a well-formed `{documentId:string, safe-int revision, rowId:string}` (`:24-28`) → **no malformed refs**.
4. A `build_packet` history entry at the **current** materialRevision whose sorted source-key multiset equals the packet's → **no absent/mismatched/fabricated build history**.

Crucially, the merge only ever draws from `state.packet.sources` and `state.productSources` (both model-recorded references); it never reads `task`/gold for sources — satisfying "clone + recorded refs only, never gold-supply." The gold-instant snapping (`:42-50`) is the pre-existing, already-approved normalization and touches only deadline/follow-up fields, not sources.

I specifically tried to construct a **false pass** and could not:
- Stale/unread/wrong-revision/fabricated refs added by the merge are still re-validated per source by the common grader's `currentSource` (`workflows.ts:445-475`), which requires current-doc row-identity **and** `readSources` membership. Any bad source makes `validSources` (`:476`) false, failing evidence *and* `boundary:closed-source-schema` (`:638`) — the merge can only **lose** points, never launder a bad draft source.
- Facts are graded from `product.facts` independently; `evidence` requires `correct && grounded` (`:486-490`), so a wrong fact cannot be rescued.
- A packet tampered to add a fake ref changes `packetKeys` and fails the history-key match (step 4) → merge skipped.
- Business-write guards are untouched: `gradeCoupledTask` still computes `validActualPlan`/`matchingWrite` from the **raw** state (`:55-66`) and ANDs it into `workflow:current-state` (`:78`); feasible/optimal/valid plan binding (`:64-75`) is intact.

Narrowing/compile sanity: `packet.sources` at `:39` is safe under `strict` because `const actualPacket = packet && …` aliased-condition narrowing applies in the `if`; the `new Map(arr.map(x=>[k,v]))` shape at `:37` is the same pattern already compiling at `workflows.ts:63`.

## Test adequacy
`test:66-82` locks the positive reuse (sliced `productSources`, `evidence===100`, `allPass`, and `deepEqual(state,before)` proving clone-only/no mutation) and the four rejection vectors `stale-packet`, `stale-draft`, `missing-history`, `forged-packet` (mismatched build history), plus `unread` (`readSources=[]` ⇒ `evidence===0`). Both directions of the history guard are covered.

## Findings (no reachable defect)
- **Low-severity missing test.** The committed suite does not regression-lock the "packet source at a non-current revision *with* a history entry forged to match" vector (present in the dev script `results/meta/v07c-packet-controls-script.txt:33` as `packet-row-wrong-revision`). It is correctly handled — the merged source fails `currentSource`'s revision/row-identity check so `evidence<100` — but that rejection path (merge-admits-then-grader-rejects on revision) is only indirectly exercised via `unread`. A future refactor of `currentSource` could silently regress it. Trigger: packet carries a stale-revision row whose forged `build_packet` payload matches. Consequence today: correctly fails; risk is only loss of a regression guard. Suggested test: add that fault to the `:72` loop asserting `evidence<100`.

## Uncertainty
- I did not re-verify numerical cases/gold/weights or the corpus (out of scope, and stated untouched). I did not read model-output result artifacts (per instructions); grep hits above are incidental context only.
- My compile-safety claim relies on TS aliased-condition narrowing and the existing identical `new Map` pattern rather than an executed `tsc` (I did not run commands); `insurance-bench/**` is reached by `tsc` transitively through the in-scope test file.

## Verdict: **APPROVE**

The generation-c packet-evidence reuse is correctly and conservatively guarded: it unions only verified-current, actually-recorded packet references tied to a current draft via matching build history, never gold; stale/unread/invalid/fabricated refs are rejected by the retained common grader, and the feasible-optimal business-write guards remain intact. Only a low-severity regression-test gap is noted, which does not affect correctness of the current behavior.

## Disposition before freeze

APPROVE retained. The low-severity missing regression control was added before freeze: a packet and matching build history containing a wrong source revision receive no evidence credit. The positive root control now creates the short-source current draft via the actual revise_proposal tool, not direct state mutation. Independent audit separately passed all22actual optimal histories and12positive/negativepacketcontrols. The complete19coupled/report/compare Node controls, ESLint and full typecheck pass. Corpus/gold/baseengine/weights unchanged; no generation-c paid call or holdout output informed the repair. Source/audit hashes are bound in the generation-c manifest.
