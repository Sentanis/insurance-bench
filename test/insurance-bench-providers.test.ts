import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { awsArguments, awsJson, complete, defaultTransport, effectiveReasoningEffort, PROVIDER_TIMEOUT_MS, requestJson, ProviderError, type Message, type ModelConfig, type ProviderTransport } from "../insurance-bench/providers.ts";
import { discoverBedrock, discoverOpenAI } from "../insurance-bench/provider-discovery.ts";

const messages: Message[] = [{ role: "system", content: "Use a JSON action." }, { role: "user", content: "Synthetic claim INS-BENCH-001." }];
function config(provider: ModelConfig["provider"]): ModelConfig {
  return { provider, model: "exact-model-id", inputUsdPerMillion: 1, outputUsdPerMillion: 2, profile: "bench-test", region: "us-east-1" };
}
function mockTransport(body: unknown, status = 200) {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const transport: ProviderTransport = {
    env: { OPENAI_API_KEY: "test-secret", ANTHROPIC_API_KEY: "test-secret", GEMINI_API_KEY: "test-secret", XAI_API_KEY: "test-secret" },
    fetch: (async (url: any, init?: RequestInit) => { requests.push({ url: String(url), init }); return new Response(JSON.stringify(body), { status, headers: { "x-request-id": "request-test-001" } }); }) as typeof fetch,
    aws: async () => { throw new Error("Unexpected AWS invocation"); },
  };
  return { transport, requests };
}

test("OpenAI Responses preserves model identity and counts reasoning-inclusive usage", async () => {
  const mock = mockTransport({ model: "returned-snapshot", status: "completed", usage: { input_tokens: 150, output_tokens: 80, output_tokens_details: { reasoning_tokens: 60 } }, output: [{ type: "reasoning", summary: [] }, { type: "message", content: [{ type: "output_text", text: '{"action":"finish"}' }] }] });
  const result = await complete(config("openai"), messages, 1000, mock.transport);
  assert.equal(result.text, '{"action":"finish"}');
  assert.equal(result.model, "returned-snapshot");
  assert.equal(result.outputTokens, 80);
  assert.equal(result.reasoningTokens, 60);
  assert.equal(result.requestId, "request-test-001");
  const payload = JSON.parse(String(mock.requests[0]!.init!.body));
  assert.equal(payload.model, "exact-model-id");
  assert.equal(payload.store, false);
  assert.equal(payload.max_output_tokens, 1000);
  assert.deepEqual(payload.input, messages);
  assert.ok(mock.requests[0]!.init!.signal instanceof AbortSignal);
});

test("GPT-6 uses explicit low reasoning and honors a configured effort", async () => {
  const mock = mockTransport({ model: "gpt-6.1-sol", status: "completed", usage: { input_tokens: 1, output_tokens: 2 }, output: [] });
  await complete({ ...config("openai"), model: "gpt-6.1-sol" }, messages, 4096, mock.transport);
  assert.deepEqual(JSON.parse(String(mock.requests[0]!.init!.body)).reasoning, { effort: "low" });
  await complete({ ...config("openai"), model: "gpt-6.1-sol", reasoningEffort: "medium" }, messages, 4096, mock.transport);
  assert.deepEqual(JSON.parse(String(mock.requests[1]!.init!.body)).reasoning, { effort: "medium" });
});

test("matched effort settings use the identical model and output cap", async () => {
  const mock = mockTransport({ model: "gpt-6.1-sol", status: "completed", reasoning: { effort: "high" }, usage: { input_tokens: 1, output_tokens: 2 }, output: [] });
  const high = await complete({ ...config("openai"), model: "gpt-6.1-sol", reasoningEffort: "high" }, messages, 8192, mock.transport);
  assert.equal(high.reasoningEffort, "high");
  const payload = JSON.parse(String(mock.requests[0]!.init!.body));
  assert.equal(payload.model, "gpt-6.1-sol");
  assert.equal(payload.max_output_tokens, 8192);
  assert.deepEqual(payload.reasoning, { effort: "high" });
});

