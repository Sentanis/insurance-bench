import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateWorkflowCases } from "../insurance-bench/workflow-cases.ts";
import { runWorkflowEpisode, workflowSourceFingerprint } from "../insurance-bench/workflow-runner.ts";
import { Budget } from "../insurance-bench/runner.ts";
import type { ModelConfig, Message } from "../insurance-bench/providers.ts";
const model: ModelConfig = { provider: "openai", model: "fixture", reasoningEffort: "high", inputUsdPerMillion: 2, outputUsdPerMillion: 10 };
test("workflow runner sends only public assignment and grades actual unsaved state rather than narrated success", async () => {
  const directory = mkdtempSync(join(tmpdir(), "insurance-workflow-runner-"));
  try {
    let captured: Message[] = [];
    const budget = new Budget(25, join(directory, "ledger.json"));
    const task = generateWorkflowCases(2718)[0]!;
    const episode = await runWorkflowEpisode(task, model, "baseline", budget, async (_model, messages, limit) => {
      captured = structuredClone(messages);
      assert.equal(limit, 16384);
      return { text: '{"actions":[{"tool":"finish","args":{}}]}', model: "fixture", inputTokens: 100, outputTokens: 20, finishReason: "completed", reasoningEffort: "high", reasoningTokens: 10 };
    });
    const assignment = JSON.parse(captured[1]!.content);
    assert.deepEqual(Object.keys(assignment).sort(), ["clock", "family", "id", "instruction"]);
    assert.equal(assignment.workflow, undefined);
    assert.equal(assignment.rubric, undefined);
    assert.equal(episode.status, "completed");
    assert.equal(episode.score!.allPass, false);
    assert.equal(episode.score!.criteria.find((criterion) => criterion.id === "workflow:current-state")!.passed, false);
    assert.equal(episode.trace[0]!.reasoningEffort, "high");
    assert.equal(episode.trace[0]!.reasoningTokens, 10);
    assert.ok(Math.abs(budget.spent - 0.0004) < 1e-10);
    assert.match(workflowSourceFingerprint(), /^[a-f0-9]{64}$/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test("workflow provider failure remains unscored and retains its prior reservation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "insurance-workflow-failure-"));
  try {
    const budget = new Budget(25, join(directory, "ledger.json"));
    const episode = await runWorkflowEpisode(generateWorkflowCases(2718)[0]!, model, "baseline", budget, async () => { throw new Error("fixture provider timeout"); });
    assert.equal(episode.status, "provider-error");
    assert.equal(episode.score, undefined);
    assert.equal(episode.trace.length, 0);
    assert.equal(episode.estimatedCostUsd, 0);
    assert.ok(budget.spent >= 16384 * 10 / 1e6);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
