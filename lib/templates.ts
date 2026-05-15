import type { Ratio, StyleKey } from "@/lib/workflow";

export const ecommercePromptTemplates = [
  {
    id: "hero-product",
    name: "电商产品主图",
    prompt:
      "一款高端无线耳机的电商主图，产品居中，干净背景，柔和阴影，突出材质、轮廓和精致细节，适合天猫、京东、Shopify 商品页。",
  },
  {
    id: "lifestyle-cover",
    name: "小红书封面",
    prompt:
      "小红书风格护肤产品封面图，主视觉清爽高级，产品与生活方式道具自然组合，预留标题区域，适合种草内容封面。",
  },
  {
    id: "tech-launch",
    name: "科技产品海报",
    prompt:
      "AI 智能硬件新品发布海报，产品悬浮在深色空间中，蓝白光效，未来科技感，中心构图，适合发布会主视觉。",
  },
  {
    id: "premium-packshot",
    name: "高级质感主图",
    prompt:
      "高端香氛产品商业主图，玻璃瓶身、金属瓶盖、柔和高光、浅色背景，画面干净克制，突出高级感。",
  },
] as const;

export const detailTemplates = [
  { id: "core-selling-point", name: "核心卖点图" },
  { id: "function-display", name: "功能展示图" },
  { id: "specification", name: "参数说明图" },
  { id: "material-craft", name: "材质工艺图" },
  { id: "detail-zoom", name: "细节放大图" },
  { id: "scene-application", name: "场景应用图" },
  { id: "advantage-comparison", name: "对比优势图" },
  { id: "size-guide", name: "尺寸说明图" },
  { id: "package-list", name: "包装清单图" },
] as const;

export const posterTypes = ["促销", "活动", "节日", "上新", "品牌"] as const;
export const posterStyles = ["科技感", "高级感", "极简", "清新", "节日氛围"] as const;

export const mimicTypes = ["产品图", "详情图", "海报图"] as const;
export const mimicDimensions = [
  "模仿风格",
  "模仿构图",
  "模仿排版",
  "模仿色调",
  "模仿氛围",
  "模仿材质表现",
] as const;
export const mimicStrengths = ["低", "中", "高"] as const;
export const mimicCounts = [1, 2, 4] as const;

export const ecommercePlatforms = [
  {
    id: "general",
    name: "通用电商",
    prompt:
      "平台用途：通用电商。画面要适合商品主图、详情页、活动海报和站外投放，主体清晰，信息克制，商业感强。",
  },
  {
    id: "mercado",
    name: "美客多",
    prompt:
      "平台用途：美客多 Mercado Libre。适合拉美电商展示，产品主体突出，背景干净明亮，卖点表达直观，避免过度奢华和复杂小字。",
  },
  {
    id: "amazon",
    name: "亚马逊",
    prompt:
      "平台用途：Amazon。适合亚马逊商品图和A+内容，产品准确可信，主图倾向干净白底或浅色背景，避免水印、夸张促销贴纸和误导性元素。",
  },
  {
    id: "ozon",
    name: "欧众",
    prompt:
      "平台用途：欧众/Ozon跨境电商。适合商品卡片、详情模块和促销图，构图清晰，产品识别度高，信息区域规整，适合多语言后期排版。",
  },
  {
    id: "wb_ozon",
    name: "WB/OZON",
    prompt:
      "平台用途：WB/OZON跨境电商。适合商品卡片、详情模块和促销图，构图清晰，产品识别度高，信息区域规整，适合多语言后期排版。",
  },
  {
    id: "tiktok",
    name: "TIKTOK",
    prompt:
      "平台用途：TikTok Shop。画面要有强停留感和短视频封面感，产品主体醒目，卖点直观，适合移动端信息流和直播间商品展示。",
  },
  {
    id: "douyin",
    name: "抖音",
    prompt:
      "平台用途：抖音电商。画面要适合移动端种草、直播间和短视频封面，视觉冲击明确，产品利益点清楚，氛围年轻但不要杂乱。",
  },
  {
    id: "tmall",
    name: "天猫",
    prompt:
      "平台用途：天猫。适合品牌旗舰店商品主图、详情页和活动图，画面高级、干净、可信，突出品牌感和产品质感。",
  },
  {
    id: "jd",
    name: "京东",
    prompt:
      "平台用途：京东。适合高转化商品主图和详情模块，产品清晰可信，信息表达直接，强调品质、参数、功能和购买理由。",
  },
] as const;

export type DetailTemplateId = (typeof detailTemplates)[number]["id"];
export type PosterType = (typeof posterTypes)[number];
export type PosterStyle = (typeof posterStyles)[number];
export type MimicType = (typeof mimicTypes)[number];
export type MimicDimension = (typeof mimicDimensions)[number];
export type MimicStrength = (typeof mimicStrengths)[number];
export type EcommercePlatformId = (typeof ecommercePlatforms)[number]["id"];

export const ratioToSize: Record<
  Ratio,
  | "1024x1024"
  | "1024x1536"
  | "1536x1024"
  | "1464x600"
  | "1464x625"
  | "600x450"
  | "463x625"
  | "1200x1500"
  | "1600x1600"
> = {
  "1:1": "1024x1024",
  "3:4": "1024x1536",
  "4:5": "1024x1536",
  "9:16": "1024x1536",
  "16:9": "1536x1024",
  "1464:600": "1464x600",
  "1464:625": "1464x625",
  "600:450": "600x450",
  "463:625": "463x625",
  "1200:1500": "1200x1500",
  "1600:1600": "1600x1600",
};

export function platformPrompt(platformId: EcommercePlatformId) {
  return (
    ecommercePlatforms.find((platform) => platform.id === platformId)?.prompt ||
    ecommercePlatforms[0].prompt
  );
}

export const workflowStyleToPreset: Record<string, StyleKey> = {
  科技感: "tech",
  高级感: "luxury",
  极简: "minimalEcommerce",
  清新: "realistic",
  节日氛围: "poster",
};