test("unsupported efforts fail before inference and never silently fall back", async () => {
  const mock = mockTransport({});
  for (const effort of ["none", "minimal"] as const) await assert.rejects(complete({ ...config("openai"), model: "gpt-6.1-sol", reasoningEffort: effort }, messages, 8192, mock.transport), /unsupported by the exact model/);
  await assert.rejects(complete({ ...config("openai"), model: "gpt-5.4-nano", reasoningEffort: "max" }, messages, 8192, mock.transport), /unsupported by the exact model/);
  await assert.rejects(complete({ ...config("bedrock"), reasoningEffort: "high" }, messages, 8192, mock.transport), /not implemented/);
  assert.equal(effectiveReasoningEffort({ ...config("openai"), model: "gpt-6-luna", reasoningEffort: "none" }), "none");
  assert.equal(effectiveReasoningEffort({ ...config("openai"), model: "gpt-6.1-sol", reasoningEffort: "max" }), "max");
  assert.equal(mock.requests.length, 0);
});

test("provider effort mismatch is unavailable rather than substituted", async () => {
  const mock = mockTransport({ model: "gpt-6.1-sol", status: "completed", reasoning: { effort: "low" }, usage: { input_tokens: 1, output_tokens: 2 }, output: [] });
  await assert.rejects(complete({ ...config("openai"), model: "gpt-6.1-sol", reasoningEffort: "high" }, messages, 8192, mock.transport), /changed the requested reasoning effort/);
  assert.equal(mock.requests.length, 1);
});

test("model configurations preserve the original alias and exact matched identities", () => {
  const models: Record<string, ModelConfig> = JSON.parse(readFileSync(new URL("../insurance-bench/models.json", import.meta.url), "utf8"));
  for (const stem of ["gpt-6.1-sol", "gpt-6-luna"]) {
    const low = models[`${stem}-low`]!, high = models[`${stem}-high`]!;
    assert.equal(low.model, high.model);
    assert.equal(low.inputUsdPerMillion, high.inputUsdPerMillion);
    assert.equal(low.outputUsdPerMillion, high.outputUsdPerMillion);
    assert.equal(low.reasoningEffort, "low");
    assert.equal(high.reasoningEffort, "high");
    assert.ok(low.pricingSource?.startsWith("https://developers.openai.com/"));
  }
  assert.equal(models["gpt-6.1-sol"]!.model, models["gpt-6.1-sol-low"]!.model);
  assert.equal(models["gpt-6.1-sol"]!.reasoningEffort, "low");
  assert.notEqual(models["qwen3-32b"]!.model, models["qwen3-235b"]!.model);
  assert.equal(models["qwen3-32b"]!.region, models["qwen3-235b"]!.region);
});

test("Anthropic separates system prompt and includes cache input usage", async () => {
  const mock = mockTransport({ model: "claude-snapshot", stop_reason: "end_turn", content: [{ type: "thinking", thinking: "private" }, { type: "text", text: "action" }], usage: { input_tokens: 10, output_tokens: 12, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 } });
  const result = await complete(config("anthropic"), messages, 256, mock.transport);
  assert.equal(result.text, "action");
  assert.equal(result.inputTokens, 17);
  const payload = JSON.parse(String(mock.requests[0]!.init!.body));
  assert.equal(payload.system, messages[0]!.content);
  assert.deepEqual(payload.messages, [messages[1]]);
});

test("Gemini includes billed thought tokens but excludes thought text", async () => {
  const mock = mockTransport({ modelVersion: "gemini-snapshot", usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 30 }, candidates: [{ finishReason: "STOP", content: { parts: [{ thought: true, text: "hidden" }, { text: "action" }] } }] });
  const conversation: Message[] = [...messages, { role: "assistant", content: "previous action" }, { role: "user", content: "tool result" }];
  const result = await complete(config("gemini"), conversation, 1024, mock.transport);
  assert.equal(result.outputTokens, 35);
  assert.equal(result.text, "action");
  const payload = JSON.parse(String(mock.requests[0]!.init!.body));
  assert.equal(payload.contents[1].role, "model");
  assert.equal(payload.systemInstruction.parts[0].text, messages[0]!.content);
  assert.ok(!mock.requests[0]!.url.includes("test-secret"));
});

test("xAI uses its own endpoint and exact model; no cross-provider substitution", async () => {
  const mock = mockTransport({ model: "grok-snapshot", choices: [{ message: { content: "action" }, finish_reason: "stop" }], usage: { prompt_tokens: 20, completion_tokens: 40 } });
  const result = await complete(config("xai"), messages, 512, mock.transport);
  assert.equal(result.model, "grok-snapshot");
  assert.equal(mock.requests[0]!.url, "https://api.x.ai/v1/chat/completions");
  assert.equal(JSON.parse(String(mock.requests[0]!.init!.body)).model, "exact-model-id");
});

