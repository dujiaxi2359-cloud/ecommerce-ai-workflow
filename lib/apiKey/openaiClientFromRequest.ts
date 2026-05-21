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

function cleanURL(value?: string) {
  const trimmed = value?.trim() || "";
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return "";
  return trimmed.replace(/\/$/, "");
}

export function normalizeOpenAICompatibleBaseURL(value?: string) {
  const cleaned = cleanURL(value);
  if (!cleaned) return "";

  try {
    const url = new URL(cleaned);
    url.search = "";

    const imageEndpointMatch = url.pathname.match(
      /^(.*?\/v\d+)\/images\/(?:generations|edits|variations)\/?$/i,
    );
    if (imageEndpointMatch?.[1]) {
      url.pathname = imageEndpointMatch[1];
      return url.toString().replace(/\/$/, "");
    }

    const versionRootMatch = url.pathname.match(/^(.*?\/v\d+)\/?$/i);
    if (versionRootMatch?.[1]) {
      url.pathname = versionRootMatch[1];
      return url.toString().replace(/\/$/, "");
    }

    return cleaned;
  } catch {
    return cleaned;
  }
}

function parseAzureConnection(
  endpointOrFullUrl?: string,
  deployment?: string,
  apiVersion?: string,
): AzureConnection | null {
  const cleaned = cleanURL(endpointOrFullUrl);
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

    if (azureConnection) {
      if (!azureConnection.deployment) {
        throw new Error("客户 Azure 模式需要填写 Deployment，例如 gpt-image-2。");
      }
      return createAzureClient(apiKey, azureConnection, timeout);
    }

    const compatibleBaseURL = normalizeOpenAICompatibleBaseURL(config.azureEndpoint || config.baseURL);
    if (compatibleBaseURL) {
      return new OpenAI({
        apiKey,
        baseURL: compatibleBaseURL,
        timeout,
      });
    }

    throw new Error(
      "请填写接口地址。Azure 可填资源地址或完整 images/generations；OpenAI 兼容接口可填 /v1、/v1/images/generations 或 /v1/images/edits。",
    );
  }

  const baseURL = normalizeOpenAICompatibleBaseURL(config.baseURL || config.azureEndpoint);
  if (!baseURL) {
    throw new Error(
      "客户 OpenAI 模式需要填写 OPENAI_BASE_URL，例如 https://api.openai.com/v1，也可以填写完整 /v1/images/generations 或 /v1/images/edits。",
    );
  }

  return new OpenAI({
    apiKey,
    baseURL,
    timeout,
  });
}
