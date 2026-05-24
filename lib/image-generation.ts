import OpenAI, { toFile } from "openai";
import {
  azureOpenAIDeployment,
  createAzureOpenAIClient,
  createOpenAIClient,
  hasAzureImageConfig,
  imageModel,
} from "@/lib/openai";
import { createId } from "@/lib/id";
import { addServerLog } from "@/lib/server-logs";
import type { ImageQuality, ImageSize } from "@/lib/workflow";

export type GeneratedImage = {
  id: string;
  index: number;
  url: string;
};

export type ImageGenerationResult = {
  images: GeneratedImage[];
  warning?: string;
};

type ImageGenerationClients = {
  openai?: OpenAI;
};

function getDefaultOpenAIClient() {
  return createOpenAIClient(300_000);
}

function getDefaultAzureOpenAIClient() {
  return hasAzureImageConfig() ? createAzureOpenAIClient(300_000) : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isRateLimitError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("servicing too many requests")
  );
}

function normalizeImageError(error: unknown, provider: string, action: string) {
  const message = errorMessage(error);

  if (isRateLimitError(error)) {
    return `${provider} 图片服务当前繁忙或达到限流，请等待 30-60 秒后重试。建议先把输出数量设为 1，质量用 medium，连续生成时不要多人同时点击。原始错误：${message}`;
  }

  return `${provider} image ${action} failed: ${message}`;
}

async function withImageApiRetry<T>(
  scope: string,
  operation: () => Promise<T>,
  retryDelays = [6000, 12000, 24000],
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRateLimitError(error) || attempt === retryDelays.length) {
        throw error;
      }

      const waitMs = retryDelays[attempt];
      addServerLog("warn", scope, "Image API rate limited, retrying", {
        attempt: attempt + 1,
        nextAttemptInMs: waitMs,
        error: errorMessage(error),
      });
      await sleep(waitMs);
    }
  }

  throw lastError;
}

function normalizeSizeForImageApi(size: ImageSize, quality: ImageQuality) {
  const [width, height] = size.split("x").map(Number);
  const minimumPixels = 1024 * 1024;
  const targetLongEdge = quality === "high" ? 4096 : quality === "medium" ? 2048 : 1024;
  const currentLongEdge = Math.max(width, height);
  const originalPixels = width * height;
  const pixelScale =
    originalPixels > 0 && originalPixels < minimumPixels
      ? Math.sqrt(minimumPixels / originalPixels)
      : 1;
  const qualityScale =
    currentLongEdge > 0 && currentLongEdge < targetLongEdge
      ? targetLongEdge / currentLongEdge
      : 1;
  const scale = Math.max(pixelScale, qualityScale);
  const scaledWidth = Math.ceil(width * scale);
  const scaledHeight = Math.ceil(height * scale);
  const nextWidth = Math.max(16, Math.ceil(scaledWidth / 16) * 16);
  const nextHeight = Math.max(16, Math.ceil(scaledHeight / 16) * 16);
  const normalized = `${nextWidth}x${nextHeight}` as ImageSize;

  return {
    size: normalized,
    changed: normalized !== size,
    original: size,
    reason:
      scale === qualityScale && qualityScale > 1
        ? `raised-to-${targetLongEdge}px-quality`
        : originalPixels < minimumPixels
        ? "raised-to-minimum-pixel-budget"
        : normalized !== size
          ? "rounded-to-multiple-of-16"
          : undefined,
  };
}

function normalizeImages(data: { b64_json?: string; url?: string }[] = []) {
  return data
    .map((item, index) => ({
      id: createId("image"),
      index,
      url: item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url || "",
    }))
    .filter((image) => image.url);
}

function ensureGeneratedImages(images: GeneratedImage[], provider: string) {
  if (images.length > 0) return images;

  throw new Error(
    `${provider} 接口请求已完成，但没有返回可用图片。请检查图片模型、Deployment/Base URL 是否指向 images 接口，以及代理或 Azure 返回值是否包含 b64_json 或 url。`,
  );
}

async function generateAzureImage({
  prompt,
  size,
  quality,
  count,
}: {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  count: number;
}) {
  const azureOpenAI = getDefaultAzureOpenAIClient();
  if (!azureOpenAI) {
    throw new Error("Azure OpenAI is not configured.");
  }

  const apiSize = normalizeSizeForImageApi(size, quality);
  const startedAt = Date.now();
  addServerLog("info", "azure.generate", "Starting Azure image generation", {
    deployment: azureOpenAIDeployment,
    size: apiSize.size,
    requestedSize: apiSize.changed ? apiSize.original : undefined,
    sizeNormalization: apiSize.reason,
    quality,
    count,
  });

  const result = await withImageApiRetry("azure.generate", () =>
    azureOpenAI.images.generate({
      model: azureOpenAIDeployment,
      prompt,
      n: count,
      size: apiSize.size,
      quality,
    } as never),
  );

  const images = normalizeImages(result.data);
  addServerLog("success", "azure.generate", "Azure image generation completed", {
    durationMs: Date.now() - startedAt,
    images: images.length,
  });
  return { images: ensureGeneratedImages(images, "Azure OpenAI") };
}

