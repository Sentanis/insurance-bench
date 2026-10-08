import { execFile } from "node:child_process";
import { promisify } from "node:util";

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export interface ModelConfig {
  provider: "openai" | "bedrock" | "anthropic" | "gemini" | "xai";
  model: string;
  region?: string;
  profile?: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  reasoningEffort?: ReasoningEffort;
  pricingSource?: string;
  pricingVerifiedAt?: string;
}
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface Completion {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  requestId?: string;
  finishReason?: string;
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
  reasoningEffort?: ReasoningEffort;
  reasoningTokens?: number;
}

const EFFORT_VALUES: readonly ReasoningEffort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];
/** Known support from official model pages; unknown models are validated by the API.
 * Explicit unsupported settings fail; they are never changed or ignored. */
export function effectiveReasoningEffort(config: ModelConfig): ReasoningEffort | undefined {
  if (config.reasoningEffort !== undefined && !EFFORT_VALUES.includes(config.reasoningEffort)) {
    throw new ProviderError(config.provider, "unsupported reasoning effort value");
  }
  if (config.provider !== "openai") {
    if (config.reasoningEffort !== undefined)
      throw new ProviderError(
        config.provider,
        "reasoning effort is not implemented for this adapter",
      );
    return undefined;
  }
  const effort =
    config.reasoningEffort ?? (/^gpt-6(?:\.|-)/.test(config.model) ? "low" : undefined);
  if (effort === undefined) return undefined;
  const supported: readonly ReasoningEffort[] | undefined =
    /^(?:gpt-6\.1-sol|gpt-6-astra)(?:$|-\d)/.test(config.model)
      ? ["low", "medium", "high", "xhigh", "max"]
      : /^(?:gpt-6-sol|gpt-6-luna)(?:$|-\d)/.test(config.model)
        ? ["none", "low", "medium", "high", "xhigh", "max"]
        : /^gpt-5\.4-(?:nano|mini)(?:$|-\d)/.test(config.model)
          ? ["none", "low", "medium", "high", "xhigh"]
          : undefined;
  if (supported && !supported.includes(effort))
    throw new ProviderError(
      "openai",
      "requested reasoning effort is unsupported by the exact model",
    );
  return effort;
}

export const PROVIDER_TIMEOUT_MS = 300_000;
const PROVIDER_TIMEOUT_SECONDS = PROVIDER_TIMEOUT_MS / 1000;
const execFileAsync = promisify(execFile);
export interface ProviderTransport {
  fetch: typeof globalThis.fetch;
  aws: (args: string[]) => Promise<string>;
  env: NodeJS.ProcessEnv;
}
export function defaultTransport(): ProviderTransport {
  return {
    fetch: globalThis.fetch,
    env: process.env,
    aws: async (args) => {
      // Fixed executable and argument array: prompts/model IDs are never shell code.
      const { stdout } = await execFileAsync("aws", args, {
        timeout: PROVIDER_TIMEOUT_MS,
        killSignal: "SIGKILL",
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, AWS_PAGER: "", AWS_MAX_ATTEMPTS: "1" },
      });
      return stdout;
    },
  };
}

export type AwsErrorClassification =
  | "AccessDeniedException"
  | "ValidationException"
  | "ResourceNotFoundException"
  | "ThrottlingException"
  | "ModelNotReadyException"
  | "ExpiredTokenException";
