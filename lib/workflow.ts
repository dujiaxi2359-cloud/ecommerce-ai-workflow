import { createId } from "@/lib/id";

export const stylePresets = {
  realistic:
    "photorealistic commercial photography, natural light, refined texture, premium visual detail",
  minimalEcommerce:
    "minimal ecommerce product image, clean studio background, crisp shadows, conversion-focused composition",
  tech:
    "futuristic technology aesthetic, precise lighting, sleek materials, cinematic depth, high-end product launch mood",
  poster:
    "bold poster design, strong hierarchy, expressive composition, editorial color rhythm, eye-catching visual impact",
  luxury:
    "luxury premium aesthetic, understated elegance, refined palette, delicate lighting, high-end brand campaign style",
} as const;

export const styleLabels: Record<keyof typeof stylePresets, string> = {
  realistic: "写实",
  minimalEcommerce: "极简电商",
  tech: "科技感",
  poster: "海报风",
  luxury: "高级感",
};

export const ratios = [
  "1:1",
  "3:4",
  "4:5",
  "9:16",
  "16:9",
  "1464:600",
  "1464:625",
  "600:450",
  "463:625",
  "1200:1500",
  "1600:1600",
] as const;
export const sizes = [
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1464x600",
  "1464x625",
  "600x450",
  "463x625",
  "1200x1500",
  "1600x1600",
  "1200x1600",
  "1024x1792",
  "1792x1024",
  "1952x800",
  "1600x1200",
  "2928x1250",
  "1482x2000",
] as const;
export const qualities = ["low", "medium", "high"] as const;
export const qualityLabels: Record<(typeof qualities)[number], string> = {
  low: "快速",
  medium: "标准",
  high: "精细",
};

export type StyleKey = keyof typeof stylePresets;
export type Ratio = (typeof ratios)[number];
export type ImageSize = (typeof sizes)[number];
export type ImageQuality = (typeof qualities)[number];

export function buildFinalPrompt(prompt: string, style: StyleKey, ratio: Ratio) {
  return [
    prompt.trim(),
    `Style preset: ${stylePresets[style]}.`,
    `Aspect ratio: ${ratio}.`,
    "Create a polished image suitable for posters, product visuals, ecommerce listings, social covers, or campaign creative. Avoid watermarks, broken text, low-resolution artifacts, and distorted products.",
  ].join("\n");
}

export const promptTemplates = [
  {
    id: "ecommerce-product",
    name: "电商产品图",
    prompt:
      "一款高端无线耳机的电商主图，产品居中，白色干净背景，柔和阴影，突出金属质感和精致细节，适合天猫和 Shopify 商品页",
  },
  {
    id: "xiaohongshu-cover",
    name: "小红书封面",
    prompt:
      "小红书风格美妆护肤封面图，主视觉是精华瓶和花瓣水光质感，画面清爽高级，预留标题区域，适合生活方式内容封面",
  },
  {
    id: "tech-poster",
    name: "科技产品海报",
    prompt:
      "一款 AI 智能硬件新品发布海报，产品悬浮在深色空间中，蓝白光效，未来科技感，强烈中心构图，适合发布会主视觉",
  },
  {
    id: "portrait-id",
    name: "人像证件照",
    prompt:
      "专业人像证件照，正面半身，干净浅灰背景，自然肤色，柔和均匀布光，商务、可信、清晰，真实摄影质感",
  },
  {
    id: "game-character",
    name: "游戏角色海报",
    prompt:
      "幻想游戏角色海报，一位身穿精致铠甲的英雄角色，动态姿态，电影级灯光，丰富服装细节，史诗氛围，适合游戏宣发图",
  },
] as const;

const fallbackPalettes: Record<StyleKey, [string, string, string]> = {
  realistic: ["#f4f0e8", "#202020", "#b8a78d"],
  minimalEcommerce: ["#f8f7f2", "#151515", "#d8d1c4"],
  tech: ["#eef5ff", "#08111f", "#2563eb"],
  poster: ["#fff4e6", "#151515", "#ef4444"],
  luxury: ["#f6f2e8", "#111111", "#b99d62"],
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(value: string, maxLength = 18) {
  const text = value.trim().replace(/\s+/g, " ");
  const lines: string[] = [];

  for (let index = 0; index < text.length; index += maxLength) {
    lines.push(text.slice(index, index + maxLength));
  }

  return lines.slice(0, 7);
}

export function createFallbackImages({
  prompt,
  style,
  ratio,
  size,
  count,
}: {
  prompt: string;
  style: StyleKey;
  ratio: Ratio;
  size: ImageSize;
  count: number;
}) {
  const [width, height] = size.split("x").map(Number);
  const palette = fallbackPalettes[style];
  const lines = wrapText(prompt);

  return Array.from({ length: count }, (_, index) => {
    const yStart = Math.round(height * 0.36);
    const textLines = lines
      .map(
        (line, lineIndex) =>
          `<text x="${Math.round(width * 0.1)}" y="${
            yStart + lineIndex * 48
          }" font-size="34" font-weight="600" fill="${palette[1]}">${escapeXml(
            line,
          )}</text>`,
      )
      .join("");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${palette[0]}"/>
  <rect x="${Math.round(width * 0.06)}" y="${Math.round(
    height * 0.06,
  )}" width="${Math.round(width * 0.88)}" height="${Math.round(
    height * 0.88,
  )}" fill="none" stroke="${palette[2]}" stroke-width="4"/>
  <circle cx="${Math.round(width * 0.78)}" cy="${Math.round(
    height * 0.2,
  )}" r="${Math.round(Math.min(width, height) * 0.12)}" fill="${palette[2]}" opacity="0.18"/>
  <text x="${Math.round(width * 0.1)}" y="${Math.round(
    height * 0.16,
  )}" font-size="24" fill="${palette[2]}" font-weight="700">LOCAL PREVIEW ${index + 1}</text>
  <text x="${Math.round(width * 0.1)}" y="${Math.round(
    height * 0.24,
  )}" font-size="42" fill="${palette[1]}" font-weight="800">${escapeXml(styleLabels[style])} · ${ratio}</text>
  ${textLines}
  <text x="${Math.round(width * 0.1)}" y="${Math.round(
    height * 0.88,
  )}" font-size="22" fill="${palette[1]}" opacity="0.55">OpenAI connection unavailable. This is an offline workflow preview.</text>
</svg>`;

    return {
      id: createId("fallback"),
      index,
      url: `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString(
        "base64",
      )}`,
    };
  });
}
