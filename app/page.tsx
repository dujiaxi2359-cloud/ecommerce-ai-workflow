"use client";

import {
  Download,
  FileImage,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  buildDetailPrompt,
  buildMimicPrompt,
  buildPosterPrompt,
  buildTextPrompt,
} from "@/lib/prompt-builders";
import { createId } from "@/lib/id";
import { getHistoryImages, saveHistoryImages } from "@/lib/client-image-store";
import {
  detailTemplates,
  ecommercePlatforms,
  ecommercePromptTemplates,
  mimicCounts,
  mimicDimensions,
  mimicStrengths,
  mimicTypes,
  posterStyles,
  posterTypes,
  ratioToSize,
  platformPrompt,
  type DetailTemplateId,
  type EcommercePlatformId,
  type MimicDimension,
  type MimicStrength,
  type MimicType,
  type PosterStyle,
  type PosterType,
} from "@/lib/templates";
import { ecommerceStylePresets } from "@/lib/templates/stylePresets";
import { platformPresets } from "@/lib/templates/platformPresets";
import { productVariantOutputTypes, productVariantStyles } from "@/lib/templates/productVariantStyles";
import type { DetailBlueprintInput, DetailBlueprintItem, DetailLanguage, DetailMarket, DetailPlatform } from "@/types/detail";
import { defaultProductProtection, type ProductProtectionLevel } from "@/types/workflow";
import {
  qualities,
  qualityLabels,
  ratios,
  sizes,
  styleLabels,
  type ImageQuality,
  type ImageSize,
  type Ratio,
  type StyleKey,
} from "@/lib/workflow";
import { loadUserApiKey, saveUserApiKey, clearUserApiKey } from "@/lib/apiKey/userApiKey";
import { maskApiKey } from "@/lib/apiKey/maskApiKey";
import { hasFeatureAccess } from "@/lib/license/featureAccess";
import { loadLicenseCode, saveLicenseCode } from "@/lib/license/licenseStorage";
import type { FeatureKey, LicenseStatus } from "@/lib/license/licenseTypes";
import { workflowRegistry } from "@/lib/workflows/workflowRegistry";
import type { WorkflowId } from "@/lib/workflows/workflowTypes";

type TabKey = "text" | "mimic" | "product" | "variant" | "detail" | "poster";

const workflowTabMap: Record<WorkflowId, TabKey> = {
  "text-image": "text",
  "reference-mimic": "mimic",
  "product-workflow": "product",
  "product-variant": "variant",
  "detail-workflow": "detail",
  "poster-workflow": "poster",
};

const tabFeatureMap: Record<TabKey, FeatureKey> = {
  text: "text-image",
  mimic: "reference-mimic",
  product: "product-workflow",
  variant: "product-variant",
  detail: "detail-batch",
  poster: "poster",
};

const workflowTabItems = workflowRegistry.map((workflow) => ({
  ...workflow,
  tab: workflowTabMap[workflow.id],
}));

type GeneratedImage = {
  id: string;
  url: string;
  index: number;
};

type HistoryItem = {
  id: string;
  workflow: string;
  title: string;
  finalPrompt: string;
  createdAt: string;
  outputType?: string;
  referenceThumb?: string;
  productThumb?: string;
  imageCount?: number;
};

type ServerLogEntry = {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  scope: string;
  message: string;
  detail?: string;
};

const historyKey = "ecommerce-image-workflow-history-v2";
const showWorkflowInternals = true;
const hiddenPromptText = "工作流内部提示词已隐藏。";

const emptyLicenseStatus: LicenseStatus = {
  valid: false,
  code: "",
  features: [],
  message: "当前未激活授权码",
};

function normalizeClientLicenseCode(code: string) {
  return code.trim().replace(/\s+/g, "").toUpperCase();
}

function getClientFallbackLicense(code: string): LicenseStatus | null {
  const normalizedCode = normalizeClientLicenseCode(code);
  const proFeatures: FeatureKey[] = [
    "text-image",
    "reference-mimic",
    "product-workflow",
    "product-variant",
    "detail-single",
    "detail-batch",
    "poster",
    "export",
  ];

  if (/^EXP-AI-[A-Z0-9]{4}-2026$/.test(normalizedCode)) {
    return {
      valid: true,
      code: normalizedCode,
      planId: "pro",
      features: proFeatures,
      expiresAt: "2026-05-21T23:59:59+08:00",
      message: "PRO license activated.",
    };
  }

  if (["STUDIO-2026", "AI2026", "AIGC2026", "STUDIO"].includes(normalizedCode)) {
    return {
      valid: true,
      code: normalizedCode,
      planId: "studio",
      features: ["all"],
      message: "STUDIO license activated.",
    };
  }

  return null;
}

async function verifyLicenseOnServer(code: string): Promise<LicenseStatus> {
  const normalizedCode = normalizeClientLicenseCode(code);
  if (!normalizedCode) {
    return emptyLicenseStatus;
  }

  try {
    const response = await fetch("/api/license/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: normalizedCode }),
    });
    const payload = (await response.json().catch(() => null)) as LicenseStatus | null;
    if (payload && typeof payload.valid === "boolean") {
      if (!payload.valid) {
        return getClientFallbackLicense(normalizedCode) || payload;
      }
      return payload;
    }
  } catch {
    // Keep the UI stable when the license API is temporarily unavailable.
  }

  const fallbackLicense = getClientFallbackLicense(normalizedCode);
  if (fallbackLicense) {
    return fallbackLicense;
  }

  return {
    ...emptyLicenseStatus,
    code: normalizedCode,
    message: "授权服务暂时不可用，请稍后重试。",
  };
}

function withPlatform(value: string, platform: EcommercePlatformId) {
  return [value.trim(), platformPrompt(platform)].filter(Boolean).join("\n");
}