const AWS_ERROR_CLASSES: readonly AwsErrorClassification[] = [
  "AccessDeniedException",
  "ValidationException",
  "ResourceNotFoundException",
  "ThrottlingException",
  "ModelNotReadyException",
  "ExpiredTokenException",
];
export class ProviderError extends Error {
  constructor(
    provider: string,
    reason: string,
    readonly classification?: AwsErrorClassification,
  ) {
    super(`Insurance Bench ${provider}: ${reason}`);
    this.name = "ProviderError";
  }
}
export function requireKey(provider: string, name: string, transport: ProviderTransport): string {
  const key = transport.env[name]?.trim();
  if (!key) throw new ProviderError(provider, `missing ${name}`);
  return key;
}
export function awsArguments(profile: string, region: string): string[] {
  if (!profile?.trim() || !region?.trim()) {
    throw new ProviderError("bedrock", "an explicit AWS profile and region are required");
  }
  return [
    "--profile",
    profile,
    "--region",
    region,
    "--output",
    "json",
    "--no-cli-pager",
    "--cli-connect-timeout",
    "10",
    "--cli-read-timeout",
    String(PROVIDER_TIMEOUT_SECONDS - 5),
  ];
}
export async function awsJson(args: string[], transport: ProviderTransport): Promise<any> {
  try {
    return JSON.parse(await transport.aws(args));
  } catch (error) {
    // Inspect stderr only in memory. Only a known AWS exception class can escape;
    // CLI messages, prompts, credentials and the original error are discarded.
    const stderr =
      error && typeof error === "object" && "stderr" in error ? error.stderr : undefined;
    const raw =
      typeof stderr === "string" ? stderr : Buffer.isBuffer(stderr) ? stderr.toString("utf8") : "";
    if (error && typeof error === "object" && "killed" in error && error.killed === true) {
      throw new ProviderError("bedrock", `request exceeded ${PROVIDER_TIMEOUT_SECONDS} seconds; billing status uncertain`);
    }
    const match = /An error occurred \(([^)]+)\) when calling /.exec(raw);
    const classification = AWS_ERROR_CLASSES.find((known) => known === match?.[1]);
    throw new ProviderError(
      "bedrock",
      classification
        ? `AWS request failed (${classification}); response details withheld`
        : "AWS request failed or returned invalid JSON; inspect credentials/model access separately",
      classification,
    );
  }
}
export async function requestJson(
  provider: string,
  url: string,
  init: RequestInit,
  transport: ProviderTransport,
): Promise<{ body: any; requestId?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await transport.fetch(url, { ...init, signal: controller.signal });
    if (!response.ok)
      throw new ProviderError(provider, `HTTP ${response.status}; response body withheld`);
    const body = await response.json();
    const requestId =
      response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined;
    return { body, requestId };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      provider,
      controller.signal.aborted
        ? `request exceeded ${PROVIDER_TIMEOUT_SECONDS} seconds`
        : "request failed or returned invalid JSON; details withheld",
    );
  } finally {
    clearTimeout(timer);
  }
}
function tokens(provider: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ProviderError(
      provider,
      "response omitted valid token usage; cost cannot be reconciled",
    );
  }
  return value;
}
function textContent(parts: any): string {
  return Array.isArray(parts)
    ? parts
        .filter((part: any) => typeof part?.text === "string")
        .map((part: any) => part.text)
        .join("")
    : "";
}
function modelId(provider: string, value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    throw new ProviderError(provider, "response omitted model identity");
  return value;
}
function metadataRequestId(body: any): string | undefined {
  const value = body?.ResponseMetadata?.RequestId ?? body?.$metadata?.requestId;
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : undefined;
}
function validate(config: ModelConfig, messages: Message[], maxOutputTokens: number): void {
  if (!["openai", "bedrock", "anthropic", "gemini", "xai"].includes(config.provider))
    throw new ProviderError("configuration", "unsupported provider");
  if (!config.model?.trim()) throw new ProviderError(config.provider, "explicit model ID required");
  effectiveReasoningEffort(config);
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1)
    throw new ProviderError(config.provider, "maxOutputTokens must be a positive integer");
  for (const price of [config.inputUsdPerMillion, config.outputUsdPerMillion]) {
    if (!Number.isFinite(price) || price < 0)
      throw new ProviderError(config.provider, "token prices must be finite and nonnegative");
  }
  if (!messages.length || !messages.some((message) => message.role === "user"))
    throw new ProviderError(config.provider, "a user message is required");
  let conversationStarted = false;
  for (const message of messages) {
    if (
      !["system", "user", "assistant"].includes(message.role) ||
      typeof message.content !== "string"
    )
      throw new ProviderError(config.provider, "invalid message");
    if (message.role === "system" && conversationStarted)
      throw new ProviderError(config.provider, "system messages must precede the conversation");
    if (message.role !== "system") conversationStarted = true;
  }
}

