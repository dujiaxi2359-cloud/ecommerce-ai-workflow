import type { PromptEnhancerInput } from "@/lib/promptEnhancer/promptEnhancerTypes";
import { getPlatformRule } from "@/lib/templates/platformRules";

function compact(value?: string) {
  return value?.trim() || "";
}

export function buildPromptEnhancement(input: PromptEnhancerInput) {
  const platform = getPlatformRule(input.platform || "通用电商");
  const size =
    input.targetWidth && input.targetHeight
      ? `${input.targetWidth}x${input.targetHeight}`
      : platform.targetSize.label;
  const textPolicy =
    input.textMode === "image-text"
      ? "可生成少量清晰文字，但必须符合输出语言，避免错字、乱码和无意义字符。"
      : "图片内不要直接生成可读文字，保留干净信息卡片、标题区和后期可编辑文案层。";

  return [
    compact(input.userPrompt) || "围绕产品核心卖点生成专业电商视觉。",
    "",
    `工作流：${input.workflowType || "电商设计图"}`,
    `平台适配：${platform.name}，目标市场 ${input.market || platform.marketHint}，输出语言 ${input.language || "按用户选择"}。`,
    `目标导出规格：${size}。${platform.promptHint}`,
    `产品信息：${input.productName || "根据上传产品图判断"}；品类：${input.category || "未填写"}；品牌：${input.brandName || "未填写"}。`,
    `核心卖点：${compact(input.sellingPoints) || "突出产品功能价值、材质质感、使用场景和购买理由。"}。`,
    compact(input.parameters) ? `参数表达：${input.parameters}。` : "参数表达：用分区卡片或留白区域承载参数信息，避免密集小字。",
    compact(input.materialInfo) ? `材质/工艺：${input.materialInfo}。` : "材质/工艺：突出真实纹理、边缘清晰度、光影层次和可信商业质感。",
    `视觉表达：主体位置明确，不要过度贴边；构图有主次层级；保留标题区、卖点区和信息分层；适合移动端和详情页浏览。`,
    `内容结构：根据平台默认套图结构组织画面，突出封面、核心卖点、功能细节、参数说明、场景和购买理由。`,
    `技术要求：清晰锐利、无水印、无乱码、无低清像素感、产品不变形；${textPolicy}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildEnhancementNotes(input: PromptEnhancerInput) {
  const platform = getPlatformRule(input.platform || "通用电商");
  return [
    `已按 ${platform.name} 平台规则补充构图、信息层级和导出尺寸要求。`,
    "已加入产品主体清晰、留白、可编辑文案层和信息分区要求。",
    "已将风格控制转为提示词描述，不依赖重型固定风格预设。",
    input.targetWidth && input.targetHeight
      ? `已读取目标尺寸 ${input.targetWidth}x${input.targetHeight}。`
      : `已使用平台默认尺寸 ${platform.targetSize.label}。`,
  ];
}