export default function Home() {
  const [hasMounted, setHasMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("text");
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(
    null,
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [logs, setLogs] = useState<ServerLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [downloadingHistoryId, setDownloadingHistoryId] = useState("");
  const [licenseCode, setLicenseCode] = useState("");
  const [licenseStatus, setLicenseStatus] =
    useState<LicenseStatus>(emptyLicenseStatus);
  const [userApiKey, setUserApiKey] = useState("");
  const [userBaseURL, setUserBaseURL] = useState("");

  const [textPrompt, setTextPrompt] = useState("");
  const [textStyle, setTextStyle] = useState<StyleKey>("minimalEcommerce");
  const [textRatio, setTextRatio] = useState<Ratio>("1:1");
  const [textSize, setTextSize] = useState<ImageSize>("1024x1024");
  const [textQuality, setTextQuality] = useState<ImageQuality>("low");
  const [textCount, setTextCount] = useState(1);
  const [textPlatform, setTextPlatform] =
    useState<EcommercePlatformId>("general");

  const [mimicReference, setMimicReference] = useState<File | null>(null);
  const [mimicProduct, setMimicProduct] = useState<File | null>(null);
  const [mimicReferencePreview, setMimicReferencePreview] = useState("");
  const [mimicProductPreview, setMimicProductPreview] = useState("");
  const [mimicReferenceThumb, setMimicReferenceThumb] = useState("");
  const [mimicProductThumb, setMimicProductThumb] = useState("");
  const [mimicProductName, setMimicProductName] = useState("");
  const [mimicSellingPoints, setMimicSellingPoints] = useState("");
  const [mimicExtra, setMimicExtra] = useState("");
  const [mimicType, setMimicType] = useState<MimicType>("产品图");
  const [mimicSelectedDimensions, setMimicSelectedDimensions] = useState<
    MimicDimension[]
  >(["模仿风格", "模仿构图", "模仿色调"]);
  const [mimicStrength, setMimicStrength] = useState<MimicStrength>("中");
  const [mimicRatio, setMimicRatio] = useState<Ratio>("1:1");
  const [mimicCount, setMimicCount] = useState(1);
  const [mimicQuality, setMimicQuality] = useState<ImageQuality>("low");
  const [mimicPlatform, setMimicPlatform] =
    useState<EcommercePlatformId>("general");
  const [mimicProtectionLevel, setMimicProtectionLevel] =
    useState<ProductProtectionLevel>("strict");

  const [productMain, setProductMain] = useState<File | null>(null);
  const [productMainPreview, setProductMainPreview] = useState("");
  const [productMainThumb, setProductMainThumb] = useState("");
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productPrompt, setProductPrompt] = useState("");
  const [productRatio, setProductRatio] = useState<Ratio>("1:1");
  const [productQuality, setProductQuality] = useState<ImageQuality>("high");
  const [productPlatform, setProductPlatform] =
    useState<EcommercePlatformId>("general");
  const [productProtectionLevel, setProductProtectionLevel] =
    useState<ProductProtectionLevel>("strict");

  const [variantProduct, setVariantProduct] = useState<File | null>(null);
  const [variantProductPreview, setVariantProductPreview] = useState("");
  const [variantProductThumb, setVariantProductThumb] = useState("");
  const [variantPrompt, setVariantPrompt] = useState("");
  const [variantOutputType, setVariantOutputType] = useState("电商主图");
  const [variantStyle, setVariantStyle] = useState("高级极简");
  const [variantRatio, setVariantRatio] = useState<Ratio>("1:1");
  const [variantCount, setVariantCount] = useState(1);
  const [variantQuality, setVariantQuality] = useState<ImageQuality>("low");
  const [variantPlatform, setVariantPlatform] =
    useState<EcommercePlatformId>("general");
  const [variantProtectionLevel, setVariantProtectionLevel] =
    useState<ProductProtectionLevel>("strict");

  const [detailProduct, setDetailProduct] = useState<File | null>(null);
  const [detailProductPreview, setDetailProductPreview] = useState("");
  const [detailProductThumb, setDetailProductThumb] = useState("");
  const [detailProductName, setDetailProductName] = useState("");
  const [detailCategory, setDetailCategory] = useState("");
  const [detailBrand, setDetailBrand] = useState("");
  const [detailSellingPoints, setDetailSellingPoints] = useState("");
  const [detailSpecs, setDetailSpecs] = useState("");
  const [detailMaterial, setDetailMaterial] = useState("");
  const [detailFunctions, setDetailFunctions] = useState("");
  const [detailPackageList, setDetailPackageList] = useState("");
  const [detailUseScenes, setDetailUseScenes] = useState("");
  const [detailAudience, setDetailAudience] = useState("");
  const [detailAfterSales, setDetailAfterSales] = useState("");
  const [detailVisualPrompt, setDetailVisualPrompt] = useState("");
  const [detailTemplate, setDetailTemplate] =
    useState<DetailTemplateId>("core-selling-point");
  const [detailRatio, setDetailRatio] = useState<Ratio>("4:5");
  const [detailQuality, setDetailQuality] = useState<ImageQuality>("low");
  const [detailPlatform, setDetailPlatform] =
    useState<EcommercePlatformId>("general");
  const [detailStep, setDetailStep] = useState(1);
  const [detailSetCount, setDetailSetCount] = useState(5);
  const [detailMarket, setDetailMarket] = useState<DetailMarket>("美国");
  const [detailLanguage, setDetailLanguage] = useState<DetailLanguage>("英文");
  const [detailWorkflowPlatform, setDetailWorkflowPlatform] =
    useState<DetailPlatform>("Amazon / 亚马逊");
  const [detailStyle, setDetailStyle] = useState("Amazon 专业信息图风");
  const [detailTextMode, setDetailTextMode] = useState<"editable-layers" | "image-text">("editable-layers");
  const [detailBlueprints, setDetailBlueprints] = useState<DetailBlueprintItem[]>([]);

  const [posterProduct, setPosterProduct] = useState<File | null>(null);
  const [posterLogo, setPosterLogo] = useState<File | null>(null);
  const [posterProductPreview, setPosterProductPreview] = useState("");
  const [posterLogoPreview, setPosterLogoPreview] = useState("");
  const [posterProductThumb, setPosterProductThumb] = useState("");
  const [posterLogoThumb, setPosterLogoThumb] = useState("");
  const [posterProductName, setPosterProductName] = useState("");
  const [posterTitle, setPosterTitle] = useState("");
  const [posterSubtitle, setPosterSubtitle] = useState("");
  const [posterCampaignInfo, setPosterCampaignInfo] = useState("");
  const [posterType, setPosterType] = useState<PosterType>("上新");
  const [posterStyle, setPosterStyle] = useState<PosterStyle>("高级感");
  const [posterRatio, setPosterRatio] = useState<Ratio>("4:5");
  const [posterQuality, setPosterQuality] = useState<ImageQuality>("low");
  const [posterPlatform, setPosterPlatform] =
    useState<EcommercePlatformId>("general");
  const [posterProtectionLevel, setPosterProtectionLevel] =
    useState<ProductProtectionLevel>("strict");

  const promptPreview = useMemo(() => {
    if (activeTab === "text") {
      return textPrompt
        ? buildTextPrompt({
            prompt: withPlatform(textPrompt, textPlatform),
            style: textStyle,
            ratio: textRatio,
          })
        : "";
    }

    if (activeTab === "mimic") {
      return buildMimicPrompt({
        productName: mimicProductName,
        sellingPoints: mimicSellingPoints,
        extraRequirements: withPlatform(mimicExtra, mimicPlatform),
        outputType: mimicType,
        dimensions: mimicSelectedDimensions,
        strength: mimicStrength,
        ratio: mimicRatio,
      });
    }

    if (activeTab === "product") {
      return [
        "产品图工作流",
        `产品：${productName || "根据上传产品图判断"}`,
        `品类：${productCategory || "未填写"}`,
        `提示词：${productPrompt || "生成干净高级的电商产品展示图，只改变背景、光影和排版。"}`,
        "仅锁定产品图主体，背景和视觉效果按提示词生成。",
        `保护等级：${productProtectionLevel}`,
        platformPrompt(productPlatform),
      ].join("\n");
    }

    if (activeTab === "variant") {
      return [
        "产品风格变体",
        variantPrompt || "同一产品多风格展示",
        `输出：${variantOutputType}`,
        `风格：${variantStyle}`,
        `保护等级：${variantProtectionLevel}`,
        platformPrompt(variantPlatform),
      ].join("\n");
    }

    if (activeTab === "detail") {
      return buildDetailPrompt({
        productName: detailProductName,
        sellingPoints: withPlatform(detailSellingPoints, detailPlatform),
        templateId: detailTemplate,
        ratio: detailRatio,
      });
    }

    return buildPosterPrompt({
      productName: posterProductName,
      title: posterTitle,
      subtitle: withPlatform(
        [posterSubtitle, posterCampaignInfo].filter(Boolean).join("\n"),
        posterPlatform,
      ),
      posterType,
      posterStyle,
      ratio: posterRatio,
    });
  }, [
    activeTab,
    textPrompt,
    textStyle,
    textRatio,
    textPlatform,
    mimicProductName,
    mimicSellingPoints,
    mimicExtra,
    mimicType,
    mimicSelectedDimensions,
    mimicStrength,
    mimicRatio,
    mimicPlatform,
    productName,
    productCategory,
    productPrompt,
    productProtectionLevel,
    productPlatform,
    variantPrompt,
    variantOutputType,
    variantStyle,
    variantProtectionLevel,
    variantPlatform,
    detailProductName,
    detailSellingPoints,
    detailTemplate,
    detailRatio,
    detailPlatform,
    posterProductName,
    posterTitle,
    posterSubtitle,
    posterCampaignInfo,
    posterType,
    posterStyle,
    posterRatio,
    posterPlatform,
  ]);

  useEffect(() => {
    let cancelled = false;
    setHasMounted(true);
    const storedLicense = loadLicenseCode();
    const storedApiKey = loadUserApiKey();
    setLicenseCode(storedLicense);
    setLicenseStatus(emptyLicenseStatus);
    if (storedLicense) {
      verifyLicenseOnServer(storedLicense).then((next) => {
        if (!cancelled) {
          setLicenseStatus(next);
        }
      });
    }
    setUserApiKey(storedApiKey.apiKey);
    setUserBaseURL(storedApiKey.baseURL || "");
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let localHistory: HistoryItem[] = [];

    const raw = localStorage.getItem(historyKey);
    if (raw) {
      try {
        localHistory = JSON.parse(raw) as HistoryItem[];
        setHistory(localHistory);
      } catch {
        localStorage.removeItem(historyKey);
      }
    }

    fetch("/api/history", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const sharedHistory = (payload.history || []) as HistoryItem[];
        const merged = mergeHistory(sharedHistory, localHistory);
        setHistory(merged);
        localStorage.setItem(historyKey, JSON.stringify(merged));
        syncLocalHistoryToServer(localHistory);
      })
      .catch(() => {
        if (localHistory.length) {
          setHistory(localHistory);
        }
        syncLocalHistoryToServer(localHistory);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      try {
        const response = await fetch("/api/logs", { cache: "no-store" });
        const payload = await response.json();
        if (!cancelled) {
          setLogs(payload.logs || []);
        }
      } catch {
        if (!cancelled) {
          setLogs([]);
        }
      }
    }

    loadLogs();
    const timer = window.setInterval(loadLogs, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isGenerating || !generationStartedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - generationStartedAt);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [generationStartedAt, isGenerating]);

  useFilePreview(mimicReference, setMimicReferencePreview, setMimicReferenceThumb);
  useFilePreview(mimicProduct, setMimicProductPreview, setMimicProductThumb);
  useFilePreview(productMain, setProductMainPreview, setProductMainThumb);
  useFilePreview(variantProduct, setVariantProductPreview, setVariantProductThumb);
  useFilePreview(detailProduct, setDetailProductPreview, setDetailProductThumb);
  useFilePreview(posterProduct, setPosterProductPreview, setPosterProductThumb);
  useFilePreview(posterLogo, setPosterLogoPreview, setPosterLogoThumb);

  async function checkOpenAIStatus() {
    setIsChecking(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch("/api/check-openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: userApiKey, baseURL: userBaseURL }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "连接检测失败");
      }
      setStatus(payload.message || "图片服务连接正常。");
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "图片服务连接检测失败",
      );
    } finally {
      setIsChecking(false);
    }
  }

  async function clearLogs() {
    await fetch("/api/logs", { method: "DELETE" });
    setLogs([]);
  }

  async function activateLicense() {
    const next = await verifyLicenseOnServer(licenseCode);
    setLicenseStatus(next);
    if (next.valid) {
      saveLicenseCode(licenseCode);
      setStatus(next.message || "授权已激活。");
      setError("");
    } else {
      setError(next.message || "授权码无效，请检查后重试。");
    }
  }

  function saveApiKeyConfig() {
    if (!userApiKey.trim()) {
      setError("请填写你自己的 OpenAI API Key。");
      return;
    }

    saveUserApiKey({ apiKey: userApiKey, baseURL: userBaseURL });
    setStatus(`API Key 已保存到本机浏览器：${maskApiKey(userApiKey)}`);
    setError("");
  }

  function clearApiKeyConfig() {
    clearUserApiKey();
    setUserApiKey("");
    setUserBaseURL("");
    setStatus("本机浏览器中的 API Key 已清除。");
  }

  function ensureAccess(featureKey = tabFeatureMap[activeTab], requireApiKey = true) {
    if (!licenseStatus.valid || !hasFeatureAccess(licenseStatus, featureKey)) {
      setError("请先输入有效授权码，或升级到包含该工作流权限的套餐。");
      return false;
    }

    if (requireApiKey && !userApiKey.trim()) {
      setError("请先填写客户自己的 OpenAI API Key。");
      return false;
    }

    return true;
  }

  async function optimizeTextPrompt() {
    if (!textPrompt.trim()) {
      setError("请先输入一段描述。");
      return;
    }

    setIsOptimizing(true);
    setError("");

    try {
      const response = await fetch("/api/optimize-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textPrompt }),
      });
      const payload = await response.json();
      setTextPrompt(payload.prompt || textPrompt);
    } catch {
      setError("提示词优化失败，请稍后重试。");
    } finally {
      setIsOptimizing(false);
    }
  }

  async function persistHistory(item: HistoryItem, itemImages: GeneratedImage[]) {
    const next = mergeHistory([item], history).slice(0, 40);
    setHistory(next);
    try {
      localStorage.setItem(historyKey, JSON.stringify(next));
      await saveHistoryImages(item.id, itemImages);
    } catch {
      setStatus("图片已生成并保存到共享历史，本机浏览器缓存空间不足，已跳过本地缓存。");
    }

    try {
      const response = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, images: itemImages }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "共享历史保存失败。");
      }
    } catch (historyError) {
      setStatus(
        historyError instanceof Error
          ? `图片已生成，但共享历史同步失败：${historyError.message}`
          : "图片已生成，但共享历史同步失败。",
      );
    }
  }

  async function syncLocalHistoryToServer(items: HistoryItem[]) {
    for (const item of items.slice(0, 40)) {
      try {
        const itemImages = await getHistoryImages(item.id);
        if (!itemImages?.length) continue;

        await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item, images: itemImages }),
        });
      } catch {
        // Local history sync is best-effort; generation and downloads still work.
      }
    }
  }

  async function generateText() {
    if (!textPrompt.trim()) {
      setError("请输入 prompt，或从模板库选择一个。");
      return;
    }

    const formData = new FormData();
    formData.append("prompt", withPlatform(textPrompt, textPlatform));
    formData.append("style", textStyle);
    formData.append("ratio", textRatio);
    formData.append("size", textSize);
    formData.append("quality", textQuality);
    formData.append("count", String(textCount));

    await submitGeneration("/api/generate-image", formData, {
      workflow: "文本生图",
      title: textPrompt,
      outputType: styleLabels[textStyle],
    });
  }

  async function generateMimic() {
    if (!mimicReference || !mimicProduct) {
      setError("请同时上传参考图和产品图。");
      return;
    }

    const formData = new FormData();
    formData.append("referenceImage", mimicReference);
    formData.append("productImage", mimicProduct);
    formData.append("productName", mimicProductName);
    formData.append("sellingPoints", mimicSellingPoints);
    formData.append("extraRequirements", withPlatform(mimicExtra, mimicPlatform));
    formData.append("outputType", mimicType);
    formData.append("dimensions", mimicSelectedDimensions.join(","));
    formData.append("strength", mimicStrength);
    formData.append("protectionLevel", mimicProtectionLevel);
    formData.append("ratio", mimicRatio);
    formData.append("quality", mimicQuality);
    formData.append("count", String(mimicCount));

    await submitGeneration("/api/generate-reference", formData, {
      workflow: "参考图模仿生图",
      title: mimicProductName || mimicType,
      outputType: mimicType,
      referenceThumb: mimicReferenceThumb,
      productThumb: mimicProductThumb,
    });
  }

  async function generateProductWorkflow() {
    if (!productMain) {
      setError("请上传产品主图。");
      return;
    }

    const formData = new FormData();
    formData.append("productImage", productMain);
    formData.append("productName", productName);
    formData.append("category", productCategory);
    formData.append("prompt", productPrompt);
    formData.append("ratio", productRatio);
    formData.append("quality", productQuality);
    formData.append("count", "1");
    formData.append("platform", productPlatform);
    formData.append("protectionLevel", productProtectionLevel);

    await submitGeneration("/api/product-workflow", formData, {
      workflow: "产品图工作流",
      title: productName || productPrompt || "产品图工作流",
      outputType: "产品锁定生图",
      productThumb: productMainThumb,
    });
  }

  async function generateProductVariant() {
    if (!variantProduct) {
      setError("请上传产品图。");
      return;
    }

    const formData = new FormData();
    formData.append("productImage", variantProduct);
    formData.append("prompt", variantPrompt);
    formData.append("outputType", variantOutputType);
    formData.append("style", variantStyle);
    formData.append("ratio", variantRatio);
    formData.append("quality", variantQuality);
    formData.append("count", String(variantCount));
    formData.append("platform", variantPlatform);
    formData.append("protectionLevel", variantProtectionLevel);

    await submitGeneration("/api/product-variant", formData, {
      workflow: "产品风格变体",
      title: variantPrompt || variantOutputType,
      outputType: variantOutputType,
      productThumb: variantProductThumb,
    });
  }

  function detailInput(): DetailBlueprintInput {
    return {
      productName: detailProductName,
      category: detailCategory,
      brandName: detailBrand,
      sellingPoints: detailSellingPoints,
      specs: detailSpecs,
      material: detailMaterial,
      functions: detailFunctions,
      packageList: detailPackageList,
      useScenes: detailUseScenes,
      audience: detailAudience,
      advantages: "",
      dimensions: "",
      variants: "",
      afterSales: detailAfterSales,
      visualPrompt: detailVisualPrompt,
      targetMarket: detailMarket,
      language: detailLanguage,
      platform: detailWorkflowPlatform,
      count: detailSetCount,
      style: detailStyle,
      textMode: detailTextMode,
    };
  }

  async function generateDetailBlueprints() {
    if (!detailProductName.trim()) {
      setError("请先填写产品名称。");
      return;
    }

    if (!ensureAccess("detail-single", false)) {
      return;
    }

    setError("");
    const response = await fetch("/api/detail-blueprint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...detailInput(),
        licenseCode,
        apiKey: userApiKey,
        baseURL: userBaseURL,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "详情图蓝图生成失败。");
      return;
    }
    setDetailBlueprints(payload.blueprint || []);
    setDetailStep(3);
    setFinalPrompt(
      showWorkflowInternals
        ? (payload.blueprint || []).map((item: DetailBlueprintItem) => item.prompt).join("\n\n---\n\n")
        : hiddenPromptText,
    );
  }

  function updateDetailBlueprint(id: string, patch: Partial<DetailBlueprintItem>) {
    setDetailBlueprints((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function generateDetailBatch() {
    if (!detailProduct) {
      setError("请上传产品主图。");
      return;
    }
    if (!detailBlueprints.length) {
      setError("请先生成详情图蓝图。");
      return;
    }

    const formData = new FormData();
    formData.append("productImage", detailProduct);
    formData.append("blueprints", JSON.stringify(detailBlueprints));
    formData.append("ratio", detailRatio);
    formData.append("quality", detailQuality);
    formData.append("textMode", detailTextMode);

    await submitGeneration("/api/detail-batch-generate", formData, {
      workflow: "电商详情图套图",
      title: detailProductName || "详情图套图",
      outputType: detailWorkflowPlatform,
      productThumb: detailProductThumb,
    });
  }

  async function generateDetail() {
    if (!detailProductName && !detailProduct) {
      setError("请至少输入产品名称，或上传产品图。");
      return;
    }

    const prompt = buildDetailPrompt({
      productName: detailProductName,
      sellingPoints: withPlatform(detailSellingPoints, detailPlatform),
      templateId: detailTemplate,
      ratio: detailRatio,
    });
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("style", "minimalEcommerce");
    formData.append("ratio", detailRatio);
    formData.append("size", ratioToSize[detailRatio]);
    formData.append("quality", detailQuality);
    formData.append("count", "1");
    if (detailProduct) {
      formData.append("mode", "reference");
      formData.append("reference", detailProduct);
    }

    await submitGeneration("/api/generate-image", formData, {
      workflow: "详情图工作流",
      title:
        detailTemplates.find((item) => item.id === detailTemplate)?.name ||
        "详情图",
      outputType: "详情图",
      productThumb: detailProductThumb,
    });
  }

  async function generatePoster() {
    if (!posterProductName && !posterProduct) {
      setError("请至少输入产品名称，或上传产品图。");
      return;
    }

    const prompt = buildPosterPrompt({
      productName: posterProductName,
      title: posterTitle,
      subtitle: withPlatform(
        [posterSubtitle, posterCampaignInfo].filter(Boolean).join("\n"),
        posterPlatform,
      ),
      posterType,
      posterStyle,
      ratio: posterRatio,
    });

    if (posterProduct) {
      const formData = new FormData();
      formData.append("productImage", posterProduct);
      if (posterLogo) {
        formData.append("logo", posterLogo);
      }
      formData.append("productName", posterProductName);
      formData.append("title", posterTitle);
      formData.append("subtitle", posterSubtitle);
      formData.append("campaignInfo", posterCampaignInfo);
      formData.append("posterType", posterType);
      formData.append("style", posterStyle);
      formData.append("ratio", posterRatio);
      formData.append("quality", posterQuality);
      formData.append("platform", posterPlatform);
      formData.append("protectionLevel", posterProtectionLevel);

      await submitGeneration("/api/poster-generate", formData, {
        workflow: "海报工作流",
        title: posterTitle || posterType,
        outputType: posterType,
        referenceThumb: posterLogoThumb,
        productThumb: posterProductThumb,
      });
      return;
    }

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("style", "poster");
    formData.append("ratio", posterRatio);
    formData.append("size", ratioToSize[posterRatio]);
    formData.append("quality", posterQuality);
    formData.append("count", "1");
    if (posterProduct) {
      formData.append("mode", "reference");
      formData.append("reference", posterProduct);
    }

    await submitGeneration("/api/generate-image", formData, {
      workflow: "海报工作流",
      title: posterTitle || posterType,
      outputType: posterType,
      productThumb: posterProductThumb,
    });
  }

  async function submitGeneration(
    endpoint: string,
    formData: FormData,
    meta: Omit<HistoryItem, "id" | "createdAt" | "finalPrompt">,
  ) {
    if (!ensureAccess()) {
      return;
    }

    const startedAt = Date.now();
    setError("");
    setStatus("");
    setFinalPrompt(showWorkflowInternals ? promptPreview : hiddenPromptText);
    setIsGenerating(true);
    setGenerationStartedAt(startedAt);
    setElapsedMs(0);
    setLastDurationMs(null);

    try {
      const historyMeta = {
        id: createId("history"),
        ...meta,
      };
      formData.append("licenseCode", licenseCode);
      formData.append("apiKey", userApiKey);
      formData.append("baseURL", userBaseURL);
      formData.append("__historyMeta", JSON.stringify(historyMeta));

      const response = await fetch(endpoint, { method: "POST", body: formData });
      const responseText = await response.text();
      let payload: {
        error?: string;
        images?: GeneratedImage[];
        finalPrompt?: string;
        durationMs?: number;
        warning?: string;
        historyItem?: HistoryItem;
        createdAt?: string;
      } = {};

      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        const shortText = responseText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
        throw new Error(
          shortText
            ? `Backend returned non-JSON content: ${shortText}`
            : "Backend returned no valid content. Check PM2 logs and retry.",
        );
      }

      if (!response.ok) {
        throw new Error(payload.error || "Generation failed. Please retry later.");
      }

      setError("");
      setImages(payload.images || []);
      setFinalPrompt(
        showWorkflowInternals
          ? payload.finalPrompt || promptPreview
          : hiddenPromptText,
      );
      setLastDurationMs(payload.durationMs ?? Date.now() - startedAt);
      if (payload.warning) {
        setStatus(payload.warning);
      }

      const historyItem = payload.historyItem || {
        ...historyMeta,
        imageCount: (payload.images || []).length,
        finalPrompt: showWorkflowInternals
          ? payload.finalPrompt || promptPreview
          : hiddenPromptText,
        createdAt: payload.createdAt || new Date().toISOString(),
      };
      await persistHistory(historyItem, payload.images || []);
      setError("");
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "生成失败，请稍后重试。",
      );
    } finally {
      setIsGenerating(false);
      setGenerationStartedAt(null);
    }
  }

  function downloadImage(url: string, filename: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function downloadAll() {
    images.forEach((image, index) => {
      window.setTimeout(
        () => downloadImage(image.url, `ecommerce-ai-${Date.now()}-${index + 1}.png`),
        index * 120,
      );
    });
  }

  async function downloadHistoryImages(item: HistoryItem) {
    setDownloadingHistoryId(item.id);

    try {
      let storedImages = (await getHistoryImages(item.id)) || [];

      if (!storedImages?.length) {
        const response = await fetch(`/api/history/${item.id}`, {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "共享历史图片读取失败。");
        }

        storedImages = payload.images || [];
        if (storedImages.length) {
          await saveHistoryImages(item.id, storedImages);
        }
      }

      if (!storedImages.length) {
        setError("这条历史记录没有可下载的图片数据，请重新生成一次。");
        return;
      }

      if (false) {
        setError("这条历史记录没有可下载的图片数据。请重新生成一次。");
        return;
      }

      storedImages.forEach((image, index) => {
        window.setTimeout(
          () =>
            downloadImage(
              image.url,
              `history-${item.workflow}-${item.id}-${index + 1}.png`,
            ),
          index * 120,
        );
      });
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "历史图片下载失败，请稍后重试。",
      );
    } finally {
      setDownloadingHistoryId("");
    }
  }

  function runCurrentTab() {
    if (activeTab === "text") return generateText();
    if (activeTab === "mimic") return generateMimic();
    if (activeTab === "product") return generateProductWorkflow();
    if (activeTab === "variant") return generateProductVariant();
    if (activeTab === "detail") return generateDetailBatch();
    return generatePoster();
  }

  if (!hasMounted) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[1500px] items-center justify-center px-4 py-5 sm:px-6 lg:px-8">
        <div className="border border-line bg-white px-6 py-5 text-sm text-neutral-600 shadow-soft">
          电商设计生图工作流加载中...
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-5 lg:flex-row lg:items-end">
        <div>
          <p className="label">Ecommerce AI Design Workflow</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">
            电商设计生图工作流
          </h1>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-neutral-600">
          {["产品主图", "详情图", "海报图", "参考图模仿"].map((item) => (
            <span key={item} className="border border-line bg-white px-3 py-2">
              {item}
            </span>
          ))}
        </div>
      </header>

      <section className="grid gap-5 py-5 xl:grid-cols-[430px_minmax(0,1fr)_360px]">
        <aside className="border border-line bg-white p-4 shadow-soft">
          <AccessControlPanel
            licenseCode={licenseCode}
            setLicenseCode={setLicenseCode}
            licenseStatus={licenseStatus}
            activateLicense={activateLicense}
            apiKey={userApiKey}
            setApiKey={setUserApiKey}
            baseURL={userBaseURL}
            setBaseURL={setUserBaseURL}
            saveApiKey={saveApiKeyConfig}
            clearApiKey={clearApiKeyConfig}
          />

          <div className="grid grid-cols-2 gap-1 border border-line bg-paper p-1">
            {workflowTabItems.map((workflow) => {
              const locked = !hasFeatureAccess(licenseStatus, workflow.featureKey);
              return (
              <button
                key={workflow.id}
                title={locked ? "当前授权未开放该工作流" : workflow.description}
                className={`px-3 py-2 text-sm font-medium transition ${
                  activeTab === workflow.tab ? "bg-ink text-white" : "text-neutral-600"
                }`}
                onClick={() => setActiveTab(workflow.tab)}
              >
                {workflow.name}
                {locked ? " · 未授权" : ""}
              </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-5">
            {activeTab === "text" && (
              <TextWorkflow
                prompt={textPrompt}
                setPrompt={setTextPrompt}
                style={textStyle}
                setStyle={setTextStyle}
                ratio={textRatio}
                setRatio={setTextRatio}
                size={textSize}
                setSize={setTextSize}
                quality={textQuality}
                setQuality={setTextQuality}
                platform={textPlatform}
                setPlatform={setTextPlatform}
                count={textCount}
                setCount={setTextCount}
                optimize={optimizeTextPrompt}
                isOptimizing={isOptimizing}
              />
            )}

            {activeTab === "mimic" && (
              <MimicWorkflow
                reference={mimicReference}
                setReference={setMimicReference}
                product={mimicProduct}
                setProduct={setMimicProduct}
                referencePreview={mimicReferencePreview}
                productPreview={mimicProductPreview}
                productName={mimicProductName}
                setProductName={setMimicProductName}
                sellingPoints={mimicSellingPoints}
                setSellingPoints={setMimicSellingPoints}
                extra={mimicExtra}
                setExtra={setMimicExtra}
                outputType={mimicType}
                setOutputType={setMimicType}
                dimensions={mimicSelectedDimensions}
                setDimensions={setMimicSelectedDimensions}
                strength={mimicStrength}
                setStrength={setMimicStrength}
                ratio={mimicRatio}
                setRatio={setMimicRatio}
                count={mimicCount}
                setCount={setMimicCount}
                quality={mimicQuality}
                setQuality={setMimicQuality}
                platform={mimicPlatform}
                setPlatform={setMimicPlatform}
                protectionLevel={mimicProtectionLevel}
                setProtectionLevel={setMimicProtectionLevel}
              />
            )}

            {activeTab === "product" && (
              <ProductWorkflow
                product={productMain}
                setProduct={setProductMain}
                productPreview={productMainPreview}
                productName={productName}
                setProductName={setProductName}
                category={productCategory}
                setCategory={setProductCategory}
                prompt={productPrompt}
                setPrompt={setProductPrompt}
                ratio={productRatio}
                setRatio={setProductRatio}
                quality={productQuality}
                setQuality={setProductQuality}
                platform={productPlatform}
                setPlatform={setProductPlatform}
                protectionLevel={productProtectionLevel}
                setProtectionLevel={setProductProtectionLevel}
              />
            )}

            {activeTab === "variant" && (
              <ProductVariantWorkflow
                product={variantProduct}
                setProduct={setVariantProduct}
                productPreview={variantProductPreview}
                prompt={variantPrompt}
                setPrompt={setVariantPrompt}
                outputType={variantOutputType}
                setOutputType={setVariantOutputType}
                style={variantStyle}
                setStyle={setVariantStyle}
                ratio={variantRatio}
                setRatio={setVariantRatio}
                count={variantCount}
                setCount={setVariantCount}
                quality={variantQuality}
                setQuality={setVariantQuality}
                platform={variantPlatform}
                setPlatform={setVariantPlatform}
                protectionLevel={variantProtectionLevel}
                setProtectionLevel={setVariantProtectionLevel}
              />
            )}

            {activeTab === "detail" && (
              <DetailSuiteWorkflow
                product={detailProduct}
                setProduct={setDetailProduct}
                productPreview={detailProductPreview}
                productName={detailProductName}
                setProductName={setDetailProductName}
                category={detailCategory}
                setCategory={setDetailCategory}
                brand={detailBrand}
                setBrand={setDetailBrand}
                sellingPoints={detailSellingPoints}
                setSellingPoints={setDetailSellingPoints}
                specs={detailSpecs}
                setSpecs={setDetailSpecs}
                material={detailMaterial}
                setMaterial={setDetailMaterial}
                functions={detailFunctions}
                setFunctions={setDetailFunctions}
                packageList={detailPackageList}
                setPackageList={setDetailPackageList}
                useScenes={detailUseScenes}
                setUseScenes={setDetailUseScenes}
                audience={detailAudience}
                setAudience={setDetailAudience}
                afterSales={detailAfterSales}
                setAfterSales={setDetailAfterSales}
                visualPrompt={detailVisualPrompt}
                setVisualPrompt={setDetailVisualPrompt}
                step={detailStep}
                setStep={setDetailStep}
                count={detailSetCount}
                setCount={setDetailSetCount}
                market={detailMarket}
                setMarket={setDetailMarket}
                language={detailLanguage}
                setLanguage={setDetailLanguage}
                workflowPlatform={detailWorkflowPlatform}
                setWorkflowPlatform={setDetailWorkflowPlatform}
                style={detailStyle}
                setStyle={setDetailStyle}
                ratio={detailRatio}
                setRatio={setDetailRatio}
                quality={detailQuality}
                setQuality={setDetailQuality}
                textMode={detailTextMode}
                setTextMode={setDetailTextMode}
                blueprints={detailBlueprints}
                updateBlueprint={updateDetailBlueprint}
                generateBlueprints={generateDetailBlueprints}
                generateBatch={generateDetailBatch}
              />
            )}

            {activeTab === "poster" && (
              <PosterWorkflow
                product={posterProduct}
                setProduct={setPosterProduct}
                logo={posterLogo}
                setLogo={setPosterLogo}
                productPreview={posterProductPreview}
                logoPreview={posterLogoPreview}
                productName={posterProductName}
                setProductName={setPosterProductName}
                title={posterTitle}
                setTitle={setPosterTitle}
                subtitle={posterSubtitle}
                setSubtitle={setPosterSubtitle}
                campaignInfo={posterCampaignInfo}
                setCampaignInfo={setPosterCampaignInfo}
                posterType={posterType}
                setPosterType={setPosterType}
                posterStyle={posterStyle}
                setPosterStyle={setPosterStyle}
                ratio={posterRatio}
                setRatio={setPosterRatio}
                quality={posterQuality}
                setQuality={setPosterQuality}
                platform={posterPlatform}
                setPlatform={setPosterPlatform}
                protectionLevel={posterProtectionLevel}
                setProtectionLevel={setPosterProtectionLevel}
              />
            )}

            {error && (
              <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">
                {error}
              </div>
            )}
            {status && (
              <div className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-700">
                {status}
              </div>
            )}

            <button
              className="primary-button w-full"
              onClick={runCurrentTab}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              生成图片
            </button>
            <div className="border border-line bg-paper px-3 py-2 text-sm text-neutral-600">
              {isGenerating
                ? `生成中，已耗时 ${formatDuration(elapsedMs)}`
                : lastDurationMs !== null
                  ? `本次耗时 ${formatDuration(lastDurationMs)}`
                  : "耗时会在生成时显示"}
            </div>
            <button
              className="secondary-button w-full"
              onClick={checkOpenAIStatus}
              disabled={isChecking}
            >
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              检测图片服务
            </button>
          </div>
        </aside>

        <section className="flex min-h-[720px] flex-col border border-line bg-white shadow-soft">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="label">Result Preview</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                {tabTitle(activeTab)}
              </h2>
            </div>
            <button
              className="secondary-button"
              onClick={downloadAll}
              disabled={images.length === 0}
            >
              <Download className="h-4 w-4" />
              全部下载
            </button>
          </div>

          <div className="grid flex-1 auto-rows-fr gap-3 p-4 md:grid-cols-2">
            {images.length ? (
              images.map((image, index) => (
                <figure
                  key={image.id}
                  className="group relative min-h-80 overflow-hidden border border-line bg-paper"
                >
                  <img
                    src={image.url}
                    alt={`生成结果 ${index + 1}`}
                    className="h-full w-full object-contain"
                  />
                  <button
                    className="icon-button absolute right-3 top-3 opacity-0 shadow-sm group-hover:opacity-100"
                    onClick={() =>
                      downloadImage(image.url, `ecommerce-ai-${image.id}.png`)
                    }
                    title="下载单张"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </figure>
              ))
            ) : (
              <div className="col-span-full flex min-h-[560px] flex-col items-center justify-center gap-3 bg-paper text-center text-neutral-500">
                <Layers className="h-10 w-10" />
                <p className="max-w-md text-sm leading-6">
                  选择一个工作流，填写参数后生成图片。参考图模仿生图会把参考图和产品图角色分开处理，并保存增强 prompt。
                </p>
              </div>
            )}
          </div>

          {showWorkflowInternals && (
            <details className="border-t border-line p-4" open={Boolean(finalPrompt)}>
              <summary className="cursor-pointer text-sm font-medium text-ink">
                最终增强 Prompt
              </summary>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap bg-paper p-3 text-xs leading-5 text-neutral-700">
                {finalPrompt || promptPreview || "生成前会在这里显示系统增强后的 prompt。"}
              </pre>
            </details>
          )}
        </section>

        <aside className="space-y-4">
          <div className="border border-line bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-neutral-500" />
              <h2 className="text-lg font-semibold text-ink">历史记录</h2>
            </div>
            <span className="text-sm text-neutral-500">{history.length}</span>
          </div>

          <div className="space-y-3">
            {history.length ? (
              history.map((item) => (
                <article key={item.id} className="border border-line bg-paper p-3">
                  <div className="mb-3 flex gap-2">
                    {item.referenceThumb && (
                      <img
                        src={item.referenceThumb}
                        alt="参考图缩略图"
                        className="h-14 w-14 object-cover"
                      />
                    )}
                    {item.productThumb && (
                      <img
                        src={item.productThumb}
                        alt="产品图缩略图"
                        className="h-14 w-14 object-cover"
                      />
                    )}
                    {!item.referenceThumb && !item.productThumb && (
                      <div className="flex h-14 w-14 items-center justify-center bg-white text-neutral-400">
                        <FileImage className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-ink">{item.workflow}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-700">
                    {item.title}
                  </p>
                  <p className="mt-2 text-xs text-neutral-500">
                    {item.outputType || "图片"} ·{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                  {showWorkflowInternals && (
                    <button
                      className="secondary-button mt-3 px-2.5 py-1.5"
                      onClick={() => setFinalPrompt(item.finalPrompt)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      查看 Prompt
                    </button>
                  )}
                  <button
                    className="secondary-button mt-2 w-full px-2.5 py-1.5"
                    onClick={() => downloadHistoryImages(item)}
                    disabled={downloadingHistoryId === item.id}
                  >
                    {downloadingHistoryId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    下载历史图片{item.imageCount ? ` (${item.imageCount})` : ""}
                  </button>
                </article>
              ))
            ) : (
              <div className="border border-dashed border-line bg-paper px-4 py-8 text-sm leading-6 text-neutral-500">
                生成后会保存工作流类型、缩略图、生成类型、时间和图片数据。
              </div>
            )}
          </div>
          </div>

          {showWorkflowInternals && (
          <div className="border border-line bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="label">Live Logs</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">实时程序日志</h2>
              </div>
              <div className="flex gap-2">
                <button
                  className="secondary-button px-2.5 py-1.5"
                  onClick={() => setShowLogs(!showLogs)}
                >
                  {showLogs ? "收起" : "展开"}
                </button>
                <button className="secondary-button px-2.5 py-1.5" onClick={clearLogs}>
                  清空
                </button>
              </div>
            </div>

            {showLogs && (
              <div className="max-h-[420px] space-y-2 overflow-auto bg-paper p-2">
                {logs.length ? (
                  logs.map((log) => (
                    <article
                      key={log.id}
                      className={`border bg-white p-2 text-xs leading-5 ${logBorderClass(
                        log.level,
                      )}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-semibold ${logTextClass(log.level)}`}>
                          {log.level.toUpperCase()} · {log.scope}
                        </span>
                        <span className="shrink-0 text-neutral-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 text-neutral-700">{log.message}</p>
                      {log.detail && (
                        <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap border border-line bg-paper p-2 text-[11px] text-neutral-600">
                          {log.detail}
                        </pre>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="px-2 py-6 text-center text-sm text-neutral-500">
                    暂无日志。点击生成或检测图片服务后会实时显示。
                  </p>
                )}
              </div>
            )}
          </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function AccessControlPanel({
  licenseCode,
  setLicenseCode,
  licenseStatus,
  activateLicense,
  apiKey,
  setApiKey,
  baseURL,
  setBaseURL,
  saveApiKey,
  clearApiKey,
}: {
  licenseCode: string;
  setLicenseCode: (value: string) => void;
  licenseStatus: LicenseStatus;
  activateLicense: () => void | Promise<void>;
  apiKey: string;
  setApiKey: (value: string) => void;
  baseURL: string;
  setBaseURL: (value: string) => void;
  saveApiKey: () => void;
  clearApiKey: () => void;
}) {
  return (
    <div className="mb-4 space-y-3 border border-line bg-paper p-3">
      <div>
        <p className="label">工具权限</p>
        <div className="mt-2 flex gap-2">
          <input
            className="min-w-0 flex-1 border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            value={licenseCode}
            onChange={(event) => setLicenseCode(event.target.value)}
            placeholder="输入授权码，例如 STUDIO-2026"
          />
          <button className="border border-line bg-ink px-3 py-2 text-sm text-white" onClick={activateLicense}>
            激活
          </button>
        </div>
        <p className={`mt-2 text-xs ${licenseStatus.valid ? "text-green-700" : "text-neutral-500"}`}>
          {licenseStatus.valid ? `${licenseStatus.planId?.toUpperCase()} 已激活` : "当前未激活授权码"}
        </p>
      </div>

      <div>
        <p className="label">API 密钥</p>
        <input
          className="mt-2 w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="粘贴 OpenAI sk-... 或 Azure OpenAI 密钥，只保存在本机浏览器"
        />
        <p className="mt-1 text-xs text-neutral-500">
          系统会自动识别 OpenAI / Azure OpenAI。正常只需要填写这一项。
        </p>
        <details className="mt-2 text-xs text-neutral-600">
          <summary className="cursor-pointer select-none">高级选项：自定义 OPENAI_BASE_URL</summary>
          <input
            className="mt-2 w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            value={baseURL}
            onChange={(event) => setBaseURL(event.target.value)}
            placeholder="可留空；仅普通 OpenAI 代理或完整 Azure 终结点需要填写"
          />
        </details>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-neutral-500">
            {apiKey ? `已填写：${maskApiKey(apiKey)}` : "平台不会保存你的完整 Key"}
          </span>
          <div className="flex gap-2">
            <button className="border border-line bg-white px-3 py-1.5 text-xs" onClick={clearApiKey}>
              清除
            </button>
            <button className="border border-line bg-white px-3 py-1.5 text-xs" onClick={saveApiKey}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function TextWorkflow(props: {
  prompt: string;
  setPrompt: (value: string) => void;
  style: StyleKey;
  setStyle: (value: StyleKey) => void;
  ratio: Ratio;
  setRatio: (value: Ratio) => void;
  size: ImageSize;
  setSize: (value: ImageSize) => void;
  quality: ImageQuality;
  setQuality: (value: ImageQuality) => void;
  platform: EcommercePlatformId;
  setPlatform: (value: EcommercePlatformId) => void;
  count: number;
  setCount: (value: number) => void;
  optimize: () => void;
  isOptimizing: boolean;
}) {
  return (
    <>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="label" htmlFor="text-prompt">
            Prompt
          </label>
          <button
            className="secondary-button px-2.5 py-1.5"
            onClick={props.optimize}
            disabled={props.isOptimizing}
          >
            {props.isOptimizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            优化
          </button>
        </div>
        <textarea
          id="text-prompt"
          className="control min-h-36 resize-none leading-6"
          value={props.prompt}
          onChange={(event) => props.setPrompt(event.target.value)}
          placeholder="描述你想生成的电商图片，例如：一款高端香氛蜡烛的主图，柔和自然光，浅色背景..."
        />
      </div>

      <TemplateButtons onPick={props.setPrompt} />

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="风格预设"
          value={props.style}
          onChange={(value) => props.setStyle(value as StyleKey)}
          options={Object.entries(styleLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <SelectField
          label="图片比例"
          value={props.ratio}
          onChange={(value) => {
            const nextRatio = value as Ratio;
            props.setRatio(nextRatio);
            props.setSize(ratioToSize[nextRatio]);
          }}
          options={ratios.map((item) => ({ value: item, label: item }))}
        />
        <SelectField
          label="图片尺寸"
          value={props.size}
          onChange={(value) => props.setSize(value as ImageSize)}
          options={sizes.map((item) => ({ value: item, label: item }))}
        />
        <SelectField
          label="质量"
          value={props.quality}
          onChange={(value) => props.setQuality(value as ImageQuality)}
          options={qualities.map((item) => ({ value: item, label: qualityLabels[item] }))}
        />
        <PlatformField value={props.platform} onChange={props.setPlatform} />
      </div>

      <SegmentedNumbers
        label="输出数量"
        values={[1, 2, 3, 4]}
        value={props.count}
        setValue={props.setCount}
      />
    </>
  );
}

function MimicWorkflow(props: {
  reference: File | null;
  setReference: (file: File | null) => void;
  product: File | null;
  setProduct: (file: File | null) => void;
  referencePreview: string;
  productPreview: string;
  productName: string;
  setProductName: (value: string) => void;
  sellingPoints: string;
  setSellingPoints: (value: string) => void;
  extra: string;
  setExtra: (value: string) => void;
  outputType: MimicType;
  setOutputType: (value: MimicType) => void;
  dimensions: MimicDimension[];
  setDimensions: (value: MimicDimension[]) => void;
  strength: MimicStrength;
  setStrength: (value: MimicStrength) => void;
  ratio: Ratio;
  setRatio: (value: Ratio) => void;
  count: number;
  setCount: (value: number) => void;
  quality: ImageQuality;
  setQuality: (value: ImageQuality) => void;
  platform: EcommercePlatformId;
  setPlatform: (value: EcommercePlatformId) => void;
  protectionLevel: ProductProtectionLevel;
  setProtectionLevel: (value: ProductProtectionLevel) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <UploadBox
          label="参考图"
          file={props.reference}
          preview={props.referencePreview}
          setFile={props.setReference}
        />
        <UploadBox
          label="产品图"
          file={props.product}
          preview={props.productPreview}
          setFile={props.setProduct}
        />
      </div>
      <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
        注意：要让生成结果严格使用你上传的产品图，后端必须支持图片编辑
        images/edits。若当前服务只有 images/generations，系统会停止生成并提示配置正确接口，避免生成出不像你产品的图片。
      </div>

      <InputField
        label="产品名称"
        value={props.productName}
        onChange={props.setProductName}
        placeholder="例如：智能筋膜枪 Pro"
      />
      <TextareaField
        label="卖点描述"
        value={props.sellingPoints}
        onChange={props.setSellingPoints}
        placeholder="输入核心卖点、材质、功能、目标人群..."
      />
      <TextareaField
        label="补充要求"
        value={props.extra}
        onChange={props.setExtra}
        placeholder="例如：背景更干净，保留高级感，不要出现中文文字..."
      />

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="生成类型"
          value={props.outputType}
          onChange={(value) => props.setOutputType(value as MimicType)}
          options={mimicTypes.map((item) => ({ value: item, label: item }))}
        />
        <SelectField
          label="模仿强度"
          value={props.strength}
          onChange={(value) => props.setStrength(value as MimicStrength)}
          options={mimicStrengths.map((item) => ({ value: item, label: item }))}
        />
        <SelectField
          label="比例"
          value={props.ratio}
          onChange={(value) => props.setRatio(value as Ratio)}
          options={ratios.map((item) => ({ value: item, label: item }))}
        />
        <SelectField
          label="输出数量"
          value={String(props.count)}
          onChange={(value) => props.setCount(Number(value))}
          options={mimicCounts.map((item) => ({
            value: String(item),
            label: String(item),
          }))}
        />
      </div>

      <div>
        <p className="label mb-2">模仿维度</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-full mb-3 grid grid-cols-2 gap-3">
            <QualityField value={props.quality} onChange={props.setQuality} />
            <PlatformField value={props.platform} onChange={props.setPlatform} />
          </div>
          <div className="col-span-full">
            <ProductProtectionPanel
              level={props.protectionLevel}
              setLevel={props.setProtectionLevel}
            />
          </div>
          {mimicDimensions.map((dimension) => {
            const checked = props.dimensions.includes(dimension);
            return (
              <button
                key={dimension}
                className={`border px-3 py-2 text-left text-sm transition ${
                  checked
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-neutral-700"
                }`}
                onClick={() =>
                  props.setDimensions(
                    checked
                      ? props.dimensions.filter((item) => item !== dimension)
                      : [...props.dimensions, dimension],
                  )
                }
              >
                {dimension}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

const productPromptTemplates = [
  "生成纯白背景电商主图，产品居中，边缘干净，自然柔和投影，适合平台商品首图。",
  "生成高级浅灰质感背景，产品居中偏大，柔和棚拍光影，增加轻微反射和商业留白。",
  "生成科技感深色背景产品展示图，冷色光效，背景有简洁线条和能量氛围，产品主体不变。",
  "生成生活方式场景图，让产品处于真实使用环境中，光影自然融合，画面干净高级。",
  "生成电商强转化主图，背景简洁，预留卖点卡片区域，产品主体清晰突出。",
];
const protectionLevelOptions = [
  { value: "standard", label: "标准模式" },
  { value: "high-fidelity", label: "高保真模式" },
  { value: "strict", label: "严格锁定模式" },
];
const detailMarketOptions = ["中国", "美国", "巴西", "墨西哥", "东南亚", "欧洲"];
const detailLanguageOptions = ["中文", "英文", "葡语（巴西）", "西语（墨西哥）", "俄文"];
const detailPlatformOptions = [
  "TikTok Shop",
  "Shopee",
  "Lazada",
  "Amazon / 亚马逊",
  "WB/OZON",
  "独立站",
  "小红书",
  "抖音",
  "通用电商",
];
const detailCountOptions = [3, 5, 9, 12];

function ProductProtectionPanel(props: {
  level: ProductProtectionLevel;
  setLevel: (value: ProductProtectionLevel) => void;
}) {
  const locked = [
    "产品主体锁定",
    "颜色严格保留",
    "结构严格保留",
    "logo 严格保留",
    "配件严格保留",
  ];

  return (
    <div className="border border-amber-200 bg-amber-50 p-3">
      <SelectField
        label="产品保护等级"
        value={props.level}
        onChange={(value) => props.setLevel(value as ProductProtectionLevel)}
        options={protectionLevelOptions}
      />
      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-amber-800">
        {locked.map((item) => (
          <span key={item} className="border border-amber-200 bg-white px-2 py-1">
            {item}：开启
          </span>
        ))}
      </div>
    </div>
  );
}

function ProductWorkflow(props: {
  product: File | null;
  setProduct: (file: File | null) => void;
  productPreview: string;
  productName: string;
  setProductName: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  prompt: string;
  setPrompt: (value: string) => void;
  ratio: Ratio;
  setRatio: (value: Ratio) => void;
  quality: ImageQuality;
  setQuality: (value: ImageQuality) => void;
  platform: EcommercePlatformId;
  setPlatform: (value: EcommercePlatformId) => void;
  protectionLevel: ProductProtectionLevel;
  setProtectionLevel: (value: ProductProtectionLevel) => void;
}) {
  return (
    <>
      <UploadBox
        label="产品主图"
        file={props.product}
        preview={props.productPreview}
        setFile={props.setProduct}
      />
      <InputField
        label="产品名称"
        value={props.productName}
        onChange={props.setProductName}
        placeholder="例如：WF6 智能耳机"
      />
      <InputField
        label="产品品类"
        value={props.category}
        onChange={props.setCategory}
        placeholder="例如：蓝牙耳机 / 小家电 / 户外装备"
      />
      <TextareaField
        label="背景/场景提示词"
        value={props.prompt}
        onChange={props.setPrompt}
        placeholder="描述你想生成的背景、场景、光影、陈列方式和商业氛围。产品图会被锁定，不按提示词改产品本身。"
      />
      <div>
        <p className="label mb-2">提示词类型</p>
        <div className="grid grid-cols-1 gap-2">
          {productPromptTemplates.map((template) => (
            <button
              key={template}
              className="border border-line bg-paper px-3 py-2 text-left text-xs leading-5 text-neutral-700 transition hover:border-neutral-400 hover:bg-white"
              onClick={() => props.setPrompt(template)}
            >
              {template}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="比例"
          value={props.ratio}
          onChange={(value) => props.setRatio(value as Ratio)}
          options={ratios.map((item) => ({ value: item, label: item }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <QualityField value={props.quality} onChange={props.setQuality} />
        <PlatformField value={props.platform} onChange={props.setPlatform} />
      </div>
      <ProductProtectionPanel
        level={props.protectionLevel}
        setLevel={props.setProtectionLevel}
      />
    </>
  );
}

function ProductVariantWorkflow(props: {
  product: File | null;
  setProduct: (file: File | null) => void;
  productPreview: string;
  prompt: string;
  setPrompt: (value: string) => void;
  outputType: string;
  setOutputType: (value: string) => void;
  style: string;
  setStyle: (value: string) => void;
  ratio: Ratio;
  setRatio: (value: Ratio) => void;
  count: number;
  setCount: (value: number) => void;
  quality: ImageQuality;
  setQuality: (value: ImageQuality) => void;
  platform: EcommercePlatformId;
  setPlatform: (value: EcommercePlatformId) => void;
  protectionLevel: ProductProtectionLevel;
  setProtectionLevel: (value: ProductProtectionLevel) => void;
}) {
  return (
    <>
      <UploadBox
        label="产品图"
        file={props.product}
        preview={props.productPreview}
        setFile={props.setProduct}
      />
      <TextareaField
        label="变体提示词"
        value={props.prompt}
        onChange={props.setPrompt}
        placeholder="例如：生成科技感深色背景产品海报，只改变背景、光影和排版"
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="输出类型"
          value={props.outputType}
          onChange={props.setOutputType}
          options={productVariantOutputTypes.map((item) => ({ value: item, label: item }))}
        />
        <SelectField
          label="风格"
          value={props.style}
          onChange={props.setStyle}
          options={productVariantStyles.map((item) => ({ value: item, label: item }))}
        />
        <SelectField
          label="比例"
          value={props.ratio}
          onChange={(value) => props.setRatio(value as Ratio)}
          options={ratios.map((item) => ({ value: item, label: item }))}
        />
        <QualityField value={props.quality} onChange={props.setQuality} />
      </div>
      <SegmentedNumbers
        label="输出数量"
        values={[1, 2, 4]}
        value={props.count}
        setValue={props.setCount}
      />
      <PlatformField value={props.platform} onChange={props.setPlatform} />
      <ProductProtectionPanel
        level={props.protectionLevel}
        setLevel={props.setProtectionLevel}
      />
    </>
  );
}

function DetailSuiteWorkflow(props: {
  product: File | null;
  setProduct: (file: File | null) => void;
  productPreview: string;
  productName: string;
  setProductName: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  brand: string;
  setBrand: (value: string) => void;
  sellingPoints: string;
  setSellingPoints: (value: string) => void;
  specs: string;
  setSpecs: (value: string) => void;
  material: string;
  setMaterial: (value: string) => void;
  functions: string;
  setFunctions: (value: string) => void;
  packageList: string;
  setPackageList: (value: string) => void;
  useScenes: string;
  setUseScenes: (value: string) => void;
  audience: string;
  setAudience: (value: string) => void;
  afterSales: string;
  setAfterSales: (value: string) => void;
  visualPrompt: string;
  setVisualPrompt: (value: string) => void;
  step: number;
  setStep: (value: number) => void;
  count: number;
  setCount: (value: number) => void;
  market: DetailMarket;
  setMarket: (value: DetailMarket) => void;
  language: DetailLanguage;
  setLanguage: (value: DetailLanguage) => void;
  workflowPlatform: DetailPlatform;
  setWorkflowPlatform: (value: DetailPlatform) => void;
  style: string;
  setStyle: (value: string) => void;
  ratio: Ratio;
  setRatio: (value: Ratio) => void;
  quality: ImageQuality;
  setQuality: (value: ImageQuality) => void;
  textMode: "editable-layers" | "image-text";
  setTextMode: (value: "editable-layers" | "image-text") => void;
  blueprints: DetailBlueprintItem[];
  updateBlueprint: (id: string, patch: Partial<DetailBlueprintItem>) => void;
  generateBlueprints: () => void;
  generateBatch: () => void;
}) {
  const stepLabels = ["产品资料", "套图规划", "蓝图编辑", "批量生成"];

  return (
    <>
      <div className="grid grid-cols-4 gap-1 border border-line bg-paper p-1">
        {stepLabels.map((label, index) => {
          const step = index + 1;
          return (
            <button
              key={label}
              className={`px-2 py-2 text-xs font-medium ${
                props.step === step ? "bg-ink text-white" : "text-neutral-600"
              }`}
              onClick={() => props.setStep(step)}
            >
              {step}. {label}
            </button>
          );
        })}
      </div>

      {props.step === 1 && (
        <>
          <UploadBox
            label="产品主图"
            file={props.product}
            preview={props.productPreview}
            setFile={props.setProduct}
          />
          <div className="grid grid-cols-2 gap-3">
            <InputField label="产品名称" value={props.productName} onChange={props.setProductName} />
            <InputField label="产品品类" value={props.category} onChange={props.setCategory} />
          </div>
          <InputField label="品牌名称" value={props.brand} onChange={props.setBrand} />
          <TextareaField label="核心卖点" value={props.sellingPoints} onChange={props.setSellingPoints} />
          <TextareaField label="产品参数" value={props.specs} onChange={props.setSpecs} />
          <TextareaField label="材质信息" value={props.material} onChange={props.setMaterial} />
          <TextareaField label="功能说明" value={props.functions} onChange={props.setFunctions} />
          <TextareaField label="包装清单" value={props.packageList} onChange={props.setPackageList} />
          <TextareaField label="使用场景" value={props.useScenes} onChange={props.setUseScenes} />
          <TextareaField label="适用人群" value={props.audience} onChange={props.setAudience} />
          <TextareaField label="售后信息" value={props.afterSales} onChange={props.setAfterSales} />
          <TextareaField
            label="详情图整体提示词"
            value={props.visualPrompt}
            onChange={props.setVisualPrompt}
            placeholder="例如：生成适合 WB/OZON 的俄语详情页视觉，蓝色户外背景，产品大图靠左，右侧保留空白信息卡片，不要在图片里生成文字。"
          />
        </>
      )}

      {props.step === 2 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="生成张数"
              value={String(props.count)}
              onChange={(value) => props.setCount(Number(value))}
              options={detailCountOptions.map((item) => ({
                value: String(item),
                label: `${item} 张`,
              }))}
            />
            <SelectField
              label="电商平台"
              value={props.workflowPlatform}
              onChange={(value) => props.setWorkflowPlatform(value as DetailPlatform)}
              options={detailPlatformOptions.map((item) => ({ value: item, label: item }))}
            />
            <SelectField
              label="目标市场"
              value={props.market}
              onChange={(value) => props.setMarket(value as DetailMarket)}
              options={detailMarketOptions.map((item) => ({ value: item, label: item }))}
            />
            <SelectField
              label="输出语言"
              value={props.language}
              onChange={(value) => props.setLanguage(value as DetailLanguage)}
              options={detailLanguageOptions.map((item) => ({ value: item, label: item }))}
            />
            <SelectField
              label="详情风格"
              value={props.style}
              onChange={props.setStyle}
              options={ecommerceStylePresets.map((item) => ({ value: item, label: item }))}
            />
            <SelectField
              label="比例"
              value={props.ratio}
              onChange={(value) => props.setRatio(value as Ratio)}
              options={ratios.map((item) => ({ value: item, label: item }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <QualityField value={props.quality} onChange={props.setQuality} />
            <SelectField
              label="文字模式"
              value={props.textMode}
              onChange={(value) => props.setTextMode(value as "editable-layers" | "image-text")}
              options={[
                { value: "editable-layers", label: "可编辑文字层" },
                { value: "image-text", label: "图片内生成文字" },
              ]}
            />
          </div>
          <TextareaField
            label="套图生成提示词"
            value={props.visualPrompt}
            onChange={props.setVisualPrompt}
            placeholder="控制整套详情图的背景、场景、光影、卡片风格和排版。默认不让 AI 在图里生成文字，文字用前端可编辑层处理。"
          />
          <button className="secondary-button w-full justify-center" onClick={props.generateBlueprints}>
            生成详情图蓝图
          </button>
        </>
      )}

      {props.step === 3 && (
        <div className="space-y-3">
          <button className="secondary-button w-full justify-center" onClick={props.generateBlueprints}>
            重新生成蓝图
          </button>
          {props.blueprints.map((item) => (
            <div key={item.id} className="border border-line bg-paper p-3">
              <p className="mb-2 text-sm font-semibold text-ink">
                第 {item.index} 张 · {item.type}
              </p>
              <InputField
                label="主标题"
                value={item.title}
                onChange={(value) => props.updateBlueprint(item.id, { title: value })}
              />
              <InputField
                label="副标题"
                value={item.subtitle}
                onChange={(value) => props.updateBlueprint(item.id, { subtitle: value })}
              />
              <TextareaField
                label="卖点"
                value={item.sellingPoints.join("\n")}
                onChange={(value) =>
                  props.updateBlueprint(item.id, {
                    sellingPoints: value.split("\n").filter(Boolean),
                  })
                }
              />
              <InputField
                label="版式"
                value={item.layout}
                onChange={(value) => props.updateBlueprint(item.id, { layout: value })}
              />
              {showWorkflowInternals ? (
                <TextareaField
                  label="最终 Prompt"
                  value={item.prompt}
                  onChange={(value) => props.updateBlueprint(item.id, { prompt: value })}
                />
              ) : (
                <div className="border border-line bg-white px-3 py-2 text-xs text-neutral-500">
                  最终 Prompt 已隐藏，防止工作流设计被复制。
                </div>
              )}
            </div>
          ))}
          {!props.blueprints.length && (
            <div className="border border-dashed border-line bg-paper p-4 text-sm text-neutral-500">
              还没有蓝图，请先到 Step 2 生成详情图蓝图。
            </div>
          )}
        </div>
      )}

      {props.step === 4 && (
        <>
          <div className="border border-line bg-paper p-3 text-sm leading-6 text-neutral-600">
            将按当前蓝图批量生成整套详情图。默认使用可编辑文字层模式，AI 主要生成背景、产品展示、光影和信息区域。
          </div>
          <button className="secondary-button w-full justify-center" onClick={props.generateBatch}>
            批量生成整套详情图
          </button>
        </>
      )}
    </>
  );
}

function DetailWorkflow(props: {
  product: File | null;
  setProduct: (file: File | null) => void;
  productPreview: string;
  productName: string;
  setProductName: (value: string) => void;
  sellingPoints: string;
  setSellingPoints: (value: string) => void;
  templateId: DetailTemplateId;
  setTemplateId: (value: DetailTemplateId) => void;
  ratio: Ratio;
  setRatio: (value: Ratio) => void;
  quality: ImageQuality;
  setQuality: (value: ImageQuality) => void;
  platform: EcommercePlatformId;
  setPlatform: (value: EcommercePlatformId) => void;
}) {
  return (
    <>
      <UploadBox
        label="产品图"
        file={props.product}
        preview={props.productPreview}
        setFile={props.setProduct}
      />
      <InputField
        label="产品名称"
        value={props.productName}
        onChange={props.setProductName}
        placeholder="例如：便携式冲牙器"
      />
      <TextareaField
        label="卖点信息"
        value={props.sellingPoints}
        onChange={props.setSellingPoints}
        placeholder="输入功能、参数、材质、适用场景、对比优势..."
      />
      <SelectField
        label="详情图模板"
        value={props.templateId}
        onChange={(value) => props.setTemplateId(value as DetailTemplateId)}
        options={detailTemplates.map((item) => ({
          value: item.id,
          label: item.name,
        }))}
      />
      <SelectField
        label="比例"
        value={props.ratio}
        onChange={(value) => props.setRatio(value as Ratio)}
        options={ratios.map((item) => ({ value: item, label: item }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <QualityField value={props.quality} onChange={props.setQuality} />
        <PlatformField value={props.platform} onChange={props.setPlatform} />
      </div>
    </>
  );
}

function PosterWorkflow(props: {
  product: File | null;
  setProduct: (file: File | null) => void;
  logo: File | null;
  setLogo: (file: File | null) => void;
  productPreview: string;
  logoPreview: string;
  productName: string;
  setProductName: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  subtitle: string;
  setSubtitle: (value: string) => void;
  campaignInfo: string;
  setCampaignInfo: (value: string) => void;
  posterType: PosterType;
  setPosterType: (value: PosterType) => void;
  posterStyle: PosterStyle;
  setPosterStyle: (value: PosterStyle) => void;
  ratio: Ratio;
  setRatio: (value: Ratio) => void;
  quality: ImageQuality;
  setQuality: (value: ImageQuality) => void;
  platform: EcommercePlatformId;
  setPlatform: (value: EcommercePlatformId) => void;
  protectionLevel: ProductProtectionLevel;
  setProtectionLevel: (value: ProductProtectionLevel) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <UploadBox
          label="产品图"
          file={props.product}
          preview={props.productPreview}
          setFile={props.setProduct}
        />
        <UploadBox
          label="Logo"
          file={props.logo}
          preview={props.logoPreview}
          setFile={props.setLogo}
        />
      </div>
      <InputField
        label="产品名称"
        value={props.productName}
        onChange={props.setProductName}
        placeholder="例如：智能恒温杯"
      />
      <InputField
        label="主标题"
        value={props.title}
        onChange={props.setTitle}
        placeholder="例如：新品上市"
      />
      <InputField
        label="副标题"
        value={props.subtitle}
        onChange={props.setSubtitle}
        placeholder="例如：轻巧便携，全天候保温"
      />
      <InputField
        label="活动信息"
        value={props.campaignInfo}
        onChange={props.setCampaignInfo}
        placeholder="例如：新品首发 / 限时折扣 / Prime Day"
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="海报类型"
          value={props.posterType}
          onChange={(value) => props.setPosterType(value as PosterType)}
          options={posterTypes.map((item) => ({ value: item, label: item }))}
        />
        <SelectField
          label="风格"
          value={props.posterStyle}
          onChange={(value) => props.setPosterStyle(value as PosterStyle)}
          options={posterStyles.map((item) => ({ value: item, label: item }))}
        />
        <SelectField
          label="比例"
          value={props.ratio}
          onChange={(value) => props.setRatio(value as Ratio)}
          options={ratios.map((item) => ({ value: item, label: item }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <QualityField value={props.quality} onChange={props.setQuality} />
        <PlatformField value={props.platform} onChange={props.setPlatform} />
      </div>
      <ProductProtectionPanel
        level={props.protectionLevel}
        setLevel={props.setProtectionLevel}
      />
    </>
  );
}

function TemplateButtons({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <span className="label">提示词模板库</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ecommercePromptTemplates.map((template) => (
          <button
            key={template.id}
            className="border border-line bg-paper px-3 py-2 text-left text-sm text-ink transition hover:border-neutral-400 hover:bg-white"
            onClick={() => onPick(template.prompt)}
          >
            {template.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function UploadBox({
  label,
  file,
  preview,
  setFile,
}: {
  label: string;
  file: File | null;
  preview: string;
  setFile: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] || null;
    if (!selectedFile) {
      setFile(null);
      return;
    }

    setIsCompressing(true);
    try {
      setFile(await compressUploadImage(selectedFile));
    } catch {
      setFile(selectedFile);
    } finally {
      setIsCompressing(false);
      event.target.value = "";
    }
  }

  return (
    <div>
      <p className="label mb-2">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        className="secondary-button w-full justify-center"
        onClick={() => inputRef.current?.click()}
        disabled={isCompressing}
      >
        {isCompressing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {file ? "更换图片" : "上传图片"}
      </button>
      {file && (
        <p className="mt-2 text-xs leading-5 text-neutral-500">
          {formatFileSize(file.size)}
          {file.name.includes("-optimized") ? " · 已优化上传" : ""}
        </p>
      )}
      {preview && (
        <img
          src={preview}
          alt={`${label}预览`}
          className="mt-3 aspect-square w-full bg-paper object-cover"
        />
      )}
    </div>
  );
}

async function compressUploadImage(file: File) {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const maxDimension = 1536;
  const shouldResize =
    Math.max(bitmap.width, bitmap.height) > maxDimension || file.size > 1_500_000;

  if (!shouldResize) {
    bitmap.close?.();
    return file;
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close?.();
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputType, outputType === "image/jpeg" ? 0.82 : undefined);
  });

  if (!blob || blob.size >= file.size) {
    return file;
  }

  const extension = outputType === "image/png" ? "png" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}-optimized.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function mergeHistory(primary: HistoryItem[], secondary: HistoryItem[]) {
  const byId = new Map<string, HistoryItem>();

  for (const item of [...primary, ...secondary]) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }

  return Array.from(byId.values())
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, 80);
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="label mb-2 block">{label}</span>
      <input
        className="control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="label mb-2 block">{label}</span>
      <textarea
        className="control min-h-24 resize-none leading-6"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function QualityField({
  value,
  onChange,
}: {
  value: ImageQuality;
  onChange: (value: ImageQuality) => void;
}) {
  return (
    <SelectField
      label="质量"
      value={value}
      onChange={(nextValue) => onChange(nextValue as ImageQuality)}
      options={qualities.map((item) => ({ value: item, label: qualityLabels[item] }))}
    />
  );
}

function PlatformField({
  value,
  onChange,
}: {
  value: EcommercePlatformId;
  onChange: (value: EcommercePlatformId) => void;
}) {
  return (
    <SelectField
      label="电商平台"
      value={value}
      onChange={(nextValue) => onChange(nextValue as EcommercePlatformId)}
      options={ecommercePlatforms
        .filter((item) => item.id !== "ozon")
        .map((item) => ({
          value: item.id,
          label: item.name,
        }))}
    />
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="label mb-2 block">{label}</span>
      <select
        className="control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SegmentedNumbers({
  label,
  values,
  value,
  setValue,
}: {
  label: string;
  values: number[];
  value: number;
  setValue: (value: number) => void;
}) {
  return (
    <div>
      <label className="label mb-2 block">{label}</label>
      <div className="grid grid-cols-4 gap-2">
        {values.map((item) => (
          <button
            key={item}
            className={`border px-3 py-2 text-sm font-medium transition ${
              value === item
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-neutral-700 hover:border-neutral-400"
            }`}
            onClick={() => setValue(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function useFilePreview(
  file: File | null,
  setPreview: (value: string) => void,
  setThumb: (value: string) => void,
) {
  useEffect(() => {
    if (!file) {
      setPreview("");
      setThumb("");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    createThumbnail(file).then(setThumb).catch(() => setThumb(""));
    return () => URL.revokeObjectURL(url);
  }, [file, setPreview, setThumb]);
}

async function createThumbnail(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const size = 160;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return "";

  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  return canvas.toDataURL("image/jpeg", 0.58);
}

function tabTitle(tab: TabKey) {
  const map: Record<TabKey, string> = {
    text: "文本生图",
    mimic: "参考图模仿生图",
    product: "产品图工作流",
    variant: "产品风格变体",
    detail: "电商详情图",
    poster: "海报工作流",
  };
  return map[tab];
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds} 秒`;
  }

  return `${minutes} 分 ${String(seconds).padStart(2, "0")} 秒`;
}

function logBorderClass(level: ServerLogEntry["level"]) {
  const map: Record<ServerLogEntry["level"], string> = {
    info: "border-blue-100",
    warn: "border-amber-200",
    error: "border-red-200",
    success: "border-emerald-200",
  };
  return map[level];
}

function logTextClass(level: ServerLogEntry["level"]) {
  const map: Record<ServerLogEntry["level"], string> = {
    info: "text-blue-700",
    warn: "text-amber-700",
    error: "text-red-700",
    success: "text-emerald-700",
  };
  return map[level];
}
