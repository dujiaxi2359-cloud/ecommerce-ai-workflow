import type { Ratio } from "@/lib/workflow";
import type {
  ProductProtectionSettings,
  ProductVariantOutputType,
  ProductVisualStyle,
  ProductWorkflowOutputType,
} from "@/types/workflow";

export function buildProductProtectionPrompt(protection?: Partial<ProductProtectionSettings>) {
  const level = protection?.level || "strict";
  const strict =
    level === "strict"
      ? "严格锁定模式：不允许重绘产品主体，不允许改变产品颜色、结构、按键、表盘、接口、轮廓、logo、配件。"
      : level === "high-fidelity"
        ? "高保真模式：必须高度保持上传产品的真实外观，仅允许轻微光影融合。"
        : "标准模式：保持产品主体一致，避免明显变形或换款。";

  return [
    "产品保护规则：Use the uploaded product image as the fixed main product subject.",
    "Keep the exact product appearance, color, shape, structure, buttons, screen, ports, logo, accessories, and silhouette unchanged.",
    "Only change the background, lighting, scene, layout, mood, commercial visual style, selling-point cards, text areas, and decorative elements.",
    "Do not redesign, replace, recolor, or invent a new product.",
    "中文要求：请将上传的产品图作为固定主体，保持产品外观、颜色、结构、按键、屏幕、接口、logo、配件、轮廓完全一致。只改变背景、光影、场景、排版、氛围、商业视觉风格、卖点卡片和装饰元素。不要重新设计产品，不要生成另一款产品。",
    strict,
  ].join("\n");
}

