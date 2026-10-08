import {
  awsArguments,
  awsJson,
  defaultTransport,
  ProviderError,
  requestJson,
  requireKey,
  type ProviderTransport,
} from "./providers.ts";

/** Model listing is read-only; visibility does not prove inference access or pricing. */
export async function discoverOpenAI(
  transport: ProviderTransport = defaultTransport(),
): Promise<string[]> {
  const key = requireKey("openai", "OPENAI_API_KEY", transport);
  const { body } = await requestJson(
    "openai",
    "https://api.openai.com/v1/models",
    { headers: { authorization: `Bearer ${key}` } },
    transport,
  );
  if (!Array.isArray(body.data) || body.data.some((model: any) => typeof model?.id !== "string"))
    throw new ProviderError("openai", "invalid model listing");
  return [...new Set<string>(body.data.map((model: any) => model.id))].sort();
}
export interface BedrockDiscovery {
  profile: string;
  region: string;
  foundationModels: Array<{
    modelId: string;
    modelName?: string;
    providerName?: string;
    inputModalities: string[];
    outputModalities: string[];
    inferenceTypesSupported: string[];
    status?: string;
  }>;
  inferenceProfiles: Array<{
    inferenceProfileId: string;
    inferenceProfileArn?: string;
    inferenceProfileName?: string;
    status?: string;
    type?: string;
    modelArns: string[];
  }>;
}
export async function discoverBedrock(
  profile: string,
  region: string,
  transport: ProviderTransport = defaultTransport(),
): Promise<BedrockDiscovery> {
  const args = awsArguments(profile, region);
  const [foundation, profiles] = await Promise.all([
    awsJson(["bedrock", "list-foundation-models", ...args], transport),
    awsJson(["bedrock", "list-inference-profiles", ...args], transport),
  ]);
  if (
    !Array.isArray(foundation.modelSummaries) ||
    !Array.isArray(profiles.inferenceProfileSummaries)
  )
    throw new ProviderError("bedrock", "invalid model listing");
  if (
    foundation.modelSummaries.some((model: any) => typeof model?.modelId !== "string") ||
    profiles.inferenceProfileSummaries.some(
      (model: any) => typeof model?.inferenceProfileId !== "string",
    )
  )
    throw new ProviderError("bedrock", "invalid model identity in listing");
  return {
    profile,
    region,
    foundationModels: foundation.modelSummaries.map((model: any) => ({
      modelId: model.modelId,
      modelName: model.modelName,
      providerName: model.providerName,
      inputModalities: model.inputModalities ?? [],
      outputModalities: model.outputModalities ?? [],
      inferenceTypesSupported: model.inferenceTypesSupported ?? [],
      status: model.modelLifecycle?.status,
    })),
    inferenceProfiles: profiles.inferenceProfileSummaries.map((model: any) => ({
      inferenceProfileId: model.inferenceProfileId,
      inferenceProfileArn: model.inferenceProfileArn,
      inferenceProfileName: model.inferenceProfileName,
      status: model.status,
      type: model.type,
      modelArns: (model.models ?? []).map((entry: any) => entry.modelArn),
    })),
  };
}
