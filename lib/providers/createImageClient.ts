import OpenAI from "openai";
import { createOpenAIClientFromRequest } from "@/lib/apiKey/openaiClientFromRequest";
import type { ProviderConfig } from "@/lib/providers/providerTypes";

export type StudioImageClient = {
  client: OpenAI;
  imageModel?: string;
  providerLabel: string;
};

export function createImageClient(config: ProviderConfig): StudioImageClient {
  const provider = config.provider === "azure" ? "azure-openai" : config.provider === "openai" ? "openai-compatible" : config.provider;
  const imageModel =
    provider === "google-banana"
      ? config.googleBananaModel || config.imageModel || "banana-pro"
      : config.imageModel || config.azureDeployment || "gpt-image-2";

  const client = createOpenAIClientFromRequest({
    ...config,
    provider,
    imageModel,
  });

  return {
    client,
    imageModel,
    providerLabel:
      provider === "google-banana"
        ? "Google Banana"
        : provider === "azure-openai"
          ? "Azure OpenAI"
          : "OpenAI Compatible",
  };
}
