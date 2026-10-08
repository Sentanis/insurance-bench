# v0.3 independent engineering review

Read-only Claude Code review (`claude-opus-4-8`, subscription session), no live data, databases, shell, network or mutations. This is an engineering review, not insurance-expert calibration.

## Disposition

- Inclusive output-budget concern: increased every challenge condition to 16384 tokens before outcomes; documented that hidden reasoning shares the ceiling. Any truncation prevents a clean paired comparison. No separate visible-output guarantee is claimed.
- Missing challenge module: completed the corpus and verified CLI help loads.
- Truncation separation: recorded finish reasons, labeled report rows, rejected truncated contrasts; tests cover lower-case OpenAI and upper-case Gemini limits.
- Generation badge: inferred from selected run versions when context is absent; regression test added.
- Axis confounding: explicit effort/tier validation and descriptive configured-system caveat.
- Published fact-key names: already public assignment fields; report exposes failed criteria rather than hidden expected values, and no rubric is sent to models.

Follow-up verdict: **Approve** for the configured provider surface. Its latent upper-case truncation concern was also fixed and tested before scored runs.

## Original report

I have enough to render the review. I inspected all in-scope files plus `score.ts` and the four test suites, and confirmed `challenge-cases.ts` is referenced but absent.

---

# Hostile review — Insurance Bench v0.3

Scope: `runner.ts`, `providers.ts`, `models.json`, `compare.ts`, `cli.ts`, `report.ts` and the four `insurance-bench-*` test files. Read-only; no commands, network, DB, `.env`, or credentials were accessed. Corpus (`challenge-cases.ts`) out of scope per instructions.

## Findings (reachable regressions / goal failures)

### F1 — Shared 8192-token cap includes hidden reasoning, breaking the fair same-model low/high comparison. **Severity: High**
- `providers.ts:307-312` sends a single `max_output_tokens: maxOutputTokens` to the OpenAI Responses API; for that API this cap bounds **total** generation *including* reasoning. `cli.ts:186` fixes this at 8192 for challenge runs, and `models.json:81-98` pairs `gpt-6.1-sol-low`/`-high` with identical caps so they can be compared.
- The comment at `providers.ts:298-299` ("Reserve most of the output allowance for the observable action") is **false** — there is no mechanism that partitions the cap between reasoning and the answer.
- Failure scenario: `gpt-6.1-sol-high` spends most of 8192 tokens on hidden reasoning; the visible memo is truncated below the 80-char / anchor threshold (`score.ts:78-86`) and citations drop, so facts/evidence/workflow fall. `compareRuns` then reports a **negative** `scoreDelta` for high vs low and the report (`report.ts:65-76`) presents it as capability discrimination, when the real cause is answer-budget starvation. This directly defeats the stated goal of "fair same-model low/high discrimination."
- `compare.ts:92-94` caveat does not name reasoning-truncation as a confound.
- Insufficient test: `test/insurance-bench-runner.test.ts:70-81` uses `outputTokens:800` with no truncation; no test exercises reasoning consuming the cap or a truncated memo; `compare` tests use synthetic scores only.

### F2 — `cli.ts` statically imports a non-existent module; every CLI command fails to load. **Severity: High (blocker, pending corpus)**
- `cli.ts:4` `import { generateChallengeCases } from "./challenge-cases.ts";` and `cli.ts:138` call it. Glob/grep confirm the file does not exist anywhere in the worktree and nothing else references it.
- Because it is a top-level static import, **all** commands crash at module load — including `report`, `discover`, and `probe`, none of which touch challenge cases. The "static report preview" paths in the recent commits are unreachable through this CLI until the module lands.
- Insufficient test: no CLI test exists in scope, so the suite stays green while the entry point is unloadable. I note the instructions anticipate this file may be added later; flagged as a blocker only if merged before the corpus.

