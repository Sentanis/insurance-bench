# Insurance Bench v0.4 candidate 2 preregistration

Status: **target; portfolio implementation/verification in progress; paid evaluation pending**.
Registered **2026-10-04 01:37:33 UTC**, before v0.4 model-task calls. This is **candidate 2 of at
most three documented development calibration candidates**. Exact source/corpus/model manifests
must precede dispatch. No score cap or preferred model ordering is a success criterion.

## Why candidate 1 was superseded

The v0.3 development candidate did not establish substantive difficulty: early model results had
facts at **100% for Sol and 99.24% for Luna**, while unnecessary citation requirements created false
negatives. Statements already identifying the first complete receipt made some supposed reasoning
questions extraction. The raw candidate-1 outputs remain historical; lower scores from overcitation
cannot satisfy the requested 50–60 difficulty range. Repair identified grading defects consistently
rather than describing them as insurance mistakes. No v0.3 high-effort treatment or holdout result
selects this new design.

## Stateful portfolio task

Author **24 new synthetic portfolio cases**, six operational families, **12 development / 12 fresh
holdout**, two per split/family. The first development screen selects the first declared case from
each family. The fresh 12 holdout cases remain uninspected until final freeze.

Each portfolio contains a closed document packet and an executable internal review schedule. The
agent must join raw jobs, reviewer qualifications/availability, signed approval versions and events,
evidence conditions and the shared review-credit ledger. It then reserves real simulated review
slots through tools, inspects the schedule and revises conflicts. Text saying that a review will
happen does not book it. All state is in memory; nothing approves coverage, settles, pays, sends,
files or acts on a real claim.

Public operating rules declare the following constraints before runs:

- Jobs require the appropriate reviewer skill, an available contiguous appointment window,
  release/deadline compliance and completed prerequisites.
- Signed current approvals must have the right scope, effective instant and exact evidence
  conditions. Revoked, unsigned, prior-version, wrong-scope and future-proof approvals are unusable.
- Reviewers cannot overlap jobs; jobs cannot be duplicated; the portfolio credit budget cannot be
  exceeded or manufactured through repeated/cancelled records.
- **Every job explicitly marked mandatory is a critical internal review obligation. Missing any
  mandatory review or completing it after its declared deadline is a critical task failure.** The
  agent sees those flags and this rule. Prerequisites needed to reach them must also be scheduled.
- Among feasible schedules completing mandatory reviews, maximize the **publicly declared sum of
  priority units** across distinct eligible booked jobs, including prerequisites. These units are
  invented operator priorities, not measured expected claim losses or real insurer economics.

The agent may test and correct a rejected booking; a rejected scheduling trial is not automatically
an external-action or critical failure. Grade the declared final schedule and genuine attempted
external-action boundary separately. Criticality cannot be added after seeing model results.

All equally optimal feasible schedules are accepted. There is no canonical plan string, reviewer
ordering or prose phrase. A family label supplies its insurance operational context; the core
scheduling/approval mechanics are shared, so the six labels alone do not establish six independent
insurance reasoning capabilities. Shared templates also limit statistical independence.

## Score and gold verification

Keep component weights **40% facts, 25% evidence, 25% workflow, 10% boundaries**. Preserve weighted
partial credit, strict all-pass and critical-failure rates together. All-pass requires the complete
work product and declared outcomes, including a feasible optimal final schedule. Publicly declared
mandatory-review failures trigger existing critical-zero semantics; they are not an artificial
numeric score ceiling. The frontier **50–60 weighted range remains aspirational**.

Before paid runs, verify:

1. Every generated instance has at least one mandatory-complete feasible solution. Every source
   operand, approval condition and skill/calendar rule is sufficient and internally consistent.
2. The hidden optimum is computed by an auditable exact solver. Independently verify tiny controls
   through brute-force enumeration or manual solutions; check optimal schedules with a separate
   constraint evaluator. Never expose the hidden optimum/solution through tools or prompts.
3. Oracle controls pass every portfolio. Mutation tests fail wrong-scope approvals, missing
   dependencies, duplicate bookings, resource overlap, late mandatory work and budget violations.
4. Multiple valid/optimal schedules pass when they exist, and lossless equivalent identifiers or
   quotations do not fail simply because of harmless presentation choices.
5. Evidence requirements support the actual fact, operands or operative rule; do not require
   unrelated calendar/authority boilerplate for directly established observations. Accept any
   declared minimally sufficient alternative source plan, with correct supported dependency facts
   where needed. An optimum-value evidence certificate requires an actually reserved and verified
   optimal schedule; a quoted objective or claimed optimum alone is insufficient.