test("Bedrock keeps prompt as an argument, explicit scope, and exact inference profile", async () => {
  const mock = mockTransport({});
  let args: string[] = [];
  mock.transport.aws = async (input) => { args = input; return JSON.stringify({ output: { message: { content: [{ text: "action" }] } }, usage: { inputTokens: 3, outputTokens: 7 }, stopReason: "end_turn" }); };
  const prompt: Message[] = [{ role: "user", content: "$(touch /tmp/never-executed) `secret`" }];
  const result = await complete(config("bedrock"), prompt, 100, mock.transport);
  assert.equal(result.model, "exact-model-id");
  assert.deepEqual(args.slice(0, 2), ["bedrock-runtime", "converse"]);
  assert.equal(args[args.indexOf("--profile") + 1], "bench-test");
  assert.equal(args[args.indexOf("--region") + 1], "us-east-1");
  const payload = JSON.parse(args[args.indexOf("--cli-input-json") + 1]!);
  assert.equal(payload.messages[0].content[0].text, prompt[0]!.content);
  assert.equal(payload.inferenceConfig.maxTokens, 100);
  assert.equal(mock.requests.length, 0);
});

test("credentials, profile/region, pricing and message order fail before inference", async () => {
  const mock = mockTransport({});
  mock.transport.env = {};
  await assert.rejects(complete(config("openai"), messages, 100, mock.transport), /missing OPENAI_API_KEY/);
  await assert.rejects(complete({ ...config("bedrock"), profile: undefined }, messages, 100, mock.transport), /explicit AWS profile/);
  await assert.rejects(complete({ ...config("openai"), inputUsdPerMillion: NaN }, messages, 100, mock.transport), /finite and nonnegative/);
  await assert.rejects(complete(config("openai"), [...messages, { role: "system", content: "late" }], 100, mock.transport), /must precede/);
  await assert.rejects(complete(config("openai"), messages, 0, mock.transport), /positive integer/);
  assert.equal(mock.requests.length, 0);
});

test("HTTP/AWS failures withhold payloads and never retry", async () => {
  const mock = mockTransport({ error: "test-secret Synthetic claim content" }, 403);
  await assert.rejects(complete(config("openai"), messages, 100, mock.transport), (error: Error) => { assert.match(error.message, /HTTP 403/); assert.ok(!error.message.includes("test-secret")); assert.ok(!error.message.includes("Synthetic claim")); return true; });
  assert.equal(mock.requests.length, 1);
  mock.transport.aws = async () => { throw new Error("test-secret Synthetic claim content"); };
  await assert.rejects(complete(config("bedrock"), messages, 100, mock.transport), (error: Error) => { assert.match(error.message, /AWS request failed/); assert.ok(!error.message.includes("test-secret")); return true; });
});

test("Bedrock exposes only allow-listed exception classes", async () => {
  const mock = mockTransport({});
  for (const classification of ["AccessDeniedException", "ValidationException", "ResourceNotFoundException", "ThrottlingException", "ModelNotReadyException", "ExpiredTokenException"]) {
    mock.transport.aws = async () => { throw Object.assign(new Error("secret prompt"), { stderr: `aws: [ERROR]: An error occurred (${classification}) when calling the Converse operation: secret prompt` }); };
    await assert.rejects(complete(config("bedrock"), messages, 100, mock.transport), (error: unknown) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.classification, classification);
      assert.ok(!error.message.includes("secret prompt"));
      assert.ok(!("stderr" in error));
      return true;
    });
  }
  mock.transport.aws = async () => { throw Object.assign(new Error("secret"), { stderr: "An error occurred (UnrecognizedSecret) when calling the Converse operation: secret" }); };
  await assert.rejects(complete(config("bedrock"), messages, 100, mock.transport), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.classification, undefined);
    assert.ok(!error.message.includes("UnrecognizedSecret"));
    return true;
  });
});