/** No retry or model fallback: a failed call stays a failed call in the benchmark. */
export async function complete(
  config: ModelConfig,
  messages: Message[],
  maxOutputTokens: number,
  transport: ProviderTransport = defaultTransport(),
): Promise<Completion> {
  validate(config, messages, maxOutputTokens);
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const conversation = messages.filter((message) => message.role !== "system");
  if (config.provider === "bedrock") {
    const args = awsArguments(config.profile!, config.region!);
    const payload = {
      modelId: config.model,
      ...(system ? { system: [{ text: system }] } : {}),
      messages: conversation.map((message) => ({
        role: message.role,
        content: [{ text: message.content }],
      })),
      inferenceConfig: { maxTokens: maxOutputTokens },
    };
    const body = await awsJson(
      ["bedrock-runtime", "converse", ...args, "--cli-input-json", JSON.stringify(payload)],
      transport,
    );
    const cacheReadInputTokens = tokens("bedrock", body.usage?.cacheReadInputTokens ?? 0);
    const cacheWriteInputTokens = tokens("bedrock", body.usage?.cacheWriteInputTokens ?? 0);
    return {
      text: textContent(body.output?.message?.content),
      inputTokens:
        tokens(config.provider, body.usage?.inputTokens) +
        cacheReadInputTokens +
        cacheWriteInputTokens,
      outputTokens: tokens(config.provider, body.usage?.outputTokens),
      // Converse does not return model ID. This is the exact requested model/profile.
      model: config.model,
      requestId: metadataRequestId(body),
      finishReason: body.stopReason,
      cacheReadInputTokens,
      cacheWriteInputTokens,
    };
  }
  if (config.provider === "openai") {
    const key = requireKey("openai", "OPENAI_API_KEY", transport);
    // The API ceiling includes hidden reasoning; it cannot guarantee visible tokens.
    // Record effort and truncation without silently retrying another setting.
    const reasoningEffort = effectiveReasoningEffort(config);
    const { body, requestId } = await requestJson(
      "openai",
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          input: messages,
          max_output_tokens: maxOutputTokens,
          store: false,
          ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
        }),
      },
      transport,
    );
    const output = Array.isArray(body.output)
      ? body.output
          .filter((item: any) => item?.type === "message")
          .flatMap((item: any) => item.content ?? [])
          .filter((part: any) => part?.type === "output_text")
      : [];
    if (
      reasoningEffort &&
      body.reasoning?.effort !== undefined &&
      body.reasoning.effort !== reasoningEffort
    ) {
      throw new ProviderError(
        "openai",
        "provider changed the requested reasoning effort; details withheld",
      );
    }
    return {
      text: textContent(output),
      inputTokens: tokens("openai", body.usage?.input_tokens),
      outputTokens: tokens("openai", body.usage?.output_tokens),
      model: modelId("openai", body.model),
      requestId,
      finishReason: body.incomplete_details?.reason ?? body.status,
      reasoningEffort,
      reasoningTokens:
        body.usage?.output_tokens_details?.reasoning_tokens === undefined
          ? undefined
          : tokens("openai", body.usage.output_tokens_details.reasoning_tokens),
    };
  }
  if (config.provider === "anthropic") {
    const key = requireKey("anthropic", "ANTHROPIC_API_KEY", transport);
    const { body, requestId } = await requestJson(
      "anthropic",
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          ...(system ? { system } : {}),
          messages: conversation,
          max_tokens: maxOutputTokens,
        }),
      },
      transport,
    );
    // Include cache tokens in input usage so callers never silently undercount input.
    return {
      text: textContent(body.content?.filter((part: any) => part?.type === "text")),
      inputTokens:
        tokens("anthropic", body.usage?.input_tokens) +
        tokens("anthropic", body.usage?.cache_creation_input_tokens ?? 0) +
        tokens("anthropic", body.usage?.cache_read_input_tokens ?? 0),
      outputTokens: tokens("anthropic", body.usage?.output_tokens),
      model: modelId("anthropic", body.model),
      requestId,
      finishReason: body.stop_reason,
    };
  }
  if (config.provider === "gemini") {
    const key = requireKey("gemini", "GEMINI_API_KEY", transport);
    const name = config.model.replace(/^models\//, "");
    const { body, requestId } = await requestJson(
      "gemini",
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(name)}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents: conversation.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: { maxOutputTokens },
        }),
      },
      transport,
    );
    return {
      text: textContent(
        body.candidates?.[0]?.content?.parts?.filter((part: any) => !part?.thought),
      ),
      inputTokens: tokens("gemini", body.usageMetadata?.promptTokenCount),
      outputTokens:
        tokens("gemini", body.usageMetadata?.candidatesTokenCount ?? 0) +
        tokens("gemini", body.usageMetadata?.thoughtsTokenCount ?? 0),
      model: modelId("gemini", body.modelVersion),
      requestId,
      finishReason: body.candidates?.[0]?.finishReason ?? body.promptFeedback?.blockReason,
    };
  }
  const key = requireKey("xai", "XAI_API_KEY", transport);
  const { body, requestId } = await requestJson(
    "xai",
    "https://api.x.ai/v1/chat/completions",
    {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: maxOutputTokens,
        stream: false,
      }),
    },
    transport,
  );
  return {
    text:
      typeof body.choices?.[0]?.message?.content === "string"
        ? body.choices[0].message.content
        : "",
    inputTokens: tokens("xai", body.usage?.prompt_tokens),
    outputTokens: tokens("xai", body.usage?.completion_tokens),
    model: modelId("xai", body.model),
    requestId,
    finishReason: body.choices?.[0]?.finish_reason,
  };
}
