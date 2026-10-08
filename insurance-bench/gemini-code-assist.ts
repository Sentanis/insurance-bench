import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fork } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Internal CLI exports are deliberately isolated from the frozen shared providers.
export const GEMINI_CLI_VERSION = "0.60.0";
export const GEMINI_TIMEOUT_MS = 300_000;
export const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.1-pro-preview"] as const;
export type GeminiModel = (typeof GEMINI_MODELS)[number];
export const GEMINI_BUNDLE_PINS: Readonly<Record<string, string>> = {
  "chunk-34MYV7JD.js": "019fd0819c9e85555d6a6fbe468a53f647955dca2b5d629c6a920ef9ca8de6de",
  "chunk-664ZODQF.js": "0e5e41b8af7ca2ddd1bc3509c7276559d48a99705d6716b6d45c4c64b4f9168c",
  "chunk-IUUIT4SU.js": "878469f1440495db8e40b033dde88ab96c0ee7d9e40c3deb4cee91dde1c8031a",
  "chunk-M6NSK26M.js": "5259439bfda18186b46bccf03916944c32c9dbfb532e01ff8b794e2e8e0afea3",
  "chunk-TUDYL3X4.js": "930edd0d6e5c5ce1a2ac6fd5b479072262d3c8e04b74b8edf51b0bf6444b846f",
};
const PACKAGE_ROOT = join(homedir(), ".local/lib/node_modules/@google/gemini-cli");
const ENDPOINT = "https://cloudcode-pa.googleapis.com/v1internal";
export type GeminiErrorCode = "pin-invalid" | "existing-login-required" | "transport-failed" | "deadline-exceeded" | "metadata-invalid" | "model-mismatch" | "unexpected-tool-call" | "request-invalid";
export interface GeminiUsage { inputTokens: number; outputTokens: number; reasoningTokens: number; cacheReadInputTokens: number }
export interface GeminiCompletion extends GeminiUsage { text: string; model: GeminiModel; modelVersion: string; finishReason: string }
export class GeminiAdapterError extends Error {
  readonly code: GeminiErrorCode;
  readonly usage?: GeminiUsage;
  constructor(code: GeminiErrorCode, usage?: GeminiUsage) {
    super(`Gemini adapter: ${code}`); this.name = "GeminiAdapterError"; this.code = code; this.usage = usage;
  }
}
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
const token = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new GeminiAdapterError("metadata-invalid");
  return value as number;
};
export function parseGeminiResponse(model: GeminiModel, response: unknown): GeminiCompletion {
  const body = object(response), nativeUsage = object(body.usageMetadata);
  const usage: GeminiUsage = {
    inputTokens: token(nativeUsage.promptTokenCount),
    outputTokens: token(nativeUsage.candidatesTokenCount) + token(nativeUsage.thoughtsTokenCount ?? 0),
    reasoningTokens: token(nativeUsage.thoughtsTokenCount ?? 0),
    cacheReadInputTokens: token(nativeUsage.cachedContentTokenCount ?? 0),
  };
  // Cache is part of prompt count. Preserve native accounting; never add it twice.
  if (usage.cacheReadInputTokens > usage.inputTokens || !Number.isSafeInteger(usage.outputTokens)) throw new GeminiAdapterError("metadata-invalid");
  if (body.modelVersion !== model) throw new GeminiAdapterError("model-mismatch", usage);
  if (!Array.isArray(body.candidates) || body.candidates.length !== 1) throw new GeminiAdapterError("metadata-invalid", usage);
  const candidate = object(body.candidates[0]);
  if (typeof candidate.finishReason !== "string" || !candidate.finishReason) throw new GeminiAdapterError("metadata-invalid", usage);
  const parts = object(candidate.content).parts;
  if (!Array.isArray(parts)) throw new GeminiAdapterError("metadata-invalid", usage);
  if (parts.some(part => object(part).functionCall !== undefined)) throw new GeminiAdapterError("unexpected-tool-call", usage);
  const text = parts.filter(part => object(part).thought !== true).map(part => {
    const p = object(part); return typeof p.text === "string" ? p.text : "";
  }).join("");
  return { ...usage, text, model, modelVersion: model, finishReason: candidate.finishReason };
}
export interface GeminiMessage { role: "system" | "user" | "assistant"; content: string }
export type GeminiRequest = { model: GeminiModel; maxOutputTokens: number } & (
  { prompt: string; messages?: never } | { messages: readonly GeminiMessage[]; prompt?: never }
);
export function validateGeminiRequest(value: GeminiRequest): void {
  if (!value || typeof value !== "object" || !GEMINI_MODELS.includes(value.model) ||
    !Number.isSafeInteger(value.maxOutputTokens) || value.maxOutputTokens < 1 || value.maxOutputTokens > 16_384 ||
    Object.hasOwn(value, "prompt") === Object.hasOwn(value, "messages")) throw new GeminiAdapterError("request-invalid");
  if (Object.hasOwn(value, "prompt")) {
    if (typeof value.prompt !== "string" || !value.prompt.trim() || Buffer.byteLength(value.prompt) > 250_000) throw new GeminiAdapterError("request-invalid");
  } else {
    if (!Array.isArray(value.messages) || !value.messages.length ||
      value.messages.some(message => !message || !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string") ||
      !value.messages.some(message => message.role !== "system" && message.content.trim()) ||
      Buffer.byteLength(JSON.stringify(value.messages)) > 250_000) throw new GeminiAdapterError("request-invalid");
  }
}
export function verifyGeminiPins(root = PACKAGE_ROOT): void {
  try {
    if (JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version !== GEMINI_CLI_VERSION) throw new Error();
    for (const [name, digest] of Object.entries(GEMINI_BUNDLE_PINS)) {
      if (createHash("sha256").update(readFileSync(join(root, "bundle", name))).digest("hex") !== digest) throw new Error();
    }
  } catch { throw new GeminiAdapterError("pin-invalid"); }
}
export function geminiPreflight() {
  let pinValid = false;
  try { verifyGeminiPins(); pinValid = true; } catch { /* Public boolean only. */ }
  return { cliVersion: GEMINI_CLI_VERSION, bundlePins: GEMINI_BUNDLE_PINS, pinValid,
    oauthFileExists: existsSync(join(homedir(), ".gemini/oauth_creds.json")),
    accountFileExists: existsSync(join(homedir(), ".gemini/google_accounts.json")),
    inferencePerformed: false };
}
export interface NativeAuthClient { request(options: ObjectValue): Promise<{ data: unknown }> }
export interface NativeServer {
  requestPost(method: string, req: unknown, signal?: AbortSignal): Promise<unknown>;
  loadCodeAssist(req: unknown): Promise<unknown>;
  generateContent(req: unknown, promptId: string): Promise<unknown>;
}
export interface GeminiRuntime {
  getOauthClient(authType: string, config: ObjectValue): Promise<NativeAuthClient>;
  CodeAssistServer: new (client: NativeAuthClient, project?: string, options?: ObjectValue, sessionId?: string) => NativeServer;
}
export function guardedPost(client: NativeAuthClient, signal: AbortSignal) {
  return async (method: string, req: unknown): Promise<unknown> => {
    if (!["loadCodeAssist", "generateContent"].includes(method)) throw new GeminiAdapterError("request-invalid");
    if (signal.aborted) throw new GeminiAdapterError("deadline-exceeded");
    const result = await client.request({ url: `${ENDPOINT}:${method}`, method: "POST",
      headers: { "Content-Type": "application/json" }, responseType: "json", body: JSON.stringify(req), signal,
      retry: false, retryConfig: { retry: 0, noResponseRetries: 0 } });
    return result.data;
  };
}
// Mockable core: no CLI Config initialization, factory, memory or tool registry.
export async function invokeGeminiRuntime(runtime: GeminiRuntime, request: GeminiRequest, signal: AbortSignal): Promise<GeminiCompletion> {
  validateGeminiRequest(request);
  if (signal.aborted) throw new GeminiAdapterError("deadline-exceeded");
  try {
    const client = await runtime.getOauthClient("oauth-personal", {
      getProxy: () => undefined, isInteractive: () => false, isBrowserLaunchSuppressed: () => true,
    });
    const send = guardedPost(client, signal);
    const setup = new runtime.CodeAssistServer(client);
    setup.requestPost = send;
    const tier = object(await setup.loadCodeAssist({ metadata: { ideType: "IDE_UNSPECIFIED", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" } }));
    const existingTier = object(tier.currentTier);
    if (typeof existingTier.id !== "string" || !existingTier.id || typeof tier.cloudaicompanionProject !== "string" || !tier.cloudaicompanionProject) throw new GeminiAdapterError("existing-login-required");
    const server = new runtime.CodeAssistServer(client, tier.cloudaicompanionProject, {}, randomUUID());
    server.requestPost = send;
    const messages: readonly GeminiMessage[] = request.messages ?? [{ role: "user", content: request.prompt! }];
    const system = messages.filter(message => message.role === "system").map(message => message.content).join("\n\n");
    const response = await server.generateContent({ model: request.model,
      contents: messages.filter(message => message.role !== "system").map(message => ({
        role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }],
      })),
      config: { tools: [], maxOutputTokens: request.maxOutputTokens, candidateCount: 1, abortSignal: signal,
        ...(system ? { systemInstruction: system } : {}) } }, randomUUID());
    const result = parseGeminiResponse(request.model, response);
    if (result.outputTokens > request.maxOutputTokens) throw new GeminiAdapterError("metadata-invalid", result);
    return result;
  } catch (error) {
    if (signal.aborted) throw new GeminiAdapterError("deadline-exceeded");
    if (error instanceof GeminiAdapterError) throw error;
    // Never forward auth URLs, identities, project IDs, headers or response bodies.
    throw new GeminiAdapterError("transport-failed");
  }
}
async function worker(request: GeminiRequest) {
  try {
    verifyGeminiPins();
    if (!geminiPreflight().oauthFileExists || !geminiPreflight().accountFileExists) throw new GeminiAdapterError("existing-login-required");
    const runtime = await import(pathToFileURL(join(PACKAGE_ROOT, "bundle/chunk-M6NSK26M.js")).href) as GeminiRuntime;
    const result = await invokeGeminiRuntime(runtime, request, AbortSignal.timeout(GEMINI_TIMEOUT_MS));
    process.send?.({ ok: true, result });
  } catch (error) {
    const safe = error instanceof GeminiAdapterError ? error : new GeminiAdapterError("transport-failed");
    process.send?.({ ok: false, code: safe.code, usage: safe.usage });
  } finally { process.disconnect?.(); }
}
export async function completeGeminiCodeAssist(request: GeminiRequest): Promise<GeminiCompletion> {
  validateGeminiRequest(request); verifyGeminiPins();
  // Empty environment prevents ADC, endpoint, proxy, debug and activity-log overrides.
  // Existing OAuth is loaded only by the SDK inside a disposable muted process.
  return new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), [], { cwd: "/tmp", env: { INSURANCE_BENCH_GEMINI_WORKER: "1" },
      execArgv: ["--experimental-strip-types"], stdio: ["ignore", "ignore", "ignore", "ipc"] });
    let done = false;
    const finish = (error?: GeminiAdapterError, result?: GeminiCompletion) => {
      if (done) return; done = true; clearTimeout(timer); child.kill("SIGKILL");
      if (error) reject(error); else resolve(result!);
    };
    const timer = setTimeout(() => finish(new GeminiAdapterError("deadline-exceeded")), GEMINI_TIMEOUT_MS);
    child.on("error", () => finish(new GeminiAdapterError("transport-failed")));
    child.on("exit", () => finish(new GeminiAdapterError("transport-failed")));
    child.on("message", message => {
      const m = object(message);
      if (m.ok === true) finish(undefined, m.result as GeminiCompletion);
      else finish(new GeminiAdapterError(typeof m.code === "string" ? m.code as GeminiErrorCode : "transport-failed", m.usage as GeminiUsage | undefined));
    });
    child.send(request);
  });
}
if (process.env.INSURANCE_BENCH_GEMINI_WORKER === "1") process.once("message", message => { void worker(message as GeminiRequest); });
