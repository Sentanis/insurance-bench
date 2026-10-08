import { mkdirSync, openSync, closeSync, writeSync, ftruncateSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { completeGeminiCodeAssist, geminiPreflight, GeminiAdapterError, GEMINI_MODELS,
  type GeminiModel, type GeminiRequest, type GeminiCompletion } from "../insurance-bench/gemini-code-assist.ts";

// Reference Developer API rates, conservatively retained for OAuth quota accounting.
// Verified 2026-10-04: https://ai.google.dev/gemini-api/docs/pricing
export const GEMINI_PROBE_PRICES = {
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.1-pro-preview": { input: 2, output: 12 },
} as const;
export const GEMINI_PROBE_PROMPT = "This is a synthetic access check, not a benchmark task. Reply with exactly ACCESS_OK. Do not call any tools.";
export const GEMINI_PROBE_LIMIT = 2048;
interface ProbeBudget { reserve(amount: number): void; settle(reserved: number, actual: number): void }
function safeFailureUsage(error: GeminiAdapterError) {
  const usage = error.usage;
  if (!usage || ![usage.inputTokens, usage.outputTokens, usage.reasoningTokens, usage.cacheReadInputTokens].every(value => Number.isSafeInteger(value) && value >= 0) ||
    usage.reasoningTokens > usage.outputTokens || usage.cacheReadInputTokens > usage.inputTokens) return undefined;
  return { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, reasoningTokens: usage.reasoningTokens, cacheReadInputTokens: usage.cacheReadInputTokens };
}
export async function runGeminiAccessProbe(model: GeminiModel, budget: ProbeBudget, invoke: (request: GeminiRequest) => Promise<GeminiCompletion> = completeGeminiCodeAssist) {
  if (!GEMINI_MODELS.includes(model)) throw new GeminiAdapterError("request-invalid");
  const prices = GEMINI_PROBE_PRICES[model];
  // Reserve the largest configured tariff, including a known-model substitution
  // margin and 4096 input-token headroom for service-side accounting overhead.
  const reservationPrices = { input: 2, output: 12 };
  const reservedUsd = (Math.max(4096, Buffer.byteLength(GEMINI_PROBE_PROMPT) * 1.25) * reservationPrices.input + GEMINI_PROBE_LIMIT * reservationPrices.output) / 1e6;
  budget.reserve(reservedUsd);
  const base = { model, accessOnly: true, abilityScore: null, maxOutputTokens: GEMINI_PROBE_LIMIT,
    deadlineMs: 300_000, fallback: false, retries: 0, reservedUsd, reservationPrices,
    pricingVerifiedAt: "2026-10-04", pricingSource: "https://ai.google.dev/gemini-api/docs/pricing",
    accounting: "Conservative Developer API reference rate; actual OAuth billing not established" };
  try {
    const result = await invoke({ model, prompt: GEMINI_PROBE_PROMPT, maxOutputTokens: GEMINI_PROBE_LIMIT });
    const actualUsd = (result.inputTokens * prices.input + result.outputTokens * prices.output) / 1e6;
    if (result.finishReason !== "STOP" || result.text.trim() !== "ACCESS_OK") {
      return { ...base, status: "unexpected-response", modelVersion: result.modelVersion, finishReason: result.finishReason,
        observedNativeUsage: safeFailureUsage(new GeminiAdapterError("metadata-invalid", result)),
        requestedRateCostEstimateUsd: actualUsd, billingUncertain: true, reservationRetained: true };
    }
    budget.settle(reservedUsd, actualUsd);
    return { ...base, status: "access-confirmed",
      modelVersion: result.modelVersion, finishReason: result.finishReason,
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, reasoningTokens: result.reasoningTokens,
      cacheReadInputTokens: result.cacheReadInputTokens, actualReferenceCostUsd: actualUsd,
      reservationRetained: false };
  } catch (error) {
    const safe = error instanceof GeminiAdapterError ? error : new GeminiAdapterError("transport-failed");
    const observedNativeUsage = safeFailureUsage(safe);
    const requestedRateCostEstimateUsd = observedNativeUsage
      ? (observedNativeUsage.inputTokens * prices.input + observedNativeUsage.outputTokens * prices.output) / 1e6 : undefined;
    return { ...base, status: "access-unconfirmed", errorCode: safe.code,
      observedNativeUsage, requestedRateCostEstimateUsd, billingUncertain: true, reservationRetained: true };
  }
}
async function main() {
  const args = process.argv.slice(2);
  const value = (key: string) => args[args.indexOf(key) + 1];
  if (!args.includes("--model")) throw new GeminiAdapterError("request-invalid");
  const model = value("--model");
  if (!GEMINI_MODELS.includes(model as GeminiModel)) throw new GeminiAdapterError("request-invalid");
  if (!args.includes("--run")) {
    console.log(JSON.stringify({ ...geminiPreflight(), model, exactModelConfigured: true, inferencePerformed: false }));
    return;
  }
  const output = value("--out");
  if (!args.includes("--out") || !output || output.startsWith("--")) throw new GeminiAdapterError("request-invalid");
  mkdirSync(dirname(resolve(output)), { recursive: true });
  // Claim a writable, new receipt before reserving or invoking the provider.
  // A crash leaves a visible pending admission, never a second silent attempt.
  const receiptFd = openSync(resolve(output), "wx", 0o600);
  const persist = (receipt: unknown) => {
    ftruncateSync(receiptFd, 0);
    writeSync(receiptFd, JSON.stringify(receipt, null, 2) + "\n", 0, "utf8");
  };
  try {
    persist({ recordedAt: new Date().toISOString(), model, status: "pending-access-admission", abilityScore: null });
    // The same approved total cap and existing ledger; no reset or separate allowance.
    const { Budget } = await import("../insurance-bench/runner.ts");
    const budget = new Budget(75, resolve(".tmp/insurance-bench/session-budget.json"));
    const result = await runGeminiAccessProbe(model as GeminiModel, budget);
    const receipt = { recordedAt: new Date().toISOString(), ...result };
    persist(receipt);
    console.log(JSON.stringify({ status: receipt.status, model, abilityScore: null }));
    if (receipt.status !== "access-confirmed") process.exitCode = 1;
  } finally { closeSync(receiptFd); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { console.error("Gemini probe: preflight-or-ledger-failed"); process.exitCode = 1; });
}
