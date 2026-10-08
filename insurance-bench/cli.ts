import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { generateCases } from "./cases.ts";
import { generateChallengeCases } from "./challenge-cases.ts";
import { generatePortfolioCases } from "./portfolio-cases.ts";
import { generateFrontierCases } from "./frontier-cases.ts";
import { generateCoupledCases, type CoupledTask } from "./coupled-cases.ts";
import { runCoupledPanel } from "./coupled-runner.ts";
import { generateWorkflowCases } from "./workflow-cases.ts";
import { runWorkflowPanel } from "./workflow-runner.ts";
import type { WorkflowTask } from "./workflow-types.ts";
import { FAMILIES } from "./types.ts";
import {
  Budget,
  runPanel,
  CHALLENGE_VERSION,
  PORTFOLIO_VERSION,
  BENCH_VERSION,
  type Variant,
  type Run,
} from "./runner.ts";
import { discoverOpenAI, discoverBedrock } from "./provider-discovery.ts";
import { complete, type ModelConfig } from "./providers.ts";
import { buildReport } from "./report.ts";

export async function main(argv = process.argv.slice(2)) {
  const command = argv.shift() ?? "help";
  const option = (key: string, fallback?: string) => {
    const i = argv.indexOf(`--${key}`);
    return i >= 0 ? argv[i + 1] : fallback;
  };
  if (command === "help") {
    console.log(
      "Insurance Bench: discover | probe --models NAMES [--max-output-tokens 2048] | run --model NAME --suite coupled|workflows|frontier|portfolio|challenge|pilot --split dev|holdout --variant baseline|evidence-checklist|verify-before-finish [--families comma-separated] [--per-family 1] [--case-offset 0] [--repeat 1] [--budget 25] | loop --models gpt-6.1-sol,claude-sonnet-4.6 | report --runs DIR --out DIR",
    );
    return;
  }
  if (command === "discover") {
    const results = await Promise.allSettled([
      discoverOpenAI(),
      discoverBedrock(option("profile", "sentanis-phase0")!, option("region", "us-west-2")!),
    ]);
    console.log(
      JSON.stringify(
        results.map((r) =>
          r.status === "fulfilled"
            ? r.value
            : { unavailable: r.reason instanceof Error ? r.reason.message : "Discovery failed" },
        ),
        null,
        2,
      ),
    );
    return;
  }
  if (command === "report") {
    const dir = resolve(option("runs", ".tmp/insurance-bench/runs")!);
    const runs: Run[] = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")));
    const out = resolve(option("out", "insurance-bench/site")!);
    mkdirSync(out, { recursive: true });
    const contextPath = resolve(dir, "meta/report-context.json");
    const context = existsSync(contextPath) ? JSON.parse(readFileSync(contextPath, "utf8")) : {};
    writeFileSync(resolve(out, "index.html"), buildReport(runs, context));
    console.log(`Report saved to ${out}/index.html (${runs.length} runs)`);
    return;
  }
  if (command !== "run" && command !== "loop" && command !== "probe")
    throw new Error("Unknown command");
  const configurations: Record<string, ModelConfig> = JSON.parse(
    readFileSync(resolve(option("config", "insurance-bench/models.json")!), "utf8"),
  );
  const modelName = option("model", "gpt-6.1-sol")!,
    model = configurations[modelName];
  if (!model) throw new Error("Model name absent from config");
  if (command === "probe") {
    const maxOutput = Number(option("max-output-tokens", "2048"));
    if (!Number.isSafeInteger(maxOutput) || maxOutput < 128 || maxOutput > 8192)
      throw new Error("Probe output limit must be 128–8192");
    const budget = new Budget(
      Number(option("budget", "25")),
      resolve(option("ledger", ".tmp/insurance-bench/session-budget.json")!),
    );
    for (const name of option("models", modelName)!.split(",")) {
      const chosen = configurations[name];
      if (!chosen) throw new Error("Probe model not configured");
      const reservation =
        (maxOutput * chosen.outputUsdPerMillion + 1000 * chosen.inputUsdPerMillion * 1.25) / 1e6;
      budget.reserve(reservation);
      try {
        const result = await complete(
          chosen,
          [{ role: "user", content: 'Return JSON only: {"available":true}.' }],
          maxOutput,
        );
        budget.settle(
          reservation,
          (result.inputTokens * chosen.inputUsdPerMillion +
            result.outputTokens * chosen.outputUsdPerMillion) /
            1e6,
        );
        console.log(
          JSON.stringify({
            name,
            model: result.model,
            accessible: true,
            usableText: result.text.trim().length > 0,
            finishReason: result.finishReason,
            reasoningEffort: chosen.reasoningEffort,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          }),
        );
      } catch (error) {
        console.log(
          JSON.stringify({
            name,
            accessible: false,
            error: error instanceof Error ? error.message : "Probe failed",
          }),
        );
      }
    }
    return;
  }
  const split = command === "loop" ? "dev" : option("split", "dev");
  if (split !== "dev" && split !== "holdout") throw new Error("split must be dev or holdout");
  const variant = option("variant", "baseline") as Variant;
  if (!["baseline", "evidence-checklist", "verify-before-finish"].includes(variant))
    throw new Error("Unknown variant");
  const perFamily = Number(option("per-family", command === "loop" ? "1" : "2")),
    repeat = Number(option("repeat", "1"));
  if (![perFamily, repeat].every((n) => Number.isSafeInteger(n) && n >= 1 && n <= 20))
    throw new Error("per-family and repeat must be integers 1–20");
  const counts = new Map<string, number>();
  const suite = option("suite", "coupled")!;
  if (!["coupled", "workflows", "frontier", "portfolio", "challenge", "pilot"].includes(suite))
    throw new Error("suite must be coupled, workflows, frontier, portfolio, challenge or pilot");
  const families = option("families")?.split(",");
  if (families && (!families.length || new Set(families).size !== families.length || families.some((family) => !FAMILIES.some((known) => known === family))))
    throw new Error("families must be distinct known insurance task families");
  const offset = Number(option("case-offset", "0"));
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1)
    throw new Error("case-offset must be 0 or 1");
  const routing = option("routing", "documents");
  if (routing !== "instruction" && routing !== "documents")
    throw new Error("routing must be instruction or documents");
  const tasks = (
    suite === "coupled" ? generateCoupledCases(31415) : suite === "workflows" ? generateWorkflowCases(2718) : suite === "frontier" ? generateFrontierCases(1729) : suite === "portfolio" ? generatePortfolioCases(1729) : suite === "challenge" ? generateChallengeCases(1729) : generateCases(1729, routing)
  ).filter((t) => {
    if (t.split !== split || (families && !families.includes(t.family))) return false;
    const count = counts.get(t.family) ?? 0;
    counts.set(t.family, count + 1);
    return count >= offset && count < offset + perFamily;
  });
  if (!tasks.length) throw new Error("No selected tasks");
  const budget = new Budget(
    Number(option("budget", "25")),
    resolve(option("ledger", ".tmp/insurance-bench/session-budget.json")!),
  );
  const out = resolve(option("out", ".tmp/insurance-bench/runs")!);
  mkdirSync(out, { recursive: true });
  const execute = async (name: string, chosen: ModelConfig, treatment: Variant) => {
    const artifactPrefix = `${Date.now()}-${process.pid}-${name}-${treatment}`;
    console.log(
      `Running ${tasks.length} ${split} tasks × ${repeat} repetitions on ${name}; ${treatment}; cap $${budget.cap}; ledger $${budget.spent.toFixed(4)}`,
    );
    const onEpisode: Parameters<typeof runPanel>[5] =
      (e) => {
        console.log(
          `${name}/${treatment}/${e.taskId}: ${e.status}${e.score ? ` score=${e.score.score.toFixed(1)} allPass=${e.score.allPass}` : ""}; $${e.estimatedCostUsd.toFixed(4)}`,
        );
        writeFileSync(resolve(out, `${Date.now()}-${name}-${treatment}-${e.taskId}.episode`), JSON.stringify(e, null, 2));
      };
    const onTurn: Parameters<typeof runPanel>[6] = (e) => {
      const latest = e.trace.at(-1)!;
      console.log(`${name}/${e.taskId}: turn ${latest.turn}, ${latest.usage.input}/${latest.usage.output} tokens, ${latest.finishReason ?? "response"}`);
      writeFileSync(resolve(out, `${artifactPrefix}-${e.taskId}-turn-${latest.turn}.partial`), JSON.stringify(e, null, 2));
    };
    const limits = {
      version: suite === "frontier" ? "insurance-bench-frontier-v0.5" : suite === "portfolio" ? PORTFOLIO_VERSION : suite === "challenge" ? CHALLENGE_VERSION : BENCH_VERSION,
      maxTurns: ["coupled", "workflows", "frontier", "portfolio"].includes(suite) ? 20 : 10,
      maxOutputTokens: suite === "pilot" ? 4096 : 16384,
    };
    const run = suite === "coupled" ? await runCoupledPanel(
      tasks as CoupledTask[], chosen, treatment, budget, repeat, onEpisode, onTurn, limits,
    ) : suite === "workflows" ? await runWorkflowPanel(
      tasks as WorkflowTask[], chosen, treatment, budget, repeat, onEpisode, onTurn, limits,
    ) : await runPanel(
      tasks,
      chosen,
      treatment,
      budget,
      repeat,
      onEpisode,
      onTurn,
      limits,
    );
    const path = resolve(out, `${run.runId}.json`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(run, null, 2));
    console.log(
      JSON.stringify(
        {
          path,
          summary: run.summary,
          coverage: run.coverage,
          estimatedCostUsd: run.estimatedCostUsd,
          ledgerUsd: budget.spent,
        },
        null,
        2,
      ),
    );
    return run;
  };
  if (command === "loop") {
    const names = option("models", "gpt-6.1-sol,claude-sonnet-4.6")!.split(",");
    if (names.length !== 2 || names.some((name) => !configurations[name]))
      throw new Error("loop requires exactly two configured models");
    for (const treatment of ["baseline", "evidence-checklist", "verify-before-finish"] as const) {
      await Promise.all(names.map((name) => execute(name, configurations[name]!, treatment)));
    }
  } else await execute(modelName, model, variant);
}
