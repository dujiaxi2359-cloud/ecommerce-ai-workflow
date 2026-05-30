import type { DetailPlatform } from "@/types/detail";

export type PlatformRule = {
  id: string;
  name: DetailPlatform;
  marketHint: string;
  defaultCount: number;
  targetSize: { width: number; height: number; label: string };
  alternateSizes: Array<{ width: number; height: number; label: string }>;
  structure: string[];
  rules: string[];
  promptHint: string;
};

export const platformRules: PlatformRule[] = [
  {
    id: "amazon",
    name: "Amazon / 亚马逊",
    marketHint: "美国",
    defaultCount: 9,
    targetSize: { width: 2000, height: 2000, label: "详情图 2000x2000" },
    alternateSizes: [
      { width: 970, height: 300, label: "A+ 横幅 970x300" },
      { width: 970, height: 600, label: "A+ 横幅 970x600" },
      { width: 1464, height: 600, label: "A+ 横幅 1464x600" },
    ],
    structure: ["封面主卖点", "产品整体展示", "核心功能 1", "核心功能 2", "细节特写", "参数说明", "使用场景", "对比优势", "购买理由"],
    rules: ["白底或浅灰背景优先", "信息图表达可信克制", "避免夸张促销词", "保留可编辑文案层空间"],
    promptHint: "适合 Amazon 商品详情图和 A+ 信息图，主体清晰、参数可信、信息层级规整，不要过度贴边。",
  },
  {
    id: "tiktok",
    name: "TikTok Shop",
    marketHint: "东南亚",
    defaultCount: 6,
    targetSize: { width: 1000, height: 1000, label: "详情图 1000x1000" },
    alternateSizes: [{ width: 1080, height: 1920, label: "移动封面 1080x1920" }],
    structure: ["产品封面", "核心卖点", "使用场景", "功能演示", "细节证明", "行动理由"],
    rules: ["移动端第一眼可读", "主视觉强", "卖点表达直接", "保留标题区域"],
    promptHint: "适合 TikTok Shop 商品图，移动端浏览，产品醒目，标题区和利益点区域清晰。",
  },
  {
    id: "shopee",
    name: "Shopee",
    marketHint: "东南亚",
    defaultCount: 6,
    targetSize: { width: 1024, height: 1024, label: "详情图 1024x1024" },
    alternateSizes: [],
    structure: ["产品封面", "核心卖点", "功能说明", "细节展示", "使用场景", "收口图"],
    rules: ["信息直接", "色彩干净", "商品识别度高", "适合方图详情模块"],
    promptHint: "适合 Shopee 商品详情，方图构图，卖点卡片清晰，视觉不要拥挤。",
  },
  {
    id: "lazada",
    name: "Lazada",
    marketHint: "东南亚",
    defaultCount: 6,
    targetSize: { width: 1200, height: 1200, label: "详情图 1200x1200" },
    alternateSizes: [],
    structure: ["产品封面", "核心卖点", "功能信息", "材质细节", "场景展示", "购买理由"],
    rules: ["主体明确", "信息分区清楚", "适合东南亚电商", "保留后期文案区"],
    promptHint: "适合 Lazada 详情图，产品清晰，卖点信息块规整，背景干净明亮。",
  },
  {
    id: "mercado",
    name: "Mercado Libre / 美客多",
    marketHint: "墨西哥",
    defaultCount: 6,
    targetSize: { width: 1200, height: 1200, label: "详情图 1200x1200" },
    alternateSizes: [{ width: 1200, height: 1540, label: "竖版详情 1200x1540" }],
    structure: ["产品封面", "核心优势", "细节展示", "参数说明", "场景应用", "信任收口"],
    rules: ["清晰明亮", "避免复杂小字", "转化信息直观", "适合拉美市场"],
    promptHint: "适合 Mercado Libre 拉美电商，明亮可信，产品主体突出，卖点直观。",
  },
  {
    id: "ozon",
    name: "Ozon",
    marketHint: "欧洲",
    defaultCount: 6,
    targetSize: { width: 1200, height: 1600, label: "详情图 1200x1600" },
    alternateSizes: [{ width: 1000, height: 1000, label: "主图 1000x1000" }],
    structure: ["产品封面", "功能卖点", "参数信息", "细节特写", "使用场景", "包装/收口"],
    rules: ["俄语市场信息图", "竖版信息层级", "产品主体清楚", "后期文字区规整"],
    promptHint: "适合 Ozon 竖版详情页，信息区分层明确，产品识别度高，适合俄语后期排版。",
  },
  {
    id: "wildberries",
    name: "Wildberries / WB",
    marketHint: "欧洲",
    defaultCount: 6,
    targetSize: { width: 900, height: 1200, label: "详情图 900x1200" },
    alternateSizes: [],
    structure: ["产品封面", "核心卖点", "功能说明", "细节展示", "场景展示", "购买理由"],
    rules: ["竖版商品展示", "信息简洁", "主体突出", "适合移动端"],
    promptHint: "适合 Wildberries 竖版详情图，主体突出，卡片留白清楚，信息不要过密。",
  },
  {
    id: "tmall",
    name: "天猫",
    marketHint: "中国",
    defaultCount: 6,
    targetSize: { width: 790, height: 1200, label: "详情图 790x1200" },
    alternateSizes: [],
    structure: ["产品首屏", "核心卖点", "材质工艺", "细节展示", "场景应用", "品牌收口"],
    rules: ["品牌感", "竖版详情", "质感表达", "文案区克制"],
    promptHint: "适合天猫详情页，竖版高级品牌视觉，突出质感和购买理由。",
  },
  {
    id: "jd",
    name: "京东",
    marketHint: "中国",
    defaultCount: 6,
    targetSize: { width: 790, height: 1200, label: "详情图 790x1200" },
    alternateSizes: [],
    structure: ["产品首屏", "品质卖点", "参数说明", "功能展示", "细节证明", "收口图"],
    rules: ["品质可信", "参数清楚", "转化直接", "结构理性"],
    promptHint: "适合京东详情页，强调品质、参数、功能和可信购买理由。",
  },
  {
    id: "douyin",
    name: "抖音电商",
    marketHint: "中国",
    defaultCount: 6,
    targetSize: { width: 1000, height: 1000, label: "商品详情图 1000x1000" },
    alternateSizes: [{ width: 1080, height: 1920, label: "内容封面 1080x1920" }],
    structure: ["产品封面", "爆点卖点", "场景演示", "功能证明", "细节展示", "转化收口"],
    rules: ["移动端", "主视觉强", "标题空间明显", "不要杂乱"],
    promptHint: "适合抖音电商移动端详情与内容封面，竖版/方图都要有强主视觉和标题区。",
  },
  {
    id: "xiaohongshu",
    name: "小红书电商 / 内容电商",
    marketHint: "中国",
    defaultCount: 6,
    targetSize: { width: 1080, height: 1350, label: "内容详情 1080x1350" },
    alternateSizes: [{ width: 1080, height: 1440, label: "内容详情 1080x1440" }],
    structure: ["封面吸引", "产品亮点", "场景种草", "细节体验", "使用建议", "收藏理由"],
    rules: ["封面感", "生活方式", "视觉吸引力", "适合内容电商"],
    promptHint: "适合小红书内容封面和种草详情，视觉更吸引，保留标题和笔记感信息区域。",
  },
  {
    id: "general",
    name: "通用电商",
    marketHint: "中国",
    defaultCount: 6,
    targetSize: { width: 1000, height: 1000, label: "默认详情图 1000x1000" },
    alternateSizes: [{ width: 1080, height: 1350, label: "4:5 详情 1080x1350" }],
    structure: ["产品封面", "核心卖点", "细节展示", "参数信息", "使用场景", "收口图"],
    rules: ["主体清晰", "卖点明确", "可编辑文案区", "适合多平台复用"],
    promptHint: "通用电商详情图，规则标准化但视觉由提示词驱动，主体清晰，信息层级明确。",
  },
  {
    id: "independent",
    name: "独立站",
    marketHint: "美国",
    defaultCount: 6,
    targetSize: { width: 1200, height: 1600, label: "详情图 1200x1600" },
    alternateSizes: [{ width: 1600, height: 1600, label: "品牌方图 1600x1600" }],
    structure: ["品牌首屏", "产品价值", "功能细节", "场景故事", "参数说明", "品牌收口"],
    rules: ["品牌落地页", "高级留白", "叙事感", "转化模块清晰"],
    promptHint: "适合 Shopify/独立站产品落地页，品牌感更强，留白高级，适合后期排版。",
  },
];

export const detailPlatformOptions = platformRules.map((item) => item.name);

export function getPlatformRule(platform: string) {
  return (
    platformRules.find((item) => item.name === platform) ||
    platformRules.find((item) => item.id === platform) ||
    platformRules[platformRules.length - 2]
  );
}

