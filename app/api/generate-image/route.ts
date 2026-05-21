import { NextResponse } from "next/server";
import { generateImage, generateImageWithReferences } from "@/lib/image-generation";
import { buildTextPrompt } from "@/lib/prompt-builders";
import { addServerLog } from "@/lib/server-logs";
import { saveSharedHistory, type SharedHistoryItem } from "@/lib/server-history";
import {
  isWorkflowAuthResponse,
  withWorkflowAuthFromFormData,
} from "@/lib/server/withWorkflowAuth";
import { publicPrompt, redactHistoryPrompt } from "@/lib/workflow-privacy";
import { createFallbackImages, type ImageQuality, type ImageSize, type Ratio, type StyleKey } from "@/lib/workflow";

export const runtime = "nodejs";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseHistoryMeta(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value) as Partial<SharedHistoryItem>;
    return parsed.id && parsed.workflow && parsed.title ? parsed : null;
  } catch {
    return null;
  }
}

async function saveGeneratedHistory({
  meta,
  customerId,
  finalPrompt,
  createdAt,
  images,
}: {
  meta: Partial<SharedHistoryItem> | null;
  customerId: string;
  finalPrompt: string;
  createdAt: string;
  images: Awaited<ReturnType<typeof generateImage>>["images"];
}) {
  if (!meta?.id || !meta.workflow || !meta.title) return null;

  try {
    return await saveSharedHistory(
      {
        id: meta.id,
        workflow: meta.workflow,
        title: meta.title,
        customerId,
        outputType: meta.outputType,
        referenceThumb: meta.referenceThumb,
        productThumb: meta.productThumb,
        imageCount: images.length,
        finalPrompt,
        createdAt,
      },
      images,
    );
  } catch (error) {
    addServerLog(
      "error",
      "api.history",
      "Server-side history save failed",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let prompt = "";
  let style = "minimalEcommerce" as StyleKey;
  let ratio = "1:1" as Ratio;
  let size = "1024x1024" as ImageSize;
  let quality = "low" as ImageQuality;
  let count = 1;

  try {
    const formData = await request.formData();
    prompt = String(formData.get("prompt") || "").trim();
    style = String(formData.get("style") || "minimalEcommerce") as StyleKey;
    ratio = String(formData.get("ratio") || "1:1") as Ratio;
    size = String(formData.get("size") || "1024x1024") as ImageSize;
    quality = String(formData.get("quality") || "low") as ImageQuality;
    count = Math.min(Math.max(Number(formData.get("count") || 1), 1), 4);
    const mode = String(formData.get("mode") || "text");
    const reference = formData.get("reference");
    const historyMeta = parseHistoryMeta(formData.get("__historyMeta"));
    const auth = await withWorkflowAuthFromFormData(formData, "text-image");
    if (isWorkflowAuthResponse(auth)) return auth;

    addServerLog("info", "api.generate-image", "Received image generation request", {
      mode,
      style,
      ratio,
      size,
      quality,
      count,
      hasReference: reference instanceof File && reference.size > 0,
    });

    if (!prompt) {
      return errorResponse("请输入 prompt。");
    }

    const finalPrompt = buildTextPrompt({ prompt, style, ratio });
    const result =
      mode === "reference" && reference instanceof File && reference.size > 0
        ? await generateImageWithReferences({
            prompt: finalPrompt,
            images: [reference],
            size,
            quality,
            count,
            clients: { openai: auth.openai },
          })
        : await generateImage({
            prompt: finalPrompt,
            size,
            quality,
            count,
            clients: { openai: auth.openai },
          });

    const createdAt = new Date().toISOString();
    const historyItem = await saveGeneratedHistory({
      meta: historyMeta,
      customerId: auth.license.code,
      finalPrompt: publicPrompt(),
      createdAt,
      images: result.images,
    });

    return NextResponse.json({
      ...result,
      finalPrompt: publicPrompt(),
      createdAt,
      durationMs: Date.now() - startedAt,
      historyItem: redactHistoryPrompt(historyItem),
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "图片生成失败，请稍后重试。";
    const lower = rawMessage.toLowerCase();
    addServerLog("error", "api.generate-image", "Image generation request failed", rawMessage);

    if (
      lower.includes("fetch failed") ||
      lower.includes("connection error") ||
      lower.includes("econnreset") ||
      lower.includes("timed out") ||
      lower.includes("timeout")
    ) {
      const finalPrompt = prompt
        ? buildTextPrompt({ prompt, style, ratio })
        : "Local offline preview";

      return NextResponse.json({
        images: createFallbackImages({ prompt, style, ratio, size, count }),
        finalPrompt: publicPrompt(),
        createdAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        warning:
          "当前网络无法连接图片服务，已生成本地离线预览图。配置可用网络、OPENAI_BASE_URL 或 Azure 终结点后会自动使用真实 AI 生图。",
      });
    }

    return errorResponse(rawMessage, 500);
  }
}
