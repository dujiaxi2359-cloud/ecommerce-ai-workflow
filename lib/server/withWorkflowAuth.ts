import { NextResponse } from "next/server";
import type OpenAI from "openai";
import type { ApiProvider } from "@/lib/apiKey/apiKeyTypes";
import { createOpenAIClientFromRequest, sanitizeApiKeyError } from "@/lib/apiKey/openaiClientFromRequest";
import { checkCredits } from "@/lib/credits/checkCredits";
import { hasFeatureAccess } from "@/lib/license/featureAccess";
import type { FeatureKey, LicenseStatus } from "@/lib/license/licenseTypes";
import { verifyLicense } from "@/lib/license/verifyLicense";

export type WorkflowAuthContext = {
  license: LicenseStatus;
  openai?: OpenAI;
  apiProvider?: ApiProvider;
  apiKey?: string;
  baseURL?: string;
  azureEndpoint?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
};

export type WorkflowAuthInput = {
  licenseCode?: string;
  apiProvider?: ApiProvider;
  apiKey?: string;
  baseURL?: string;
  azureEndpoint?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
  featureKey: FeatureKey;
  requireApiKey?: boolean;
};

export function workflowAuthError(message: string, status = 403) {
  return NextResponse.json({ error: message }, { status });
}

export async function validateWorkflowAuth({
  licenseCode,
  apiProvider = "azure",
  apiKey,
  baseURL,
  azureEndpoint,
  azureDeployment,
  azureApiVersion,
  featureKey,
  requireApiKey = true,
}: WorkflowAuthInput): Promise<WorkflowAuthContext> {
  const license = verifyLicense(licenseCode || "");
  if (!license.valid) {
    throw new Error(license.message || "授权码无效，请先激活工具权限。");
  }

  if (!hasFeatureAccess(license, featureKey)) {
    throw new Error("当前授权套餐无权使用该工作流。");
  }

  const creditCheck = await checkCredits();
  if (!creditCheck.allowed) {
    throw new Error(creditCheck.message || "额度不足，无法使用该工作流。");
  }

  if (!requireApiKey) {
    return {
      license,
      apiProvider,
      apiKey: apiKey || "",
      baseURL: baseURL || "",
      azureEndpoint: azureEndpoint || "",
      azureDeployment: azureDeployment || "",
      azureApiVersion: azureApiVersion || "",
    };
  }

  const openai = createOpenAIClientFromRequest({
    provider: apiProvider,
    apiKey: apiKey || "",
    baseURL: baseURL || "",
    azureEndpoint: azureEndpoint || "",
    azureDeployment: azureDeployment || "",
    azureApiVersion: azureApiVersion || "",
  });

  return {
    license,
    openai,
    apiProvider,
    apiKey: apiKey || "",
    baseURL: baseURL || "",
    azureEndpoint: azureEndpoint || "",
    azureDeployment: azureDeployment || "",
    azureApiVersion: azureApiVersion || "",
  };
}

export async function withWorkflowAuthFromFormData(
  formData: FormData,
  featureKey: FeatureKey,
  options: { requireApiKey?: boolean } = {},
) {
  const apiKey = String(formData.get("apiKey") || "");
  try {
    return await validateWorkflowAuth({
      licenseCode: String(formData.get("licenseCode") || ""),
      apiProvider: String(formData.get("apiProvider") || "azure") as ApiProvider,
      apiKey,
      baseURL: String(formData.get("baseURL") || ""),
      azureEndpoint: String(formData.get("azureEndpoint") || ""),
      azureDeployment: String(formData.get("azureDeployment") || ""),
      azureApiVersion: String(formData.get("azureApiVersion") || ""),
      featureKey,
      requireApiKey: options.requireApiKey,
    });
  } catch (error) {
    return workflowAuthError(
      sanitizeApiKeyError(
        error instanceof Error ? error.message : "工作流权限校验失败。",
        apiKey,
      ),
    );
  }
}

export async function withWorkflowAuthFromJson(
  body: {
    licenseCode?: string;
    apiProvider?: ApiProvider;
    apiKey?: string;
    baseURL?: string;
    azureEndpoint?: string;
    azureDeployment?: string;
    azureApiVersion?: string;
  },
  featureKey: FeatureKey,
  options: { requireApiKey?: boolean } = {},
) {
  try {
    return await validateWorkflowAuth({
      licenseCode: body.licenseCode || "",
      apiProvider: body.apiProvider || "azure",
      apiKey: body.apiKey || "",
      baseURL: body.baseURL || "",
      azureEndpoint: body.azureEndpoint || "",
      azureDeployment: body.azureDeployment || "",
      azureApiVersion: body.azureApiVersion || "",
      featureKey,
      requireApiKey: options.requireApiKey,
    });
  } catch (error) {
    return workflowAuthError(
      sanitizeApiKeyError(
        error instanceof Error ? error.message : "工作流权限校验失败。",
        body.apiKey || "",
      ),
    );
  }
}

export function isWorkflowAuthResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
