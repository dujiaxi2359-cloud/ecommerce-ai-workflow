import OpenAI, { AzureOpenAI } from "openai";
import type { UserApiKeyConfig } from "@/lib/apiKey/apiKeyTypes";
import {
  azureOpenAIApiVersion,
  azureOpenAIDeployment,
  azureOpenAIEndpoint,
} from "@/lib/openai";

type AzureConnection = {
  endpoint: string;
  deployment: string;
  apiVersion: string;
};

export function sanitizeApiKeyError(message: string, apiKey?: string) {
  return apiKey ? message.replaceAll(apiKey, "[API_KEY_HIDDEN]") : message;
}

function looksLikeOpenAIKey(apiKey: string) {
  return /^sk-/i.test(apiKey.trim());
}

function cleanOptionalBaseURL(value?: string) {
  const trimmed = value?.trim() || "";
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return "";
  return trimmed.replace(/\/$/, "");
}

function parseAzureConnection(baseURL?: string): AzureConnection | null {
  const cleaned = cleanOptionalBaseURL(baseURL);
  if (!cleaned || !cleaned.includes("cognitiveservices.azure.com")) return null;

  try {
    const url = new URL(cleaned);
    const deploymentFromPath = url.pathname.match(/\/deployments\/([^/]+)/)?.[1];
    const endpointPath = url.pathname.split("/openai/")[0] || "";
    const endpoint = `${url.origin}${endpointPath}`.replace(/\/?$/, "/");

    return {
      endpoint,
      deployment: deploymentFromPath || azureOpenAIDeployment,
      apiVersion: url.searchParams.get("api-version") || azureOpenAIApiVersion,
    };
  } catch {
    return null;
  }
}

function createAzureClient(apiKey: string, connection: AzureConnection, timeout: number) {
  return new AzureOpenAI({
    endpoint: connection.endpoint,
    apiKey,
    apiVersion: connection.apiVersion,
    deployment: connection.deployment,
    timeout,
  });
}

export function createOpenAIClientFromRequest(
  config: UserApiKeyConfig,
  timeout = 300_000,
) {
  const apiKey = config.apiKey?.trim() || "";
  if (!apiKey) {
    throw new Error("请先填写你的 OpenAI 或 Azure OpenAI API Key。");
  }

  const azureFromBaseURL = parseAzureConnection(config.baseURL);
  if (azureFromBaseURL) {
    return createAzureClient(apiKey, azureFromBaseURL, timeout);
  }

  if (!looksLikeOpenAIKey(apiKey)) {
    if (azureOpenAIEndpoint) {
      return createAzureClient(
        apiKey,
        {
          endpoint: azureOpenAIEndpoint,
          deployment: azureOpenAIDeployment,
          apiVersion: azureOpenAIApiVersion,
        },
        timeout,
      );
    }

    throw new Error(
      "检测到你填写的是 Azure OpenAI 密钥，但服务器还没有配置 AZURE_OPENAI_ENDPOINT。请先在服务器 .env.local 配置 Azure 终结点和部署名。",
    );
  }

  return new OpenAI({
    apiKey,
    baseURL: cleanOptionalBaseURL(config.baseURL) || undefined,
    timeout,
  });
}