async function generateOpenAIImage({
  prompt,
  size,
  quality,
  count,
  client = getDefaultOpenAIClient(),
}: {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  count: number;
  client?: OpenAI;
}) {
  const apiSize = normalizeSizeForImageApi(size, quality);
  const startedAt = Date.now();
  addServerLog("info", "openai.generate", "Starting OpenAI image generation", {
    model: imageModel,
    size: apiSize.size,
    requestedSize: apiSize.changed ? apiSize.original : undefined,
    sizeNormalization: apiSize.reason,
    quality,
    count,
  });

  const result = await withImageApiRetry("openai.generate", () =>
    client.images.generate({
      model: imageModel,
      prompt,
      size: apiSize.size,
      quality,
      n: count,
    } as never),
  );

  const images = normalizeImages(result.data);
  addServerLog("success", "openai.generate", "OpenAI image generation completed", {
    durationMs: Date.now() - startedAt,
    images: images.length,
  });
  return { images: ensureGeneratedImages(images, "OpenAI") };
}

export async function generateImage({
  prompt,
  size,
  quality,
  count,
  clients,
}: {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  count: number;
  clients?: ImageGenerationClients;
}): Promise<ImageGenerationResult> {
  if (clients?.openai) {
    return generateOpenAIImage({ prompt, size, quality, count, client: clients.openai });
  }

  if (hasAzureImageConfig()) {
    return generateAzureImage({ prompt, size, quality, count });
  }

  return generateOpenAIImage({ prompt, size, quality, count });
}

export async function generateImageWithReferences({
  prompt,
  images,
  size,
  quality,
  count,
  clients,
}: {
  prompt: string;
  images: File[];
  size: ImageSize;
  quality: ImageQuality;
  count: number;
  clients?: ImageGenerationClients;
}): Promise<ImageGenerationResult> {
  if (!clients?.openai && hasAzureImageConfig()) {
    const azureOpenAI = getDefaultAzureOpenAIClient();
    if (!azureOpenAI) {
      throw new Error("Azure OpenAI is not configured.");
    }

    try {
      const apiSize = normalizeSizeForImageApi(size, quality);
      const startedAt = Date.now();
      addServerLog("info", "azure.edit", "Starting Azure image edit", {
        deployment: azureOpenAIDeployment,
        size: apiSize.size,
        requestedSize: apiSize.changed ? apiSize.original : undefined,
        sizeNormalization: apiSize.reason,
        quality,
        count,
        inputImages: images.length,
      });

      const inputFiles = await Promise.all(
        images.map(async (image) =>
          toFile(
            Buffer.from(await image.arrayBuffer()),
            image.name || "input.png",
            { type: image.type || "image/png" },
          ),
        ),
      );

      const result = await withImageApiRetry("azure.edit", () =>
        azureOpenAI.images.edit({
          model: azureOpenAIDeployment,
          prompt,
          image: inputFiles,
          size: apiSize.size,
          quality,
          n: count,
        } as never),
      );

      const outputImages = normalizeImages(result.data);
      addServerLog("success", "azure.edit", "Azure image edit completed", {
        durationMs: Date.now() - startedAt,
        images: outputImages.length,
      });
      return { images: ensureGeneratedImages(outputImages, "Azure OpenAI") };
    } catch (error) {
      addServerLog(
        "error",
        "azure.edit",
        "Azure image edit failed",
        error instanceof Error ? error.message : error,
      );
      throw new Error(
        normalizeImageError(error, "Azure OpenAI", "edit"),
      );
    }
  }

  const startedAt = Date.now();
  const apiSize = normalizeSizeForImageApi(size, quality);
  addServerLog("info", "openai.edit", "Starting OpenAI image edit", {
    model: imageModel,
    size: apiSize.size,
    requestedSize: apiSize.changed ? apiSize.original : undefined,
    sizeNormalization: apiSize.reason,
    quality,
    count,
    inputImages: images.length,
  });

  const inputFiles = await Promise.all(
    images.map(async (image) =>
      toFile(Buffer.from(await image.arrayBuffer()), image.name || "input.png", {
        type: image.type || "image/png",
      }),
    ),
  );

  const result = await withImageApiRetry("openai.edit", () =>
    (clients?.openai || getDefaultOpenAIClient()).images.edit({
      model: imageModel,
      prompt,
      image: inputFiles,
      size: apiSize.size,
      quality,
      n: count,
    } as never),
  );

  const outputImages = normalizeImages(result.data);
  addServerLog("success", "openai.edit", "OpenAI image edit completed", {
    durationMs: Date.now() - startedAt,
    images: outputImages.length,
  });
  return { images: ensureGeneratedImages(outputImages, "OpenAI") };
}