### F3 — Output truncation is conflated with low capability (not separated). **Severity: Medium**
- Reviewer-requested separation: unsupported access *is* handled correctly — `runEpisode` sets `provider-error`/`budget-stopped` (`runner.ts:186-196`), the panel halts (`runner.ts:306`), coverage drops below 1, and the report shows "Unavailable" (`report.ts:26`). Good.
- Truncation is **not**: `finishReason` (e.g. OpenAI `max_output_tokens`, `providers.ts:339`) is only stored per-trace-turn (`runner.ts:228`) and logged (`cli.ts:176`). `runner.ts:237-244` never promotes a truncated episode to a distinct status; it is scored as `incomplete`/`completed` with a low score. A high-effort run that truncates is indistinguishable from a genuinely weak model in both the headline score and `compareRuns`.
- Insufficient test: no test asserts any behavior keyed on `finishReason`/truncation.

### F4 — Report badge generation defaults to `v0.2` while rendering v0.3 runs. **Severity: Low-Medium**
- `report.ts:78` `const generation = context.generation ?? "v0.2";`. `cli.ts:54-56` loads `meta/report-context.json` only if it exists, else `{}`. A `report` run over challenge-v0.3 runs with no context file labels the page badge "v0.2" (`report.ts:82`). Per-row `run.version` is still correct, so this is a header-level mislabel, not a data error.
- Insufficient test: `test/insurance-bench-report.test.ts:24` passes `generation:'v0.3'` explicitly and never exercises the default.

### F5 — Paired comparison does not constrain the compared axis. **Severity: Low (likely intended)**
- `compare.ts:23-31` matches `version`, `datasetHash`, `harnessHash`, `variant`, `repeat`, `taskIds`, but `harnessHash` (`runner.ts:277`) excludes model/provider/`reasoningEffort`. This is what *enables* the low/high and lower-tier comparisons (a stated goal), but it also silently permits pairing two runs differing in both model and effort and printing a confident bootstrap interval with no note of the confound. Acceptable for cross-tier discrimination; flagged only because the caveat (`compare.ts:92-94`) doesn't state which axis moved.

### F6 — Published report leaks rubric fact keys. **Severity: Low (appears pre-existing, not a v0.3 regression)**
- `report.ts:50-58` renders failed criteria IDs (`fact:<key>`, `evidence:<key>` from `score.ts:38-50`), exposing planted fact-key names in the static artifact. Not model-facing during runs, so no in-run leakage (confirmed by `test/insurance-bench-runner.test.ts:29-37,56-68`), but the published HTML reveals rubric structure. I could not attribute this to the v0.3 diff, so I do not count it as an introduced regression.

## Things that are correct (checked, no regression)
- No in-run rubric leakage: `publicTask` strips rubric; tool results never carry grading answers (`runner.ts:208-235`, tests at runner:29-37/56-68).
- Reasoning accounting: OpenAI/Gemini output cost includes reasoning/thought tokens (`providers.ts:335-345,405-409`); `reasoningTokens` recorded separately; effort mismatch and unsupported efforts fail before/without substitution (`providers.ts:44-73,323-332`; providers test 55-69).
- Ledger cap cannot be inflated: `effectiveCap = min(this.cap, saved.capUsd)` ratchets down only (`runner.ts:101`), verified by runner test:24. (Operational footgun: a small `probe --budget` permanently lowers the shared `session-budget.json` cap for later larger runs — by-design, not a bug.)
- Access-gap separation and "Unavailable" headline suppression (report test 6-14).
- Reservation is a conservative byte-based upper bound, settled against actual tokens; failed-call reservations truthfully retained (`runner.ts:178-203`).

## Verification limits
- Did not run tests, the CLI, or any provider; no network/DB/credential access, per constraints.
- Could not `git diff` against v0.2 (no commands run), so line-level attribution of "newly introduced" is inferred from the v0.3 feature surface, not proven; F6 is explicitly left unattributed.
- `challenge-cases.ts` / corpus not reviewed (out of scope); F1's truncation harm depends on real memo/citation lengths in that corpus, which I could not inspect.
- Statistical properties of the bootstrap (`compare.ts:62-74`) checked only for determinism and percentile indices, not empirical coverage.

