# Evidence candidate v0.8

Status: implemented synthetic candidate awaiting independent source review and prospective
registration. No paid v0.8 inference has been run by its implementation agent. The separate
[experiment plan draft](v08-experiment-plan-draft.md) belongs to the parent integration task; its
proposed panels are planning, not a frozen dispatch receipt or an observed difficulty result.

This candidate uses seed 82573 and 12 entirely invented tasks: coverage review, evidence brief, and
internal fraud-referral evidence readiness, each with two development and two fresh holdout
conditions. The three families share most proposition mechanics and are strongly correlated. They do
not represent 12 independent insurance skills. Nothing in the corpus is taken from live claim
records. No professional coverage, fraud, legal, or clinical determination is graded.

## Prospective hypotheses

- H1: original narrative documents produce substantive source interpretation errors beyond the prior
  structured-record ceiling. A paired layout/provenance-normalized counterpart preserves every
  observational statement and source identity without exposing verdicts. This bounded ablation
  changes presentation; it is not an independently extracted normalized fact table or six extra
  benchmark tasks. A ceiling in both formats does not establish frontier headroom.
- H2: source attribution, copies, identity/period/role scope, conflicting histories, digest linkage,
  and narrowly scoped signed corrections cause genuine evidence errors. Several propositions require
  joining two or three source sections. Error analysis must distinguish wrong meaning from schema,
  discovery, source-ID, and provider-limit failures; this is not a causal treatment.
- H3: models complete a current scoped request, actual receipt review, revision-bound supplied
  packet review, and persisted internal handoff. The first provided packet review announces a signed
  material correction. Alternative correct action orders are accepted. Rejected ordinary stale
  writes and wrong-scope receipt reviews are recoverable, not critical failures.

The desired frontier range remains 50–60, with tier and effort separation. That target is never a
scoring rule. A low score alone cannot establish substantive difficulty or insurance validity.

## Public meaning and tool contract

Each task supplies nine closed-fiction propositions with supported/refuted/unresolved labels. The
public source policy defines whole-proposition scope, first-hand attribution, copy origins, specific
signed histories, missing evidence, alias/role/time conditions, digest identity, and the limited
scope of corrections. The author annotations are defensible only under those disclosed rules.
Unavailable resolving evidence yields uncertainty; the simulator cannot infer truth from an intake
checkbox, upload, attributed report, or a later professional opinion.

Sources are discovered through ordinary list/read tools, with complete section text and visible
versions/pages. A scoped request receives an unrelated attachment, then the available scoped
response on an approved follow-up. Receipt review records scope verification; packet review records
the supplied internal reviewer response. Neither certifies professional truth. A source or memo
cannot grant authority to finalize coverage, payment, fraud findings, or outbound actions. Declared
external-action or fabricated-signoff attempts are denied and critical, even with a stale session
token. Narrative memo quality is not semantically graded.

The actual final-state goal is `workflow:current-state`: the requested current scope, actual
reviewed response, saved current-generation packet, supplied current packet review, and an actual
matching persisted handoff/history. It is structural and does **not** repeat an all-labels
correctness gate. The state is persisted in native episode artifacts within an isolated simulator,
not the application database. Staging, production, and real application-write acceptance remain
outside this candidate.

## Scoring and baseline controls

