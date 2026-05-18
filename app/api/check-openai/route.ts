import { NextResponse } from "next/server";
import { openAIBaseURL, hasAzureImageConfig, azureOpenAIEndpoint } from "@/lib/openai";

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

export async function GET() {
  if (hasAzureImageConfig()) {
    return NextResponse.json({
      ok: true,
      type: "azure",
      message: "连接成功：当前使用 Azure OpenAI 图片部署。",
      baseURL: "azure",
      endpoint: azureOpenAIEndpoint,
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "API Key 缺失：请在 .env.local 中配置 OPENAI_API_KEY。" },
      { status: 400 },
    );
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(`${openAIBaseURL.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: classifyError(`${response.status} ${response.statusText}`), baseURL: openAIBaseURL },
        { status: response.status },
      );
    }

    return NextResponse.json({
      ok: true,
      type: "openai",
      message: "连接成功。",
      baseURL: openAIBaseURL,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: classifyError(error), baseURL: openAIBaseURL },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    apiKey?: string;
    baseURL?: string;
  };
  const apiKey = body.apiKey?.trim() || "";
  const baseURL = (body.baseURL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "API Key 缺失：请先填写你自己的 OpenAI API Key。" },
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
      message: "连接成功：当前使用客户自己的 OpenAI API Key。",
      baseURL,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: classifyError(error), baseURL },
      { status: 500 },
    );
  }
}
