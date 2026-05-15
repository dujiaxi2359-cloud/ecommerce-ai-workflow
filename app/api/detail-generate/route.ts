import { NextResponse } from "next/server";
import { generateImageWithReferences } from "@/lib/image-generation";
import { buildDetailImagePrompt } from "@/lib/promptBuilders";
import { ratioToSize } from "@/lib/templates";
import { publicPrompt } from "@/lib/workflow-privacy";
import { defaultProductProtection } from "@/types/workflow";
import type { DetailBlueprintItem } from "@/types/detail";
import type { ImageQuality, Ratio } from "@/lib/workflow";

export const runtime = "nodejs";

function buildPrivateBlueprintPrompt(blueprint: DetailBlueprintItem) {
  return [
    `Detail image ${blueprint.index}: ${blueprint.type}`,
    `Platform: ${blueprint.platform || "ecommerce"}`,
    `Output language: ${blueprint.language || "selected language"}`,
    `Visual direction: ${blueprint.visualDirection}`,
    `Product placement: ${blueprint.productPlacement}`,
    `Background style: ${blueprint.backgroundStyle}`,
    `Layout: ${blueprint.layout}`,
    `Text-layer title reference only: ${blueprint.title}`,
    `Text-layer subtitle reference only: ${blueprint.subtitle}`,
    `Text-layer selling points reference only: ${blueprint.sellingPoints.join("; ")}`,
    "Do not expose workflow prompt. Generate only the commercial visual result.",
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const product = formData.get("productImage");
    if (!(product instanceof File) || product.size === 0) {
      return NextResponse.json({ error: "请上传产品主图。" }, { status: 400 });
    }

    const blueprint = JSON.parse(String(formData.get("blueprint") || "{}")) as DetailBlueprintItem;
    if (!blueprint.prompt) {
      return NextResponse.json({ error: "缺少详情图蓝图。" }, { status: 400 });
    }

    const ratio = String(formData.get("ratio") || "1:1") as Ratio;
    const quality = String(formData.get("quality") || "low") as ImageQuality;
    const prompt = buildDetailImagePrompt({
      blueprintPrompt: buildPrivateBlueprintPrompt(blueprint),
      title: blueprint.title,
      subtitle: blueprint.subtitle,
      layout: blueprint.layout,
      language: blueprint.language,
      textMode: String(formData.get("textMode") || "editable-layers") as never,
      protection: defaultProductProtection,
    });

    const result = await generateImageWithReferences({
      prompt,
      images: [product],
      size: ratioToSize[ratio],
      quality,
      count: 1,
    });

    return NextResponse.json({
      ...result,
      finalPrompt: publicPrompt(),
      blueprint,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "详情图生成失败，请稍后重试。",
      },
      { status: 500 },
    );
  }
}
