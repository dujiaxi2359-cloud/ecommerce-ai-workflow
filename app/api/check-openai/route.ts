import { NextResponse } from "next/server";
import type { ApiProvider } from "@/lib/apiKey/apiKeyTypes";

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

function looksLikeOpenAIKey(apiKey: string) {
  return /^sk-/i.test(apiKey.trim());
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

export async function GET() {
  return NextResponse.json({
    ok: true,
    type: "customer-key",
    message: "当前版本只使用客户自己的 Azure OpenAI 或 OpenAI 配置，平台不会使用服务器 API Key。",
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    apiProvider?: ApiProvider;
    apiKey?: string;
    baseURL?: string;
    azureEndpoint?: string;
    azureDeployment?: string;
    azureApiVersion?: string;
  };

  const provider = body.apiProvider === "openai" ? "openai" : "azure";
  const apiKey = body.apiKey?.trim() || "";

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "API Key 缺失：请先填写客户自己的 API Key。" },
      { status: 400 },
    );
  }

  if (provider === "azure") {
    const parsedAzure = parseAzureEndpoint(body.azureEndpoint) || parseAzureEndpoint(body.baseURL);
    const endpoint = parsedAzure?.endpoint || cleanURL(body.azureEndpoint);
    const deployment = parsedAzure?.deployment || body.azureDeployment?.trim() || "";
    const apiVersion = parsedAzure?.apiVersion || body.azureApiVersion?.trim() || "2025-04-01-preview";

    if (!endpoint || !deployment) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "客户 Azure 模式需要填写 Azure Endpoint 和 Deployment。Endpoint 可以填资源地址，也可以填完整 images/generations 终结点。",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      type: "azure",
      message: "Azure 配置格式通过：生成时会使用客户自己的 Azure OpenAI Key、Endpoint 和 Deployment。",
      endpoint,
      deployment,
      apiVersion,
    });
  }

  if (!looksLikeOpenAIKey(apiKey)) {
    return NextResponse.json(
      { ok: false, error: "客户 OpenAI 模式需要填写 sk- 开头的 OpenAI API Key。Azure 密钥请切换到客户 Azure 模式。" },
      { status: 400 },
    );
  }

  const baseURL = cleanURL(body.baseURL);
  if (!baseURL) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "客户 OpenAI 模式需要填写 OPENAI_BASE_URL，例如 https://api.openai.com/v1 或你的 OpenAI 代理地址。",
      },
      { status: 400 },
    );
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: classifyError(`${response.status} ${response.statusText}`),
          baseURL,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      ok: true,
      type: "openai",
      message: "OpenAI 配置检测成功：生成时会使用客户自己的 OpenAI API Key 和 Base URL。",
      baseURL,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: classifyError(error), baseURL },
      { status: 500 },
    );
  }
}
