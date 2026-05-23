import OpenAI from "openai";
import type { ApiProvider, UserApiKeyConfig } from "./apiKeyTypes";

const DEFAULT_AZURE_API_VERSION = "2025-04-01-preview";
const DEFAULT_AZURE_DEPLOYMENT = "gpt-image-2";

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function withProtocol(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function sanitizeApiKeyError(message: string, apiKey?: string) {
  let safe = message || "接口调用失败。";
  if (apiKey) safe = safe.split(apiKey).join("[API_KEY]");
  return safe.replace(/sk-[A-Za-z0-9_-]{12,}/g, "sk-****");
}

export function normalizeOpenAICompatibleBaseURL(input?: string | null) {
  const raw = input?.trim();
  if (!raw) return undefined;

  try {
    const url = new URL(withProtocol(raw));
    let path = url.pathname.replace(/\/+$/, "");

    path = path
      .replace(/\/images\/generations$/i, "")
      .replace(/\/images\/edits$/i, "")
      .replace(/\/chat\/completions$/i, "")
      .replace(/\/responses$/i, "");

    if (!path || path === "/") path = "/v1";
    if (!/\/v1$/i.test(path)) path = `${path}/v1`;

    return trimTrailingSlash(`${url.origin}${path}`);
  } catch {
    throw new Error(
      "OPENAI_BASE_URL 格式不正确。官方 OpenAI 可留空；代理请填写类似 https://域名/v1 的地址。",
    );
  }
}

export function parseAzureEndpoint(input?: string | null) {
  const raw = input?.trim();
  if (!raw) return { endpoint: "", deployment: "", apiVersion: "" };

  try {
    const url = new URL(withProtocol(raw));
    const deployment = url.pathname.match(/\/deployments\/([^/]+)/i)?.[1] || "";
    const apiVersion = url.searchParams.get("api-version") || "";
    const openaiIndex = url.pathname.toLowerCase().indexOf("/openai");
    const endpoint = `${url.origin}${openaiIndex >= 0 ? url.pathname.slice(0, openaiIndex) : ""}/`;

    return { endpoint, deployment, apiVersion };
  } catch {
    return { endpoint: "", deployment: "", apiVersion: "" };
  }
}

export function normalizeAzureEndpoint(input?: string | null) {
  const raw = input?.trim();
  if (!raw) return "";

  const parsed = parseAzureEndpoint(raw);
  if (parsed.endpoint) return parsed.endpoint;

  try {
    return `${new URL(withProtocol(raw)).origin}/`;
  } catch {
    throw new Error("Azure Endpoint 格式不正确。");
  }
}

export function createOpenAIClientFromRequest(config: UserApiKeyConfig) {
  const provider: ApiProvider = config.provider || "openai";
  const apiKey = config.apiKey?.trim();

  if (!apiKey) {
    throw new Error("API Key 缺失：请填写客户自己的 API Key。");
  }

  if (provider === "azure") {
    const parsed = parseAzureEndpoint(config.azureEndpoint || config.baseURL);
    const endpoint =
      normalizeAzureEndpoint(config.azureEndpoint || config.baseURL) ||
      readEnv("AZURE_OPENAI_ENDPOINT", "OPENAI_AZURE_ENDPOINT");
    const deployment =
      config.azureDeployment?.trim() ||
      parsed.deployment ||
      readEnv("AZURE_OPENAI_DEPLOYMENT", "OPENAI_AZURE_DEPLOYMENT") ||
      DEFAULT_AZURE_DEPLOYMENT;
    const apiVersion =
      config.azureApiVersion?.trim() ||
      parsed.apiVersion ||
      readEnv("AZURE_OPENAI_API_VERSION", "OPENAI_API_VERSION") ||
      DEFAULT_AZURE_API_VERSION;

    if (!endpoint || !deployment) {
      throw new Error(
        "客户 Azure 模式需要填写 Azure Endpoint 和 Deployment。Endpoint 可以填资源地址，也可以填完整 images/generations 地址。",
      );
    }

    return new OpenAI({
      apiKey,
      baseURL: `${trimTrailingSlash(endpoint)}/openai/deployments/${deployment}`,
      defaultQuery: { "api-version": apiVersion },
      defaultHeaders: { "api-key": apiKey },
      timeout: 300_000,
    });
  }

  const baseURL = normalizeOpenAICompatibleBaseURL(config.baseURL);

  return new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    timeout: 300_000,
  });
}