## Merge verdict
**Request changes — do not merge as-is.** F2 makes the CLI unloadable until the corpus lands (hard blocker if merged first). F1 is the more serious design flaw: the headline v0.3 goal — fair same-model low/high discrimination — is undermined by a reasoning-inclusive shared output cap with no answer-budget guarantee, an inaccurate code comment asserting one exists, and a caveat that omits the confound. At minimum, F1 needs either a separate answer-token guarantee (or explicit truncation accounting per F3) and an honest caveat, and F2 needs the module present with a smoke test, before this is mergeable.


## Follow-up report

## Verification findings — v0.3 Insurance Bench core (read-only)

### Resolutions confirmed against source

- **Uniform 16384 output budget, applied before outcomes** — `runner.ts:186` sets `maxOutputTokens: 16384` for challenge (4096 for pilot); `runPanel` validates `128–16384` at `runner.ts:260-268`; the budget flows into every `runEpisode`/`complete` call before any grading. ✓
- **Inclusive-budget / hidden-reasoning comment** — `providers.ts:298-299` ("The API ceiling includes hidden reasoning; it cannot guarantee visible tokens"), echoed in `runner.ts:288` notes and `report.ts:84` ("including hidden reasoning where applicable"). The prior false "observable output" guarantee is gone. ✓
- **compareRuns fail-closed on truncation** — `compare.ts:42-53` throws on any trace turn whose `finishReason` ∈ {`max_output_tokens`,`max_tokens`,`length`}, for **all** axes, and before any delta/bootstrap is computed. Matched output budget is additionally enforced transitively: `maxOutputTokens` is folded into `harnessHash` (`runner.ts:277`) and `compare.ts:56` requires equal `harnessHash`, so a 4096-vs-16384 mismatch can't be compared either. ✓
- **Report truncation label + actual limits** — `report.ts:26` prints the real `run.limits.maxOutputTokens` and appends "· output truncation observed" when a truncation finishReason is present. ✓
- **Explicit effort/tier axis validation** — `compare.ts:26-39`: effort requires identical model/provider/region/profile; tier requires identical provider and `reasoningEffort`. ✓
- **challenge-cases.ts present & wired** (`cli.ts:4`, `runner.ts` import path), **generation inferred** (`report.ts:78-80`). ✓ CLI `help` branch (`cli.ts:23-28`) is self-contained and cannot throw.

### Can effort contrasts still quietly claim a clean gain after output truncation?

**No — not on the reachable surface.** Reasoning effort is only active for OpenAI (`providers.ts:48-54` throws for any other provider carrying `reasoningEffort`), and the OpenAI adapter maps budget exhaustion to `finishReason = body.incomplete_details.reason = "max_output_tokens"` (`providers.ts:339`). That value is in the fail-closed list, so a higher-effort treatment that burns the 16384 budget on hidden reasoning and truncates makes `compareRuns` throw **before** any `scoreDelta`/bootstrap is produced. A truncated effort run therefore cannot be scored as a clean gain. The configured providers (`models.json`: openai + bedrock only) emit `max_output_tokens` / `max_tokens` respectively — both covered.

### Remaining finding

- **Low / latent (not currently reachable) — `compare.ts:46` and `report.ts:26`.** Both the fail-closed guard and the report badge match `finishReason` **case-sensitively** against lowercase literals. The Gemini adapter (`providers.ts:411`) returns the API's uppercase enum `"MAX_TOKENS"`, which would slip past both the guard and the truncation label — letting a truncated Gemini run be published/compared as clean. This is **unreachable today** because no gemini/xai/anthropic model is in `models.json`; it becomes a real blocker the moment a Gemini entry is added. Recommend normalizing `finishReason` casing (or adding `"MAX_TOKENS"`) and adding a Gemini truncation test — `insurance-bench-compare.test.ts:26-31` only exercises OpenAI's `max_output_tokens`.

Everything else (inclusive-cap comment, actual-limit labeling, axis guards, challenge file, generation inference) checks out, and no demand is made for separate answer budgets — documented hidden-reasoning sharing is correctly excluded.

### Merge verdict

**Approve.** All five intended resolutions are present and correct, and effort contrasts are fully protected against truncation confounds on the reachable (OpenAI/Bedrock) surface. The sole residual is a latent case-sensitivity gap in the truncation literal list that only activates if Gemini/xAI are added to the config — worth a quick fix/test but not a merge blocker for the current committed configuration.
