import { styleLabels, stylePresets, type Ratio, type StyleKey } from "@/lib/workflow";
import type {
  DetailTemplateId,
  MimicDimension,
  MimicStrength,
  MimicType,
  PosterStyle,
  PosterType,
} from "@/lib/templates";
import { detailTemplates } from "@/lib/templates";

const detailPromptMap: Record<DetailTemplateId, string> = {
  "core-selling-point":
    "核心卖点图：突出最重要的 1-3 个产品优势，画面要有强视觉焦点和清晰的信息层级。",
  "function-display":
    "功能展示图：用电商详情页方式呈现功能场景、功能图标感和使用效果。",
  specification:
    "参数说明图：以整洁技术参数板式呈现产品规格，文字区域留白清晰。",
  "material-craft":
    "材质工艺图：突出材质纹理、工艺细节、微距质感和高级商业摄影光线。",
  "detail-zoom":
    "细节放大图：用局部特写和放大框表达产品细节，画面清晰可信。",
  "scene-application":
    "场景应用图：把产品放在真实使用场景中，体现生活方式和购买想象。",
  "advantage-comparison":
    "对比优势图：用克制的左右对比或分区结构表达产品优势，避免夸张杂乱。",
  "size-guide":
    "尺寸说明图：呈现产品尺寸、比例和空间关系，画面干净，便于理解。",
  "package-list":
    "包装清单图：展示产品、配件和包装内容，排列整齐，适合详情页末屏。",
};

export function buildTextPrompt({
  prompt,
  style,
  ratio,
}: {
  prompt: string;
  style: StyleKey;
  ratio: Ratio;
}) {
  return [
    prompt.trim(),
    `风格预设：${styleLabels[style]}。${stylePresets[style]}`,
    `画面比例：${ratio}。`,
    "请生成适合电商设计使用的商业图片，产品主体清晰，构图高级，光线干净，适合商品主图、封面图或营销海报。",
    "避免水印、乱码文字、低清晰度、产品变形、杂乱背景和廉价感。",
  ].join("\n");
}

export function buildMimicPrompt({
  productName,
  sellingPoints,
  extraRequirements,
  outputType,
  dimensions,
  strength,
  ratio,
}: {
  productName: string;
  sellingPoints: string;
  extraRequirements: string;
  outputType: MimicType;
  dimensions: MimicDimension[];
  strength: MimicStrength;
  ratio: Ratio;
}) {
  const strengthMap: Record<MimicStrength, string> = {
    低: "低强度借鉴：只吸收参考图的大方向，不明显接近原图。",
    中: "中等强度借鉴：保留参考图的视觉结构和气质，但内容必须重新生成。",
    高: "高强度借鉴：更接近参考图的风格、构图和视觉节奏，但不要复制原图内容、文案或品牌元素。",
  };

  const typeMap: Record<MimicType, string> = {
    产品图:
      "生成类型：电商产品主图。主体产品要占据视觉中心，背景干净，适合商品列表、首图和广告投放。",
    详情图:
      "生成类型：电商详情图。画面要有清晰模块化信息结构，适合展示卖点、功能、材质和使用场景。",
    海报图:
      "生成类型：商业海报图。画面要有强视觉冲击、品牌感和营销氛围，适合活动、上新、促销和社媒传播。",
  };

  return [
    "你正在执行“参考图模仿生图”电商设计工作流。",
    "输入图片角色必须严格区分：",
    "1. 参考图：只用于参考风格、构图、排版、色调、氛围、材质表现等视觉方法。",
    "2. 产品图：作为新画面的产品主体来源，保持产品主体清晰、真实、完整、可信。",
    "请生成新的商业图片，不要直接照搬参考图内容，不要复制参考图里的文案、Logo、人物、品牌元素或具体商品。",
    typeMap[outputType],
    `产品名称：${productName || "未填写，请根据产品图主体判断"}`,
    `卖点描述：${sellingPoints || "突出产品质感、使用价值和电商转化力"}`,
    `补充要求：${extraRequirements || "保持高级、干净、适合电商展示"}`,
    `模仿维度：${dimensions.length ? dimensions.join("、") : "模仿风格、模仿构图、模仿色调"}`,
    `模仿强度：${strength}。${strengthMap[strength]}`,
    `输出比例：${ratio}。`,
    "最终画面要求：产品主体清晰，质感高级，适合电商展示，有明确视觉重点，商业摄影/商业设计级完成度。",
    "负面要求：不要低清、不要畸变、不要脏乱背景、不要错别字、不要水印、不要直接复制参考图文案。",
  ].join("\n");
}

export function buildDetailPrompt({
  productName,
  sellingPoints,
  templateId,
  ratio,
}: {
  productName: string;
  sellingPoints: string;
  templateId: DetailTemplateId;
  ratio: Ratio;
}) {
  const template = detailTemplates.find((item) => item.id === templateId);

  return [
    "你正在为电商详情页生成单屏详情图。",
    `详情图模板：${template?.name || "核心卖点图"}。`,
    detailPromptMap[templateId],
    `产品名称：${productName || "未填写，请根据产品图主体判断"}`,
    `卖点信息：${sellingPoints || "突出产品核心优势、使用价值和购买理由"}`,
    `输出比例：${ratio}。`,
    "画面要求：高级极简、信息层级清晰、产品主体可信、适合天猫/京东/Shopify 详情页。",
    "不要生成难以阅读的小字，不要乱码，不要堆砌元素，不要廉价促销感。",
  ].join("\n");
}

export function buildPosterPrompt({
  productName,
  title,
  subtitle,
  posterType,
  posterStyle,
  ratio,
}: {
  productName: string;
  title: string;
  subtitle: string;
  posterType: PosterType;
  posterStyle: PosterStyle;
  ratio: Ratio;
}) {
  return [
    "你正在为电商营销生成商业海报。",
    `海报类型：${posterType}。`,
    `海报风格：${posterStyle}。`,
    `产品名称：${productName || "未填写，请根据产品图主体判断"}`,
    `主标题：${title || "保留醒目的标题区域，不要生成乱码文字"}`,
    `副标题：${subtitle || "保留副标题区域，画面信息克制"}`,
    `输出比例：${ratio}。`,
    "请以产品图为主体，Logo 只作为品牌标识参考。生成高级商业海报，构图有冲击力，产品清晰，背景和光影服务于营销氛围。",
    "避免直接生成错误文字。可预留标题区域或生成清晰短标题感，不要水印、乱码、变形产品。",
  ].join("\n");
}