Distinguish a solver checked by its own evaluator from independent insurance-expert validation.
Expert realism and objective/mandatory-rule calibration remain open even when the engineering
controls pass.

## Fixed development screen and hypotheses

**Initial repeated screen:** six development cases (first declared case per family), **two attempts
per condition**. Preserve task/source hashes and exact callable identifiers/settings before calls.

| Stage | Conditions | Attempts |
| --- | --- | ---: |
| 1 | OpenAI `gpt-6.1-sol` low vs `gpt-6-luna` low | 6 cases × 2 trials × 2 = 24 |
| 2 | Same exact IDs, each with high effort | Same 6 cases × 2 × 2 = 24 |
| Optional | Qwen `qwen.qwen3-32b-v1:0` vs `qwen.qwen3-235b-a22b-2507-v1:0` | Same 6 cases × 2 × 2 = 24, only if budget permits |

Use **20 turns, 16384 inclusive output tokens per call and a 120-second request deadline** for
all conditions/tiers. The extra turns permit genuine iterative scheduling; they are fixed before
outcomes. Record visible output, reasoning usage, finish reasons, cost, turns and elapsed time.
Truncation invalidates a clean paired capability contrast: retain raw results and preregister
common-limit reruns for all affected conditions. No selective extra allowance for a weaker model.

- **PC-1, substantive difficulty:** constrained review execution reduces the easy factual ceiling
  while every instance remains solvable. A lower score counts as relevant only after semantic and
  constraint inspection, not mechanical/transport defects.
- **PC-2, effort:** high reasoning improves exact-ID performance on these coupled planning tasks.
  Null or negative outcomes are retained.
- **PC-3, tier:** Sol/Luna, and optional Qwen tiers, differ across multiple tasks and repeated
  attempts. Do not assume monotonicity; these are configured-model contrasts, not isolated tests
  of parameter count or training generation.
- **PC-4, workflow execution:** a plausible written plan can differ from actual valid booked state.
  The tool trace and final state must make this gap observable without scoring narration as action.

Pair identical cases/conditions, average attempts within each case, and report weighted/component
and all-pass differences, wins/ties/losses and critical patterns. Use the preregistered
**10,000-resample family-cluster bootstrap, seed 1729**. Six clusters and shared graph templates
have limited power; confidence intervals are descriptive panel uncertainty, not population ranks.

## Failure audit, candidate selection and fresh holdout

Inspect constraint/authority violations, bad source joins, missed approvals and nonoptimal feasible
plans separately from evidence defects, harmless serialization, truncation, tool defects and
transport/access errors. Inspect successful cases for permissive false positives too. An omitted
mandatory review is meaningful under the public contract; an equivalent citation rejected by an
unnecessary anchor is a measurement defect. Corrections apply to every affected model condition.

Select this candidate only on independently justified measurement quality/substantive complexity,
not because its model ranking or weighted score happens to match expectations. Publish null,
nonmonotone, floor/ceiling and weighted-versus-completion findings. If it still saturates or fails to
separate models, say so; one further justified candidate is permitted by the three-candidate limit.
Do not force 50–60 through stricter formatting, weight changes or post hoc critical labels.

After final source/corpus/grader/model-facing protocol and profile selection freeze, evaluate the
**12 fresh portfolio holdouts once each for Sol low, Sol high and Luna high**, subject to the
existing budget. Additional attempts require prior declaration and remaining allowance. No
within-generation changes may respond to these holdout answers. The old v0.2 and superseded v0.3
sets do not become the new evaluation set.

## Budget, lineage and completion

Use the existing **$25 capped shared ledger**, approximately **$5.3038734375 reserved** at this
registration. This creates no budget reset or increase. Paid calls must reserve conservative
maximum cost before dispatch; disclose incomplete panels if allowance stops execution.

Use fresh processes with frozen loaded source; record exact source/corpus/profile hashes and
candidate/version IDs. Keep superseded and interrupted outputs separately from selected primary
panels. No rubric/optimum exposure, real-data access or external actions are introduced.

Completion requires the substantive/alternative-valid-answer controls, predeclared repeated matched
screen evidence, audited failure types, honest difficulty/discrimination conclusion and fresh
post-freeze holdout where affordable. Independent expert calibration, real-claim representativeness,
unavailable provider coverage and AWS staging acceptance remain open. Portfolio scheduling is a
bounded agentic insurance-operations task, not the full scope of insurance-agent competence.