test("Bedrock reconciles cached inputs and safe metadata request IDs", async () => {
  const mock = mockTransport({});
  mock.transport.aws = async () => JSON.stringify({ output: { message: { content: [{ reasoningContent: { reasoningText: { text: "hidden" } } }, { text: "action" }] } }, usage: { inputTokens: 10, outputTokens: 20, cacheReadInputTokens: 100, cacheWriteInputTokens: 200 }, ResponseMetadata: { RequestId: "00000000-1111-2222-3333-444444444444" } });
  const result = await complete(config("bedrock"), messages, 100, mock.transport);
  assert.equal(result.inputTokens, 310);
  assert.equal(result.outputTokens, 20);
  assert.equal(result.cacheReadInputTokens, 100);
  assert.equal(result.cacheWriteInputTokens, 200);
  assert.equal(result.requestId, "00000000-1111-2222-3333-444444444444");
  assert.equal(result.text, "action");
});

test("missing model or usage fails instead of silently recording zero cost", async () => {
  const mock = mockTransport({ model: "snapshot", status: "completed", output: [] });
  await assert.rejects(complete(config("openai"), messages, 100, mock.transport), /cost cannot be reconciled/);
  const wrongModel = mockTransport({ usage: { input_tokens: 1, output_tokens: 2 }, output: [] });
  await assert.rejects(complete(config("openai"), messages, 100, wrongModel.transport), /model identity/);
});

test("OpenAI discovery lists IDs without sending task content", async () => {
  const mock = mockTransport({ data: [{ id: "gpt-b" }, { id: "gpt-a" }, { id: "gpt-a" }] });
  assert.deepEqual(await discoverOpenAI(mock.transport), ["gpt-a", "gpt-b"]);
  assert.equal(mock.requests[0]!.init!.body, undefined);
  assert.equal(mock.requests[0]!.url, "https://api.openai.com/v1/models");
});

test("Bedrock discovery retains model/profile access context without inference", async () => {
  const mock = mockTransport({});
  const commands: string[][] = [];
  mock.transport.aws = async (args) => {
    commands.push(args);
    return JSON.stringify(args[1] === "list-foundation-models" ? { modelSummaries: [{ modelId: "provider.model-v1", providerName: "Provider", modelLifecycle: { status: "ACTIVE" }, inputModalities: ["TEXT"], outputModalities: ["TEXT"], inferenceTypesSupported: ["ON_DEMAND"] }] } : { inferenceProfileSummaries: [{ inferenceProfileId: "us.provider.model-v1", models: [{ modelArn: "arn:aws:bedrock:us-east-1::foundation-model/provider.model-v1" }] }] });
  };
  const result = await discoverBedrock("bench-test", "us-east-1", mock.transport);
  assert.equal(result.foundationModels[0]!.status, "ACTIVE");
  assert.equal(result.inferenceProfiles[0]!.inferenceProfileId, "us.provider.model-v1");
  assert.equal(commands.length, 2);
  assert.ok(commands.every((args) => args[0] === "bedrock" && args.includes("bench-test") && args.includes("us-east-1")));
  assert.equal(mock.requests.length, 0);
});

test("default transport constructs without accessing credentials or calling providers", () => {
  const transport = defaultTransport();
  assert.equal(typeof transport.fetch, "function");
  assert.equal(typeof transport.aws, "function");
});

test("all provider transports share the 300-second deadline with bounded AWS socket timeouts", async (t) => {
  assert.equal(PROVIDER_TIMEOUT_MS, 300_000);
  const args = awsArguments("bench-test", "us-east-1");
  assert.equal(args[args.indexOf("--cli-connect-timeout") + 1], "10");
  assert.equal(args[args.indexOf("--cli-read-timeout") + 1], "295");
  const mock = mockTransport({});
  mock.transport.aws = async () => { throw { killed: true, stderr: "private provider output must not escape" }; };
  await assert.rejects(awsJson(args, mock.transport), /request exceeded 300 seconds; billing status uncertain/);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  mock.transport.fetch = ((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("private transport detail")), { once: true });
  })) as typeof fetch;
  for (const provider of ["openai", "anthropic", "gemini", "xai"]) {
    const request = requestJson(provider, "https://mock.invalid", {}, mock.transport);
    const rejection = assert.rejects(request, new RegExp(`Insurance Bench ${provider}: request exceeded 300 seconds`));
    t.mock.timers.tick(300_000);
    await rejection;
  }
});
