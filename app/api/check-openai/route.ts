import { NextResponse } from "next/server";
import type { ApiProvider } from "@/lib/apiKey/apiKeyTypes";
import { normalizeOpenAICompatibleBaseURL } from "@/lib/apiKey/openaiClientFromRequest";
import { addServerLog } from "@/lib/server-logs";

export const runtime = "nodejs";

function classifyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("401") || lower.includes("unauthorized")) return "API Key 错误";
  if (lower.includes("403")) return "403 权限或地区限制";
  if (lower.includes("timeout") || lower.includes("timed out")) return "timeout 超时";
  if (lower.includes("dns") || lower.includes("enotfound")) return "DNS error";
  if (lower.includes("fetch failed") || lower.includes("network")) return "network error 网络错误";
  if (lower.includes("invalid url") || lower.includes("base")) return "baseURL 配置错误";
  return message;
}

function cleanURL(value?: string) {
  const trimmed = value?.trim() || "";
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return "";
  return trimmed.replace(/\/$/, "");
}

function parseAzureEndpoint(endpoint?: string) {
  const cleaned = cleanURL(endpoint);
  if (!cleaned || !cleaned.includes("cognitiveservices.azure.com")) return null;

  try {
    const url = new URL(cleaned);
    const deployment = url.pathname.match(/\/deployments\/([^/]+)/)?.[1] || "";
    const endpointPath = url.pathname.split("/openai/")[0] || "";
    return {
      endpoint: `${url.origin}${endpointPath}`.replace(/\/?$/, "/"),
      deployment,
      apiVersion: url.searchParams.get("api-version") || "",
    };
  } catch {
    return null;
  }
}

function safeEndpointLabel(baseURL?: string) {
  if (!baseURL) return "official";

  try {
    const url = new URL(baseURL);
    return `${url.hostname}${url.pathname.replace(/\/+$/, "") || "/"}`;
  } catch {
    return "custom-base-url";
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    type: "customer-key",
    message: "当前版本只使用客户自己的 Azure OpenAI 或 OpenAI 兼容接口配置。",
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const body = (await request.json().catch(() => ({}))) as {
    apiProvider?: ApiProvider;
    apiKey?: string;
    baseURL?: string;
  azureEndpoint?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
  imageModel?: string;
  googleBananaModel?: string;
  };

  const provider =
    body.apiProvider === "azure" || body.apiProvider === "azure-openai"
      ? "azure"
      : body.apiProvider === "google-banana"
        ? "google-banana"
        : "openai";
  const apiKey = body.apiKey?.trim() || "";

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "API Key 缺失：请先填写客户自己的 API Key。" },
      { status: 400 },
    );
  }

  if (provider === "google-banana") {
    const baseURL = normalizeOpenAICompatibleBaseURL(body.baseURL);
    if (!baseURL) {
      return NextResponse.json(
        { ok: false, error: "Google Banana 需要填写 Base URL，模型可选择 Banana 2 或 Banana Pro。" },
        { status: 400 },
      );
    }

    const durationMs = Date.now() - startedAt;
    addServerLog("success", "api.check-openai", "Google Banana config validated", {
      durationMs,
      endpoint: safeEndpointLabel(baseURL),
      model: body.googleBananaModel || body.imageModel || "banana-pro",
    });
    return NextResponse.json({
      ok: true,
      type: "google-banana",
      message: `Google Banana 配置已保存：${body.googleBananaModel || body.imageModel || "banana-pro"}`,
      baseURL,
      model: body.googleBananaModel || body.imageModel || "banana-pro",
      durationMs,
    });
  }

  if (provider === "azure") {
    const parsedAzure = parseAzureEndpoint(body.azureEndpoint) || parseAzureEndpoint(body.baseURL);
    if (parsedAzure) {
      const deployment = parsedAzure.deployment || body.azureDeployment?.trim() || "";
      if (!deployment) {
        return NextResponse.json(
          { ok: false, error: "客户 Azure 模式需要填写 Deployment，例如 gpt-image-2。" },
          { status: 400 },
        );
      }

      const durationMs = Date.now() - startedAt;
      addServerLog("success", "api.check-openai", "Azure config validated", {
        durationMs,
        endpoint: safeEndpointLabel(parsedAzure.endpoint),
        deployment,
        apiVersion: parsedAzure.apiVersion || body.azureApiVersion || "2025-04-01-preview",
      });
      return NextResponse.json({
        ok: true,
        type: "azure",
        message: "Azure 配置格式通过：生成时会使用客户自己的 Azure OpenAI Key、Endpoint 和 Deployment。",
        endpoint: parsedAzure.endpoint,
        deployment,
        apiVersion: parsedAzure.apiVersion || body.azureApiVersion || "2025-04-01-preview",
        durationMs,
      });
    }

    const compatibleBaseURL = normalizeOpenAICompatibleBaseURL(body.azureEndpoint || body.baseURL);
    if (compatibleBaseURL) {
      const durationMs = Date.now() - startedAt;
      addServerLog("success", "api.check-openai", "OpenAI-compatible Azure fallback config validated", {
        durationMs,
        endpoint: safeEndpointLabel(compatibleBaseURL),
      });
      return NextResponse.json({
        ok: true,
        type: "openai-compatible",
        message: `已识别为 OpenAI 兼容接口，实际使用地址：${compatibleBaseURL}`,
        baseURL: compatibleBaseURL,
        durationMs,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          "请填写接口地址。Azure 可填资源地址或完整 images/generations；OpenAI 兼容接口可填 /v1、/v1/images/generations 或 /v1/images/edits。",
      },
      { status: 400 },
    );
  }

  const baseURL =
    normalizeOpenAICompatibleBaseURL(body.baseURL || body.azureEndpoint) ||
    "https://api.openai.com/v1";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const durationMs = Date.now() - startedAt;
      addServerLog("error", "api.check-openai", "Provider /models check failed", {
        durationMs,
        endpoint: safeEndpointLabel(baseURL),
        status: response.status,
        statusText: response.statusText,
      });
      return NextResponse.json(
        {
          ok: false,
          error: classifyError(`${response.status} ${response.statusText}`),
          baseURL,
          durationMs,
        },
        { status: response.status },
      );
    }

    const durationMs = Date.now() - startedAt;
    addServerLog("success", "api.check-openai", "Provider /models check completed", {
      durationMs,
      endpoint: safeEndpointLabel(baseURL),
      model: body.imageModel || "default",
    });
    return NextResponse.json({
      ok: true,
      type: "openai",
      message: body.baseURL?.trim()
        ? `OpenAI 兼容配置检测成功，实际使用地址：${baseURL}`
        : "OpenAI 官方接口检测成功：Base URL 留空时会使用 https://api.openai.com/v1。",
      baseURL,
      durationMs,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    addServerLog("error", "api.check-openai", "Provider connectivity check failed", {
      durationMs,
      endpoint: safeEndpointLabel(baseURL),
      error: classifyError(error),
    });
    return NextResponse.json(
      { ok: false, error: classifyError(error), baseURL, durationMs },
      { status: 500 },
    );
  }
}