Before any v0.8 paid model output, the parent registered **macro task success** as this generation's
headline score: 100 times the mean, across families, of completed attempts whose existing semantic,
evidence, workflow and boundary criteria all pass. Incomplete provider coverage makes the headline
unavailable. A partial packet or a structural handoff with incorrect findings is not a solved task.
This follows task-resolution scoring in [SWE-bench](https://www.swebench.com/SWE-bench/reference/cli/)
and end-state success in [tau-bench](https://arxiv.org/abs/2406.12045). It is a new prospective metric
contract, not a regrade of earlier generations or a change to any criterion to reach a target.

Weighted partial credit remains an explicitly separate diagnostic: facts 40, evidence 25, workflow
25, boundaries 10, with the same family macro-average. Facts check the closed-fiction labels. Evidence checks a correct
label plus any annotated sufficient source relationship; facts and evidence are therefore dependent.
Source sections may be reused; there is no quotation, page-placement, or literal prose tax.
Source-ID remapping, pagination, equivalent small paraphrases, and valid certificate alternatives
pass. The author certificate set still requires independent sufficiency review and may not cover
every defensible argument before that review.

Pre-inference controls use the same public tools. All 12 oracle episodes score 100 and complete
actual handoffs. Omitted resolving responses require Q1 uncertainty. Empty episodes score zero;
absent actual writes, obsolete reviews, corrupted source versions/content, fabricated reviews, and
unauthorized declarations are rejected. The oracle mirrors author annotations and does not replace
independent recomputation or professional validation.

Constant-label controls retain the correct lifecycle and author source certificates, measuring an
optimistic structural-oracle baseline rather than an independently acting naive agent. The first
pre-inference draft produced supported 58.47 (39/108), refuted 69.31 (57/108), and unresolved 42.22
(12/108); it was rejected before any paid v0.8 calls because the refuted shortcut dominated. That
historical control record is retained in `results/meta/v08-prepaid-constant-control.json`.

The revised source coverage introduces genuine unavailable receipt, billing, origin, body-area,
correction-version and digest-link inputs, while retaining explicit contrary and affirmative
conditions. Several questions vary assertion polarity. These are pre-inference construct-coverage
changes under public rules, not a model-outcome-driven adjustment. The resulting unchanged partial-credit controls are:

| Constant label | Correct propositions | Weighted mean | All-pass |
| -------------- | -------------------: | ------------: | -------: |
| supported      |             36 / 108 |         56.66 |   0 / 12 |
| refuted        |             36 / 108 |         56.66 |   0 / 12 |
| unresolved     |             36 / 108 |         56.66 |   0 / 12 |

Each development/holdout split has 18/54 correct propositions per constant, and each family/split
has 6/18. Every such subgroup scores 56.66 with facts 33.33, evidence 33.33, workflow 100 and
boundaries 100. This balance removes label prevalence advantage but not the 35-point structural
floor or fact/evidence dependence. A frontier **partial-credit** score of 50–60 still would not by itself establish
substantive difficulty: a constant-label oracle control is in that range. Each constant control has
zero headline task success; all 12 complete correct oracles have headline 100. A headline 50–60
still needs independently valid substantive failure categories and observed tier/effort separation;
it is not sufficient evidence by itself. Report component accuracy,
actual handoff, all-pass, constants, and error categories. Never add a duplicated semantic workflow
gate or retune after model outcomes to conceal this limitation.

## Conditions and preservation

The standalone script is `scripts/insurance-bench-evidence.ts`; its manifest fingerprints source,
tools, scorer, provider code, model configuration, CLI, controls, specification, and full hidden
dataset before dispatch. The default seed, exact task IDs, prompt/variant, representation, repeats,
model/effort, source fingerprint, limits, and costs are retained in native-compatible runs. The
existing shared ledger remains `.tmp/insurance-bench/session-budget.json`, with the same
user-authorized **$75 total cap across all generations**. The script accepts that cap only and never
resets accumulated spend or reservations. There is no authority for another cap increase.

Run limits are 20 turns, the existing 300-second provider deadline, and explicitly recorded
inclusive output tokens: OpenAI 16,384; Bedrock 8,192 where supported. Differing provider ceilings
are different comparison conditions. Passed limits are honored and unsupported CLI ceilings are
rejected before reservation. No calculator, optimizer, model judge, or real external system is
available; this does not establish that the action budget suffices for every admitted model.

Transport failures remain unscored access/coverage gaps with reservations retained. Output-limited
responses may recover; their cumulative truncation flag, raw terminal grade, native finish reasons,
usage, and reasoning-token metadata remain visible. They cannot establish a clean capability,
effort, or representation contrast. The separate paired representation diagnostic checks model,
prompt, source/tool/scoring harness, limits, repeats, identities, coverage, and truncation rather
than bypassing exact-dataset comparison checks.

## Open validation

Before any paid run, independently review every label and sufficient source relation against the
public rules, verify source/gold isolation and lifecycle negatives, and bind the final hashes.
Before claiming an insurance benchmark is valid, insurance operations experts must assess task
representativeness, source ambiguity, meaningful handoff outcomes, and the usefulness of the
uncertainty policy; relevant coverage counsel or clinical expertise is required wherever actual
professional judgments would be introduced. Expert labels are unavailable and are not invented.
Harvey-like professional validity, representative production-task coverage, source retrieval from
real document formats, reliable semantic memo review, and full admitted-model completion remain open
harness/product gaps. Publish flat, negative, ceiling, and failure findings alongside success.

The pre-paid independent Opus review approved engineering behavior. Evidence sufficiency accepts extra valid current references; no citation precision or prose-quality measure is claimed. Generated documents remain version1 and corrections arrive as new scoped documents, so invalid-version controls exercise validators rather than model-reachable document replacement. See the [review receipt](../../../insurance-bench/results/meta/evidence-independent-opus-review-v0.8.json).
