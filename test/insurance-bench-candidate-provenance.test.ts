import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateInvestigationCases } from "../insurance-bench/investigation-cases.ts";
import { generateInteractionCases } from "../insurance-bench/interaction-cases.ts";
import { investigationSourceFingerprint } from "../insurance-bench/investigation-runner.ts";
import { INTERACTION_SOURCE_FILES, interactionSourceFingerprint, interactionSystemPrompt, runInteractionPanel } from "../insurance-bench/interaction-runner.ts";
import { JSON_INVESTIGATION_SOURCE_FILES, jsonInvestigationSourceFingerprint, jsonInvestigationSystemPrompt, runJsonInvestigationPanel } from "../insurance-bench/json-investigation-runner.ts";
import { Budget, hash } from "../insurance-bench/runner.ts";
import type { Completion, ModelConfig } from "../insurance-bench/investigation-providers.ts";
import { interactionMain } from "../scripts/insurance-bench-interaction.ts";
import { jsonInvestigationMain } from "../scripts/insurance-bench-json-investigation.ts";

const model: ModelConfig = { provider: "openai", model: "fixture", reasoningEffort: "low", inputUsdPerMillion: 2, outputUsdPerMillion: 10 };
const terminal = (): Completion => ({ text: '{"actions":[{"tool":"finish","args":{}}]}', inputTokens: 10, outputTokens: 10, model: "fixture", reasoningEffort: "low", finishReason: "completed" });

test("candidate native runs bind new source versions without relabeling frozen results", async () => {
  const directory = mkdtempSync(join(tmpdir(), "insurance-candidate-provenance-"));
  try {
    const oldTasks = generateInvestigationCases().filter(task => task.split === "dev");
    const tasks = generateInteractionCases().filter(task => task.split === "dev");
    assert.equal(tasks.length, 6);
    assert.ok(tasks.every(task => !oldTasks.some(old => old.id === task.id)));
    assert.notEqual(interactionSourceFingerprint(), investigationSourceFingerprint());
    assert.notEqual(jsonInvestigationSourceFingerprint(), investigationSourceFingerprint());
    assert.notEqual(jsonInvestigationSourceFingerprint(), interactionSourceFingerprint());
    let calls = 0;
    const run = await runInteractionPanel(tasks, model, "baseline", new Budget(75, join(directory, "interaction.json")), 1, undefined, undefined, { maxTurns: 20, maxOutputTokens: 16384 }, async (config, messages, limit) => {
      calls++;
      assert.equal(config.model, "fixture");
      assert.equal(limit, 16384);
      const assignment = JSON.parse(messages[1]!.content);
      assert.equal(assignment.investigation, undefined);
      assert.equal(assignment.rubric, undefined);
      assert.equal(Object.keys(assignment.factDefinitions).length, 16);
      return terminal();
    });
    assert.equal(calls, 6);
    assert.equal(run.version, "insurance-bench-interaction-v0.10");
    assert.equal(run.datasetHash, hash(tasks));
    assert.deepEqual(run.taskIds, tasks.map(task => task.id));
    assert.equal(run.completeCoverage, true);
    assert.equal(run.benchmarkScore, 0);
    assert.equal(run.headlineMetric, "macro-task-success");
    assert.equal(run.responseFormat, "json_object");
    assert.equal(run.harnessHash, hash([interactionSourceFingerprint(), interactionSystemPrompt("baseline"), 20, 16384]));
    assert.equal(run.limits?.maxOutputTokens, 16384);
    const json = await runJsonInvestigationPanel(oldTasks.slice(0, 1), model, "baseline", new Budget(75, join(directory, "json.json")), 1, undefined, undefined, {}, async () => terminal());
    assert.equal(json.version, "insurance-bench-investigation-v0.9j-json-object");
    assert.equal(json.responseFormat, "json_object");
    assert.equal(json.harnessHash, hash([jsonInvestigationSourceFingerprint(), jsonInvestigationSystemPrompt("baseline"), 20, 16384]));
    assert.equal(json.datasetHash, hash(oldTasks.slice(0, 1)));
    assert.equal(json.benchmarkScore, 0);
    assert.notEqual(run.harnessHash, json.harnessHash);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("candidate CLIs reject invalid cap and JSON-provider path without altering the shared ledger", async () => {
  const directory = mkdtempSync(join(tmpdir(), "insurance-candidate-cli-"));
  const originalDirectory = process.cwd();
  try {
    process.chdir(directory);
    mkdirSync(".tmp/insurance-bench", { recursive: true });
    mkdirSync("insurance-bench", { recursive: true });
    const ledger = ".tmp/insurance-bench/session-budget.json";
    writeFileSync(ledger, JSON.stringify({ capUsd: 75, reservedUsd: 1 }));
    writeFileSync("insurance-bench/models.json", JSON.stringify({
      "qwen3-32b": { ...model, provider: "openai" },
      "gpt-6-luna-low": { ...model, provider: "bedrock" },
    }));
    const before = readFileSync(ledger);
    for (const main of [interactionMain, jsonInvestigationMain]) {
      for (const args of [["run", "--budget", "25"], ["run", "--budget", "76"], ["run", "--ledger", "replacement.json"], ["run", "--per-family", "3"]]) {
        await assert.rejects(main(args));
      }
    }
    await assert.rejects(jsonInvestigationMain(["run", "--model", "qwen3-32b"]), /OpenAI path only/);
    for (const main of [interactionMain, jsonInvestigationMain]) {
      await assert.rejects(main(["run", "--model", "gpt-6-luna-low", "--out", "unadmitted-output"]), /candidate dispatch admission rejected/);
      await assert.rejects(main(["run", "--model", "gpt-6-luna-low", "--split", "holdout", "--admission", "forged-registration.json", "--freeze-commit", "f".repeat(40), "--panel", "forged-panel", "--release", "forged-release.json", "--out", "unadmitted-output"]), /candidate dispatch admission rejected/);
      assert.equal(existsSync("unadmitted-output"), false);
    }
    await assert.rejects(interactionMain(["run", "--model", "qwen3-32b"]), /OpenAI path only/);
    assert.deepEqual(readFileSync(ledger), before);
  } finally {
    process.chdir(originalDirectory);
    rmSync(directory, { recursive: true, force: true });
  }
});

// Source manifests are immutable repository-relative lists, shared by native fingerprint and admission.
test("both new candidate fingerprints bind canonical sources including admission and JSON transport", () => {
  for (const [names, fingerprint] of [[INTERACTION_SOURCE_FILES, interactionSourceFingerprint], [JSON_INVESTIGATION_SOURCE_FILES, jsonInvestigationSourceFingerprint]] as const) {
    assert.equal(Object.isFrozen(names), true);
    assert.equal(new Set(names).size, names.length);
    assert.ok(names.includes("insurance-bench/candidate-admission.ts"));
    assert.ok(names.includes("insurance-bench/json-object-provider.ts"));
    assert.ok(names.every(name => !isAbsolute(name) && !name.includes("..")));
    const source = names.map(name => [name, readFileSync(fileURLToPath(new URL("../" + name, import.meta.url)), "utf8")]);
    assert.equal(fingerprint(), hash(source));
  }
});
