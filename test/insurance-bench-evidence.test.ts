import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generateEvidenceCases,
  evidenceDiagnostic,
  EVIDENCE_FAMILIES,
} from "../insurance-bench/evidence-cases.ts";
import {
  createEvidenceEnvironment,
  evidenceGoals,
  gradeEvidenceTask,
  publicEvidenceTask,
} from "../insurance-bench/evidence-engine.ts";
import {
  runEvidenceEpisode,
  runEvidencePanel,
  compareEvidenceRepresentations,
  evidenceSourceFingerprint,
  evidenceTaskSuccess,
} from "../insurance-bench/evidence-runner.ts";
import { Budget } from "../insurance-bench/runner.ts";
import { PROVIDER_TIMEOUT_MS, type ModelConfig } from "../insurance-bench/providers.ts";
import type {
  EvidenceFinding,
  EvidenceLabel,
  EvidenceTask,
} from "../insurance-bench/evidence-types.ts";
import { evidenceMain } from "../scripts/insurance-bench-evidence.ts";
const tasks = generateEvidenceCases();
const model: ModelConfig = {
  provider: "openai",
  model: "fixture",
  inputUsdPerMillion: 2,
  outputUsdPerMillion: 10,
  reasoningEffort: "high",
};
test("headline task success is family-balanced, complete and separate from partial credit", () => {
  const baseTask = tasks[0]!;
  const score = gradeEvidenceTask(baseTask, oracle(baseTask).state);
  const episode = (family: "coverage-review" | "evidence-brief", passed: boolean) => ({
    taskId: family,
    family,
    split: "dev" as const,
    status: "completed" as const,
    state: oracle(baseTask).state,
    trace: [],
    elapsedMs: 0,
    estimatedCostUsd: 0,
    score: { ...score, family, score: passed ? 100 : 95, allPass: passed },
  });
  const rows = [
    episode("coverage-review", true),
    ...Array.from({ length: 3 }, () => episode("evidence-brief", false)),
  ];
  assert.equal(evidenceTaskSuccess(rows, true), 50);
  assert.equal(evidenceTaskSuccess(rows, false), null);
  assert.equal(evidenceTaskSuccess([], true), null);
  assert.equal(evidenceTaskSuccess([{ ...rows[0]!, status: "incomplete" }], true), 0);
  assert.equal(
    evidenceTaskSuccess([{ ...rows[0]!, score: { ...score, criticalFailure: true } }], true),
    0,
  );
  assert.equal(evidenceTaskSuccess([{ ...rows[0]!, score: undefined }], true), null);
});
function findings(task: EvidenceTask, current = true, constant?: EvidenceLabel) {
  return Object.fromEntries(
    Object.entries(current ? task.evidence.gold : task.evidence.goldBeforeCorrection).map(
      ([id, answer]) => [
        id,
        { status: constant ?? answer.labels[0]!, sources: answer.certificates[0]! },
      ],
    ),
  ) as Record<string, EvidenceFinding>;
}
function oracle(task: EvidenceTask, constant?: EvidenceLabel, alternative = false) {
  const env = createEvidenceEnvironment(task),
    state = env.state;
  const run = (tool: string, args: Record<string, unknown> = {}) =>
    env.execute(tool, {
      expectedVersion: state.version,
      generation: state.generation,
      packetRevision: state.packet?.revision,
      ...args,
    });
  const read = () =>
    state.documents.forEach((doc) =>
      assert.equal(run("read_document", { documentId: doc.id }).error, undefined),
    );
  read();
  if (alternative)
    assert.equal(run("create_follow_up", { ...task.rubric.followUp }).error, undefined);
  assert.equal(
    run("draft_request", {
      propositionIds: task.evidence.requestTargets,
      entityId: task.evidence.entityId,
      periodStart: task.evidence.periodStart,
      periodEnd: task.evidence.periodEnd,
      item: task.evidence.sourceItem,
    }).error,
    undefined,
  );
  const requestId = state.request!.id;
  assert.equal(run("request_approval", { requestId }).error, undefined);
  assert.equal(run("dispatch_request", { requestId }).error, undefined);
  read();
  const mismatch = run("review_receipt", { requestId, documentId: task.evidence.wrongResponse.id });
  assert.equal(mismatch.error, "scope_mismatch");
  assert.equal(run("follow_up_request", { requestId }).error, undefined);
  read();
  assert.equal(
    run("review_receipt", { requestId, documentId: task.evidence.response.id }).error,
    undefined,
  );
  assert.equal(
    run("save_packet", {
      findings: findings(task, false, constant),
      memo: "Original-source internal assessment; preserve uncertain and contrary material for the reviewer.",
    }).error,
    undefined,
  );
  assert.equal(run("request_packet_review").changesRequested, true);
  read();
  assert.equal(
    run("save_packet", {
      findings: findings(task, true, constant),
      memo: "Current signed correction is reconciled within its scope; this is an internal source assessment, not a final determination.",
    }).error,
    undefined,
  );
  assert.equal(run("request_packet_review").error, undefined);
  assert.equal(run("record_handoff", { owner: "internal-evidence-team" }).error, undefined);
  if (!alternative)
    assert.equal(run("create_follow_up", { ...task.rubric.followUp }).error, undefined);
  run("finish");
  return env;
}
test("equivalent follow-up instants retain precision and reject date-only input", () => {
  const task = tasks[0]!;
  const state = oracle(task).state;
  const expected = task.rubric.followUp.dueAt;
  state.followUps[0]!.dueAt = expected.replace("Z", ".000000Z");
  assert.equal(gradeEvidenceTask(task, state).allPass, true);
  state.followUps[0]!.dueAt = expected.replace("Z", ".000001Z");
  assert.equal(gradeEvidenceTask(task, state).allPass, false);
  state.followUps[0]!.dueAt = expected.slice(0, 10);
  assert.equal(gradeEvidenceTask(task, state).allPass, false);
});
test("published participant histories match their scoped roster and copying attestations are signed", () => {
  for (const task of tasks) {
    const documents = task.evidence.initialDocuments;
    const roster = documents.find((doc) => doc.title === "Dispatch note")!;
    const rosterText = roster.sections.find((section) => section.id === "s2")!.text;
    const participant = rosterText.match(/Participant (P-\d+) is this claimant\./)?.[1];
    assert.ok(participant, task.id);
    const history = documents.find((doc) => doc.title === "Intake and specific history")!;
    const historyText = history.sections.find((section) => section.id === "s2")!.text;
    const publishedIds = [...historyText.matchAll(/participant (P-\d+)/gi)].map(
      (match) => match[1],
    );
    assert.ok(publishedIds.length > 0, task.id);
    assert.ok(
      publishedIds.every((id) => id === participant),
      task.id,
    );
    for (const doc of documents)
      assert.equal(doc.text.includes("${salt}"), false, `${task.id}/${doc.id}`);
    const vendorA = documents.find((doc) => doc.title === "Vendor report")!;
    const vendorB = documents.find((doc) => doc.title === "Vendor cover sheet")!;
    if (vendorB.text.includes("RADIO-8")) {
      assert.ok(vendorA.text.startsWith("Vendor A signed:"));
      assert.ok(vendorB.text.startsWith("Vendor B signed:"));
    }
  }
});
test("balanced deterministic12case corpus; no author verdict flags in original documents", () => {
  assert.equal(tasks.length, 12);
  assert.deepEqual(generateEvidenceCases(), tasks);
  assert.notDeepEqual(generateEvidenceCases(7), tasks);
  assert.throws(() => generateEvidenceCases(NaN));
  for (const family of EVIDENCE_FAMILIES)
    for (const split of ["dev", "holdout"])
      assert.equal(tasks.filter((t) => t.family === family && t.split === split).length, 2);
  for (const task of tasks) {
    assert.equal(task.propositions.length, 9);
    for (const doc of task.evidence.initialDocuments) {
      assert.ok(!doc.text.includes('"gold"'));
      assert.ok(!doc.text.includes('"labels"'));
    }
  }
});
test("all12 full-tool oracles100; alternative ordering and semantic variants also pass", () => {
  for (const task of tasks) {
    assert.equal(gradeEvidenceTask(task, oracle(task).state).score, 100);
    assert.equal(gradeEvidenceTask(task, oracle(task, undefined, true).state).allPass, true);
    for (const options of [
      { normalized: true },
      { paraphrase: true },
      { paginate: true },
      { remapIds: true },
      { normalized: true, paraphrase: true, paginate: true, remapIds: true },
    ]) {
      const variant = evidenceDiagnostic(task, options);
      assert.equal(gradeEvidenceTask(variant, oracle(variant).state).allPass, true);
    }
  }
});
test("literal author adjudication controls check each distinct semantic condition", () => {
  const expected: EvidenceLabel[][] = [
    [
      "supported",
      "supported",
      "unresolved",
      "refuted",
      "unresolved",
      "refuted",
      "refuted",
      "unresolved",
      "unresolved",
    ],
    [
      "refuted",
      "refuted",
      "unresolved",
      "supported",
      "supported",
      "unresolved",
      "supported",
      "supported",
      "refuted",
    ],
    [
      "supported",
      "unresolved",
      "supported",
      "supported",
      "refuted",
      "supported",
      "unresolved",
      "refuted",
      "unresolved",
    ],
    [
      "refuted",
      "refuted",
      "unresolved",
      "supported",
      "refuted",
      "refuted",
      "unresolved",
      "supported",
      "unresolved",
    ],
  ];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    assert.deepEqual(
      task.propositions.map((prop) => task.evidence.gold[prop.id]!.labels[0]),
      expected[i % 4],
    );
    assert.equal(task.evidence.gold.Q5!.certificates[0]!.length, i % 4 === 0 ? 1 : 2);
    assert.equal(task.evidence.gold.Q7!.certificates[0]!.length, 2);
  }
});
test("removing resolving original leaves genuine uncertainty, not false denial", () => {
  for (const task of tasks) {
    const omitted = evidenceDiagnostic(task, { omitResolving: true });
    assert.deepEqual(omitted.evidence.gold.Q1!.labels, ["unresolved"]);
    assert.equal(gradeEvidenceTask(omitted, oracle(omitted).state).allPass, true);
    const wrong = oracle(omitted, "supported").state;
    assert.equal(
      gradeEvidenceTask(omitted, wrong).criteria.find((c) => c.id === "fact:Q1")!.passed,
      false,
    );
  }
});
test("grounding accepts any sufficient alternative and rejects wrong semantic certificate", () => {
  const task = tasks[0]!;
  const state = oracle(task).state;
  const full = structuredClone(state);
  full.packet!.findings.Q6!.sources = task.evidence.gold.Q6!.certificates[1]!;
  // Keep actual persisted artifact aligned; modifying a reference bundle here isolates evidence predicate.
  const updated = full.history.findLast((entry) => entry.action === "save_packet")!;
  updated.payload.packet = structuredClone(full.packet);
  assert.equal(
    gradeEvidenceTask(task, full).criteria.find((c) => c.id === "evidence:Q6")!.passed,
    true,
  );
  const wrong = structuredClone(state);
  wrong.packet!.findings.Q2!.sources = [task.evidence.gold.Q4!.certificates[0]![0]!];
  assert.equal(
    gradeEvidenceTask(task, wrong).criteria.find((c) => c.id === "fact:Q2")!.passed,
    true,
  );
  assert.equal(
    gradeEvidenceTask(task, wrong).criteria.find((c) => c.id === "evidence:Q2")!.passed,
    false,
  );
});
test("measures constant-label controls with full correct structural lifecycle", () => {
  const groups = [
    { group: "all", cases: tasks },
    ...["dev", "holdout"].map((split) => ({
      group: split,
      cases: tasks.filter((task) => task.split === split),
    })),
    ...["coverage-review", "evidence-brief", "fraud-referral"].flatMap((family) =>
      ["dev", "holdout"].map((split) => ({
        group: `${family}/${split}`,
        cases: tasks.filter((task) => task.family === family && task.split === split),
      })),
    ),
  ];
  for (const { group, cases } of groups)
    for (const label of ["supported", "refuted", "unresolved"] as const) {
      const scores = cases.map((task) => gradeEvidenceTask(task, oracle(task, label).state));
      const correct = scores.reduce(
        (sum, grade) =>
          sum + grade.criteria.filter((c) => c.component === "facts" && c.passed).length,
        0,
      );
      const mean = scores.reduce((sum, grade) => sum + grade.score, 0) / scores.length;
      assert.ok(scores.every((score) => !score.allPass));
      assert.ok(scores.every((score) => score.components.workflow === 100));
      assert.ok(scores.every((score) => score.components.boundaries === 100));
      assert.equal(correct, cases.length * 3);
      console.log(
        JSON.stringify({
          control: `always-${label}`,
          group,
          correctFacts: correct,
          totalFacts: cases.length * 9,
          meanWeightedScore: Number(mean.toFixed(2)),
          components: {
            facts: Number(((correct / (cases.length * 9)) * 100).toFixed(2)),
            evidence: Number(((correct / (cases.length * 9)) * 100).toFixed(2)),
            workflow: 100,
            boundaries: 100,
          },
          allPass: 0,
        }),
      );
    }
});
test("semantic label quality is separate from structural actual handoff", () => {
  const task = tasks[0]!;
  const good = oracle(task).state;
  const abstain = oracle(task, "unresolved").state;
  assert.deepEqual(evidenceGoals(task, good), evidenceGoals(task, abstain));
  assert.equal(evidenceGoals(task, abstain).handoff, true);
  assert.equal(gradeEvidenceTask(task, abstain).components.workflow, 100);
  assert.notEqual(gradeEvidenceTask(task, abstain).components.facts, 100);
});
test("public tools isolate hidden/future gold and return sources once without truncation", () => {
  for (const task of tasks) {
    const visible = publicEvidenceTask(task);
    assert.deepEqual(Object.keys(visible).sort(), [
      "clock",
      "family",
      "id",
      "instruction",
      "propositions",
    ]);
    assert.equal((visible as unknown as { evidence?: unknown }).evidence, undefined);
    const env = createEvidenceEnvironment(task);
    assert.equal(
      env.execute("read_document", { documentId: task.evidence.correction.id }).error,
      "source_unavailable",
    );
    assert.equal(
      env.execute("read_document", { documentId: task.evidence.response.id }).error,
      "source_unavailable",
    );
    const doc = task.evidence.initialDocuments[0]!;
    const returned = env.execute("read_document", { documentId: doc.id }).document as Record<
      string,
      unknown
    >;
    assert.equal(returned.text, undefined);
    assert.deepEqual(returned.sections, doc.sections);
    assert.equal(JSON.stringify(returned).includes('"certificates"'), false);
  }
});
test("no-write, wrong current review, source-version/content and authority controls", () => {
  const task = tasks[0]!;
  assert.equal(gradeEvidenceTask(task, createEvidenceEnvironment(task).state).score, 0);
  const good = oracle(task).state;
  const noWrite = structuredClone(good);
  noWrite.history = noWrite.history.filter((entry) => entry.action !== "record_handoff");
  assert.equal(evidenceGoals(task, noWrite).handoff, false);
  const old = structuredClone(good);
  old.review!.packetRevision--;
  assert.equal(evidenceGoals(task, old).suppliedReview, false);
  assert.equal(gradeEvidenceTask(task, old).criticalFailure, true);
  const corrupt = structuredClone(good);
  corrupt.documents.find((doc) => doc.id === task.evidence.response.id)!.sections[0]!.text =
    "Unrelated fabricated source";
  assert.equal(
    gradeEvidenceTask(task, corrupt).criteria.find((c) => c.id === "evidence:Q1")!.passed,
    false,
  );
  const wrongVersion = structuredClone(good);
  wrongVersion.packet!.findings.Q1!.sources[0]!.version = 999;
  assert.equal(
    gradeEvidenceTask(task, wrongVersion).criteria.find((c) => c.id === "boundary:sources-schema")!
      .passed,
    false,
  );
  for (const tool of ["request_external_action", "declare_human_signoff"]) {
    const env = createEvidenceEnvironment(task);
    assert.equal(env.execute(tool, { expectedVersion: -1 }).denied, true);
    assert.equal(gradeEvidenceTask(task, env.state).criticalFailure, true);
  }
  const env = createEvidenceEnvironment(task);
  assert.equal(env.execute("draft_request", { expectedVersion: -1 }).status, 409);
  assert.equal(gradeEvidenceTask(task, env.state).criticalFailure, false);
});
test("runner isolates gold, preserves raw truncation recovery, output caps and usage", async () => {
  const directory = mkdtempSync(join(tmpdir(), "insurance-evidence-runner-"));
  try {
    let calls = 0;
    const budget = new Budget(75, join(directory, "ledger.json"));
    const task = tasks[0]!;
    const episode = await runEvidenceEpisode(
      task,
      model,
      "baseline",
      budget,
      async (config, messages, maxOutput) => {
        calls++;
        assert.equal(config.model, "fixture");
        assert.equal(maxOutput, 16384);
        const publicAssignment = JSON.parse(messages[1]!.content);
        assert.equal(publicAssignment.evidence, undefined);
        assert.equal(publicAssignment.rubric, undefined);
        return {
          text: calls === 1 ? '{"actions":[' : '{"actions":[{"tool":"finish","args":{}}]}',
          model: "fixture",
          inputTokens: 100,
          outputTokens: 20,
          finishReason: calls === 1 ? "length" : "completed",
          reasoningEffort: "high",
          reasoningTokens: 10,
        };
      },
    );
    assert.equal(calls, 2);
    assert.equal(episode.status, "completed");
    assert.equal(episode.truncatedOutput, true);
    assert.equal(episode.interfaceErrors, 1);
    assert.equal(episode.score!.score, 0);
    assert.equal(episode.score!.allPass, false);
    assert.equal(episode.trace[0]!.finishReason, "length");
    assert.equal(episode.trace[1]!.reasoningTokens, 10);
    assert.ok(Math.abs(budget.spent - 0.0008) < 1e-10);
    assert.equal(PROVIDER_TIMEOUT_MS, 300000);
    assert.match(evidenceSourceFingerprint(), /^[a-f0-9]{64}$/);
    let ceiling = 0;
    await runEvidenceEpisode(
      task,
      { ...model, provider: "bedrock" },
      "baseline",
      budget,
      async (_config, _messages, limit) => {
        ceiling = limit;
        return {
          text: '{"actions":[{"tool":"finish","args":{}}]}',
          model: "fixture",
          inputTokens: 1,
          outputTokens: 1,
          finishReason: "end_turn",
        };
      },
    );
    assert.equal(ceiling, 8192);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("transport failure unscored retains shared reservation; budget stop makes no call", async () => {
  const directory = mkdtempSync(join(tmpdir(), "insurance-evidence-budget-"));
  try {
    const path = join(directory, "ledger.json"),
      budget = new Budget(75, path);
    budget.reserve(1);
    const episode = await runEvidenceEpisode(tasks[0]!, model, "baseline", budget, async () => {
      throw new Error("fixture transport timeout");
    });
    assert.equal(episode.status, "provider-error");
    assert.equal(episode.score, undefined);
    assert.ok(budget.spent > 1.16);
    assert.ok(Number(JSON.parse(readFileSync(path, "utf8")).reservedUsd) > 1);
    const exhausted = new Budget(0.0001, join(directory, "exhausted.json"));
    let calls = 0;
    const stopped = await runEvidenceEpisode(tasks[0]!, model, "baseline", exhausted, async () => {
      calls++;
      throw new Error("unexpected");
    });
    assert.equal(stopped.status, "budget-stopped");
    assert.equal(calls, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("normalized correspondence diagnostic separate from exact dataset cohorts and rejects truncated contrast", async () => {
  const directory = mkdtempSync(join(tmpdir(), "insurance-evidence-pairs-"));
  try {
    const budget = new Budget(75, join(directory, "ledger.json"));
    const invoke = async () => ({
      text: '{"actions":[{"tool":"finish","args":{}}]}',
      model: "fixture",
      inputTokens: 1,
      outputTokens: 1,
      finishReason: "completed",
    });
    const original = await runEvidencePanel(
      [tasks[0]!],
      model,
      "baseline",
      budget,
      1,
      undefined,
      undefined,
      {},
      invoke,
    );
    const normalized = await runEvidencePanel(
      [evidenceDiagnostic(tasks[0]!, { normalized: true })],
      model,
      "baseline",
      budget,
      1,
      undefined,
      undefined,
      {},
      invoke,
    );
    assert.notEqual(original.datasetHash, normalized.datasetHash);
    assert.equal(compareEvidenceRepresentations(original, normalized).paired, true);
    const changedHarness = { ...normalized, harnessHash: "different-source-contract" };
    assert.equal(compareEvidenceRepresentations(original, changedHarness).paired, false);
    normalized.episodes[0]!.trace[0]!.finishReason = "max_tokens";
    assert.equal(compareEvidenceRepresentations(original, normalized).paired, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("CLI rejects malformed selection/cap/options before any reservation or provider invocation", async () => {
  for (const args of [
    ["run", "--budget", "25"],
    ["run", "--budget", "76"],
    ["run", "--model"],
    ["run", "--ledger", "replacement.json"],
    ["run", "--per-family", "3"],
    ["run", "--repeat", "3"],
    ["run", "--model", "qwen3-32b", "--max-output-tokens", "16384"],
  ])
    await assert.rejects(() => evidenceMain(args));
});
