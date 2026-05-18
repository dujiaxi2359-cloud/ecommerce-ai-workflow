import OpenAI from "openai";
import type { UserApiKeyConfig } from "@/lib/apiKey/apiKeyTypes";

export function sanitizeApiKeyError(message: string, apiKey?: string) {
  return apiKey ? message.replaceAll(apiKey, "[API_KEY_HIDDEN]") : message;
}

export function createOpenAIClientFromRequest(
  config: UserApiKeyConfig,
  timeout = 300_000,
) {
  if (!config.apiKey?.trim()) {
    throw new Error("请先填写你自己的 OpenAI API Key。");
  }

  return new OpenAI({
    apiKey: config.apiKey.trim(),
    baseURL: config.baseURL?.trim() || undefined,
    timeout,
  });
}
