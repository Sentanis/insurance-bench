import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  generateInteractionCases,
  INTERACTION_FAMILIES,
} from "../insurance-bench/interaction-cases.ts";
import {
  interactionSourceFingerprint,
  runInteractionPanel,
  INTERACTION_VERSION,
  INTERACTION_SOURCE_FILES,
  interactionSystemPrompt,
} from "../insurance-bench/interaction-runner.ts";
import { Budget, hash, type Variant } from "../insurance-bench/runner.ts";
import type { ModelConfig } from "../insurance-bench/providers.ts";
import { admitCandidateDispatch, claimCandidateDispatch } from "../insurance-bench/candidate-admission.ts";
const REPOSITORY_ROOT = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
export async function interactionMain(input = process.argv.slice(2)) {
  const argv = [...input];
  const command = argv.shift() ?? "help";
  if (command === "help") {
    console.log(
      "Interaction Bench: manifest --out PATH | run --model EXACT_CONFIG_NAME --split dev|holdout --per-family 1|2 --case-offset 0|1 --repeat 1|2 [--families comma-separated] [--max-output-tokens 16384|8192] --budget 75 --admission ROOT_RELATIVE_REGISTRATION --freeze-commit FULL_SHA --panel REGISTERED_ID [--release ROOT_RELATIVE_HOLDOUT_RELEASE] [--out DIR]. Uses SAME .tmp/insurance-bench/session-budget.json; never resets ledger. Expert validation remains open.",
    );
    return;
  }
  if (command !== "manifest" && command !== "run") throw new Error("Unknown interaction command");
  const allowed =
    command === "manifest"
      ? ["seed", "out"]
      : [
          "seed",
          "split",
          "per-family",
          "case-offset",
          "repeat",
          "families",
          "budget",
          "model",
          "variant",
          "out",
          "max-output-tokens",
          "admission",
          "freeze-commit",
          "panel",
          "release",
        ];
  const options = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i],
      value = argv[i + 1];
    if (
      !name?.startsWith("--") ||
      !allowed.includes(name.slice(2)) ||
      value === undefined ||
      value.startsWith("--") ||
      options.has(name.slice(2))
    )
      throw new Error("Unknown, duplicate or missing interaction option value");
    options.set(name.slice(2), value);
  }
  const option = (name: string, fallback: string) => options.get(name) ?? fallback;
  const seed = Number(option("seed", "100419"));
  let tasks = generateInteractionCases(seed);
  const fullCorpusHash = hash(tasks);
  if (command === "manifest") {
    const destination = resolve(option("out", ".tmp/insurance-bench/interaction-v010-manifest.json"));
    const controlFiles = [
      "scripts/insurance-bench-interaction.ts",
      "test/insurance-bench-interaction-cases.test.ts",
      "specs/features/insurance-bench/v10-design-candidate.md",
    ];
    const manifest = {
      version: INTERACTION_VERSION,
      createdAt: new Date().toISOString(),
      seed,
      sourceFingerprint: interactionSourceFingerprint(),
      datasetHash: hash(tasks),
      scoring: {
        headlineMetric: "macro-task-success",
        success: "completed episode with every existing semantic, evidence, workflow and boundary criterion passing",
        diagnostic: "unchanged family-weighted partial credit; facts40/evidence25/workflow25/boundaries10",
        historicalRegrading: false,
      },
      reviewControlHashes: Object.fromEntries(
        controlFiles.map((path) => [path, hash(readFileSync(resolve(REPOSITORY_ROOT, path), "utf8"))]),
      ),
      taskIds: tasks.map((task) => ({
        id: task.id,
        family: task.family,
        split: task.split,
        fieldCount: Object.keys(task.investigation.factDefinitions).length,
      })),
      limits: {
        maxTurns: 20,
        inclusiveOutputTokens: { openai: 16384 },
        responseFormat: "json_object",
        providerDeadlineSeconds: 600,
      },
      reviewerControls: [
        "independent non-author full-current-source derivation audit after response and both corrections required before paid calls",
        "equivalent paraphrase/page/source-ID positives",
        "authority, alias, supersession and response propagation truth-table controls",
        "alwaysready/alwaysabstain negatives",
        "oracle same public tools100 with every mutation and both announced corrections",
        "source revision/authority/current-review negatives",
        "raw output-limited scores retained but no clean comparisons",
      ],
      validation:
        "Insurance expert, coverage counsel, clinical and representative-data validity remain OPEN; author labels only",
      budget: {
        maximumTotalUsd: 75,
        sharedLedger: ".tmp/insurance-bench/session-budget.json",
        reset: false,
      },
    };
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, JSON.stringify(manifest, null, 2));
    console.log(
      JSON.stringify({ manifest: destination, sourceFingerprint: manifest.sourceFingerprint }),
    );
    return;
  }
  const budgetCap = Number(option("budget", "75"));
  if (budgetCap !== 75)
    throw new Error(
      "This authorization requires total cap75; a lesser cap would shrink the shared ledger, and a larger cap is not authorized",
    );
  const split = option("split", "dev"),
    perFamily = Number(option("per-family", "2")),
    offset = Number(option("case-offset", "0")),
    repeat = Number(option("repeat", "1"));
  if (
    !["dev", "holdout"].includes(split) ||
    ![1, 2].includes(perFamily) ||
    ![0, 1].includes(offset) ||
    offset + perFamily > 2 ||
    ![1, 2].includes(repeat)
  )
    throw new Error("Invalid split/case/repeat selection");
  const families = options.has("families") ? option("families", "").split(",") : INTERACTION_FAMILIES;
  if (
    !families.length ||
    new Set(families).size !== families.length ||
    families.some(
      (family) => !INTERACTION_FAMILIES.includes(family as (typeof INTERACTION_FAMILIES)[number]),
    )
  )
    throw new Error("Invalid interaction families");
  const counts = new Map<string, number>();
  tasks = tasks.filter((task) => {
    if (task.split !== split || !families.includes(task.family)) return false;
    const count = counts.get(task.family) ?? 0;
    counts.set(task.family, count + 1);
    return count >= offset && count < offset + perFamily;
  });
  const config: Record<string, ModelConfig> = JSON.parse(
    readFileSync(resolve(REPOSITORY_ROOT, "insurance-bench/models.json"), "utf8"),
  );
  const name = option("model", "gpt-6.1-sol-low"),
    model = config[name];
  if (!model) throw new Error("Exact model name absent from models.json");
  if (model.provider !== "openai")
    throw new Error("Native JSON-object interaction candidate supports the exact OpenAI path only");
  const ceiling = model.provider === "openai" ? 16384 : 8192;
  const maxOutput = Number(option("max-output-tokens", String(ceiling)));
  if (!Number.isSafeInteger(maxOutput) || maxOutput < 128 || maxOutput > ceiling)
    throw new Error(
      `Output ceiling for this candidate/provider is${ceiling}; supported limits must be declared, not silently changed`,
    );
  const variant = option("variant", "baseline") as Variant;
  if (!["baseline", "evidence-checklist", "verify-before-finish"].includes(variant))
    throw new Error("Invalid prompt variant");
  const nativeLimits = { maxTurns: 20, maxOutputTokens: maxOutput };
  const sourceFingerprint = interactionSourceFingerprint();
  const admitted = admitCandidateDispatch({
    repositoryRoot: REPOSITORY_ROOT,
    freezeCommit: option("freeze-commit", ""),
    admissionPath: option("admission", ""),
    panelId: option("panel", ""),
    sourceFiles: INTERACTION_SOURCE_FILES,
    generation: INTERACTION_VERSION,
    sourceFingerprint,
    fullCorpusHash,
    datasetHash: hash(tasks),
    modelAlias: name,
    promptHash: hash(interactionSystemPrompt(variant)),
    taskIds: tasks.map(task => task.id),
    modelConfiguration: model,
    variant,
    repeat,
    limits: nativeLimits,
    harnessHash: hash([sourceFingerprint, interactionSystemPrompt(variant), 20, maxOutput]),
    split: split as "dev" | "holdout",
    ...(options.has("release") ? { releasePath: option("release", "") } : {}),
  });
  claimCandidateDispatch(admitted);
  const out = resolve(option("out", "insurance-bench/results"));
  mkdirSync(out, { recursive: true });
  const prefix = `${Date.now()}-${process.pid}-${name}-interaction`;
  const budget = new Budget(budgetCap, admitted.ledgerPath);
  const run = await runInteractionPanel(
    tasks,
    model,
    variant,
    budget,
    repeat,
    (episode) => {
      writeFileSync(
        resolve(out, `${prefix}-${episode.taskId}.episode`),
        JSON.stringify(episode, null, 2),
      );
      console.log(
        `${episode.taskId}: ${episode.status} raw=${episode.score?.score ?? "unscored"} outputLimited=${episode.truncatedOutput}`,
      );
    },
    (episode) => {
      writeFileSync(
        resolve(out, `${prefix}-${episode.taskId}-turn${episode.trace.at(-1)!.turn}.partial`),
        JSON.stringify(episode, null, 2),
      );
    },
    nativeLimits,
  );
  writeFileSync(resolve(out, `${run.runId}.json`), JSON.stringify(run, null, 2));
  console.log(
    JSON.stringify({
      runId: run.runId,
      headlineMetric: run.headlineMetric,
      benchmarkScore: run.benchmarkScore,
      diagnosticPartialCredit: run.summary.score,
      coverage: run.coverage,
      costUsd: run.estimatedCostUsd,
      sharedReservedUsd: budget.spent,
      limits: run.limits,
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  interactionMain().catch((error) => {
    console.error(error instanceof Error ? error.message : "Interaction command failed");
    process.exitCode = 1;
  });
