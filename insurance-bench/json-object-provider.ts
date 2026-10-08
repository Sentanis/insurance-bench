import {
  complete,
  defaultTransport,
  ProviderError,
  type Completion,
  type Message,
  type ModelConfig,
  type ProviderTransport,
} from "./investigation-providers.ts";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const BASE_KEYS = new Set(["model", "input", "max_output_tokens", "store", "reasoning"]);
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const instructed = (messages: unknown): messages is Message[] =>
  Array.isArray(messages) &&
  messages.some(
    (message: unknown) =>
      object(message) &&
      (message.role === "system" || message.role === "user") &&
      typeof message.content === "string" &&
      /\bJSON\b/.test(message.content),
  );
const reject = () =>
  new ProviderError("openai", "JSON-object transport contract rejected; details withheld");

/**
 * Prospective ablation only. Frozen Responses transport supplies deadline, credentials and metadata.
 * https://developers.openai.com/api/docs/guides/structured-outputs documents text.format.json_object:
 * valid JSON is not schema conformance; native truncation/refusal and existing parser guards remain.
 */
export function jsonObjectTransport(transport: ProviderTransport): ProviderTransport {
  return {
    ...transport,
    fetch: async (url, init) => {
      if (
        url !== RESPONSES_URL ||
        init?.method !== "POST" ||
        typeof init.body !== "string" ||
        !init.signal
      )
        throw reject();
      let body: unknown;
      try {
        body = JSON.parse(init.body);
      } catch {
        throw reject();
      }
      if (
        !object(body) ||
        Object.hasOwn(body, "text") ||
        Object.keys(body).some((key) => !BASE_KEYS.has(key)) ||
        typeof body.model !== "string" ||
        !body.model.trim() ||
        !instructed(body.input) ||
        !Number.isSafeInteger(body.max_output_tokens) ||
        (body.max_output_tokens as number) <= 0 ||
        body.store !== false ||
        (Object.hasOwn(body, "reasoning") &&
          (!object(body.reasoning) ||
            Object.keys(body.reasoning).some((key) => key !== "effort") ||
            typeof body.reasoning.effort !== "string"))
      )
        throw reject();
      // Only this added payload field differs; retain headers, signal, input, effort and output limit.
      return transport.fetch(url, {
        ...init,
        body: JSON.stringify({ ...body, text: { format: { type: "json_object" } } }),
      });
    },
  };
}

/** No request retry, response repair, alternative model or altered token/cost accounting. */
export async function completeJsonObject(
  config: ModelConfig,
  messages: Message[],
  maxOutputTokens: number,
  transport?: ProviderTransport,
): Promise<Completion> {
  // Reject before defaultTransport or inherited credential admission for unsupported paths/context.
  if (config.provider !== "openai")
    throw new ProviderError("openai", "JSON-object ablation supports OpenAI only");
  if (!instructed(messages))
    throw new ProviderError("openai", "JSON-object ablation requires an existing JSON instruction");
  return complete(config, messages, maxOutputTokens, jsonObjectTransport(transport ?? defaultTransport()));
}
