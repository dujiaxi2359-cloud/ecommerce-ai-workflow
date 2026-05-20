import OpenAI, { AzureOpenAI } from "openai";
import type { UserApiKeyConfig } from "@/lib/apiKey/apiKeyTypes";

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

function parseAzureConnection(
  endpointOrFullUrl?: string,
  deployment?: string,
  apiVersion?: string,
): AzureConnection | null {
  const cleaned = cleanOptionalBaseURL(endpointOrFullUrl);
  if (!cleaned || !cleaned.includes("cognitiveservices.azure.com")) return null;

  try {
    const url = new URL(cleaned);
    const deploymentFromPath = url.pathname.match(/\/deployments\/([^/]+)/)?.[1];
    const endpointPath = url.pathname.split("/openai/")[0] || "";
    const endpoint = `${url.origin}${endpointPath}`.replace(/\/?$/, "/");

    return {
      endpoint,
      deployment: deploymentFromPath || deployment?.trim() || "",
      apiVersion: url.searchParams.get("api-version") || apiVersion?.trim() || "2025-04-01-preview",
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
  const provider = config.provider || "azure";
  const apiKey = config.apiKey?.trim() || "";
  if (!apiKey) {
    throw new Error("请先填写客户自己的 API Key。");
  }

  if (provider === "azure") {
    const azureConnection =
      parseAzureConnection(config.azureEndpoint, config.azureDeployment, config.azureApiVersion) ||
      parseAzureConnection(config.baseURL, config.azureDeployment, config.azureApiVersion);

    if (!azureConnection?.endpoint || !azureConnection.deployment) {
      throw new Error(
        "客户 Azure 模式需要填写 Azure Endpoint 和 Deployment。Endpoint 可以填资源地址，也可以填完整 images/generations 终结点。",
      );
    }

    return createAzureClient(apiKey, azureConnection, timeout);
  }

  if (!looksLikeOpenAIKey(apiKey)) {
    throw new Error(
      "普通 OpenAI 模式需要填写 sk- 开头的 OpenAI API Key。Azure 密钥请切换到客户 Azure 模式。",
    );
  }

  const baseURL = cleanOptionalBaseURL(config.baseURL);
  if (!baseURL) {
    throw new Error(
      "客户 OpenAI 模式需要填写 OPENAI_BASE_URL，例如 https://api.openai.com/v1 或你的 OpenAI 代理地址。",
    );
  }

  return new OpenAI({
    apiKey,
    baseURL,
    timeout,
  });
}