export function buildTextToImagePrompt(input: {
  prompt: string;
  style: string;
  ratio: Ratio;
  platformPrompt?: string;
}) {
  return [
    input.prompt,
    `风格：${input.style}`,
    `比例：${input.ratio}`,
    input.platformPrompt,
    "适合电商视觉生产，画面高级、干净、可用于活动图、背景图、概念海报或非严格产品一致性的创意图。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildReferenceMimicPrompt(input: {
  productName: string;
  sellingPoints: string;
  extraRequirements: string;
  outputType: string;
  dimensions: string[];
  strength: string;
  ratio: Ratio;
  protection?: Partial<ProductProtectionSettings>;
  platformPrompt?: string;
}) {
  return [
    "参考图模仿生图工作流。",
    "参考图只用于模仿风格、构图、排版、色调、氛围和材质表现，不得复制参考图中的品牌、logo、人物、产品或文案。",
    "产品图是唯一真实产品主体。",
    buildProductProtectionPrompt(input.protection),
    `产品名称：${input.productName || "根据上传产品图判断"}`,
    `卖点：${input.sellingPoints || "突出产品质感、核心功能和电商转化价值"}`,
    `生成类型：${input.outputType}`,
    `模仿维度：${input.dimensions.join("、") || "风格、构图、排版、色调、氛围"}`,
    `模仿强度：${input.strength}`,
    `比例：${input.ratio}`,
    input.platformPrompt,
    `补充要求：${input.extraRequirements || "高级、干净、适合电商展示"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildProductWorkflowPrompt(input: {
  productName: string;
  category: string;
  userPrompt?: string;
  outputType?: ProductWorkflowOutputType | string;
  backgroundType?: string;
  style?: ProductVisualStyle | string;
  ratio: Ratio;
  protection?: Partial<ProductProtectionSettings>;
  platformPrompt?: string;
}) {
  return [
    "产品图工作流：基于上传产品主图生成电商产品视觉。用户提示词决定背景、场景、光影、陈列方式和商业氛围。",
    buildProductProtectionPrompt(input.protection),
    `产品名称：${input.productName || "根据上传产品图判断"}`,
    `产品品类：${input.category || "未填写"}`,
    `用户提示词：${input.userPrompt || "生成干净高级的电商产品展示图，只改变背景、光影和排版。"}`,
    input.outputType ? `输出类型：${input.outputType}` : "",
    input.backgroundType ? `背景类型：${input.backgroundType}` : "",
    input.style ? `视觉风格：${input.style}` : "",
    `比例：${input.ratio}`,
    input.platformPrompt,
    "严格按用户提示词生成背景和视觉呈现。可增加底座、投影、反射、场景道具、信息留白和商业排版，但不得改变产品本体。",
    "Output quality requirements: high-resolution commercial product photography, sharp focus, crisp product edges, clean anti-aliased silhouette, detailed material texture, accurate highlights, natural shadows, no blur, no pixelation, no compression artifacts, no low-resolution look.",
    "电商高清要求：产品边缘清晰锐利，材质细节完整，高光和阴影自然，画面不能模糊、不能糊边、不能有低清像素感或压缩噪点。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildProductVariantPrompt(input: {
  userPrompt: string;
  outputType: ProductVariantOutputType | string;
  style: ProductVisualStyle | string;
  ratio: Ratio;
  protection?: Partial<ProductProtectionSettings>;
  platformPrompt?: string;
}) {
  return [
    "产品风格变体工作流：同一产品多风格展示。",
    buildProductProtectionPrompt(input.protection),
    `用户提示词：${input.userPrompt}`,
    `输出类型：${input.outputType}`,
    `视觉风格：${input.style}`,
    `比例：${input.ratio}`,
    input.platformPrompt,
    "只改变展示方式，包括背景、场景、光影、氛围、版式和海报感，不重新设计产品。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDetailImagePrompt(input: {
  blueprintPrompt: string;
  title: string;
  subtitle: string;
  layout: string;
  language?: string;
  textMode: "editable-layers" | "image-text";
  protection?: Partial<ProductProtectionSettings>;
}) {
  const isChinese = input.language?.includes("中文");
  const languageName = input.language?.includes("俄文")
    ? "Russian"
    : input.language?.includes("葡语")
      ? "Brazilian Portuguese"
      : input.language?.includes("西语")
        ? "Mexican Spanish"
        : input.language?.includes("英文")
          ? "English"
          : "the selected output language";
  const textPolicy =
    input.textMode === "editable-layers"
      ? "Editable text layer mode is ON. Do not render any readable text inside the image: no titles, no captions, no labels, no bullet text, no Chinese characters, no random letters, no mojibake. Generate only the product, background, blank information cards, icons, layout blocks, and empty safe areas for frontend HTML text overlay."
      : isChinese
        ? "Image-text mode is ON. Visible text may be generated, but it must be clean Chinese only and must avoid typos."
        : `Image-text mode is ON. Any visible text must be natural ${languageName} only. Absolutely no Chinese characters or Chinese labels. Translate all source copy to ${languageName}.`;

  return [
    "Ecommerce detail image generation.",
    buildProductProtectionPrompt(input.protection),
    input.blueprintPrompt,
    `Output language: ${input.language || "selected language"}`,
    `Text-layer title reference only: ${input.title}`,
    `Text-layer subtitle reference only: ${input.subtitle}`,
    `Layout: ${input.layout}`,
    textPolicy,
  ].join("\n");
}

export function buildPosterPrompt(input: {
  productName: string;
  title: string;
  subtitle: string;
  campaignInfo: string;
  posterType: string;
  style: string;
  ratio: Ratio;
  protection?: Partial<ProductProtectionSettings>;
  platformPrompt?: string;
}) {
  return [
    "产品海报工作流。",
    buildProductProtectionPrompt(input.protection),
    `产品名称：${input.productName || "根据上传产品图判断"}`,
    `主标题：${input.title}`,
    `副标题：${input.subtitle}`,
    `活动信息：${input.campaignInfo}`,
    `海报类型：${input.posterType}`,
    `风格：${input.style}`,
    `比例：${input.ratio}`,
    input.platformPrompt,
    "只改变背景、光影、排版、标题区和装饰元素，支持后期可编辑文字层。",
  ]
    .filter(Boolean)
    .join("\n");
}
