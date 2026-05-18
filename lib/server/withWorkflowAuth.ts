import { NextResponse } from "next/server";
import type OpenAI from "openai";
import { createOpenAIClientFromRequest, sanitizeApiKeyError } from "@/lib/apiKey/openaiClientFromRequest";
import { checkCredits } from "@/lib/credits/checkCredits";
import { hasFeatureAccess } from "@/lib/license/featureAccess";
import type { FeatureKey, LicenseStatus } from "@/lib/license/licenseTypes";
import { verifyLicense } from "@/lib/license/verifyLicense";

export type WorkflowAuthContext = {
  license: LicenseStatus;
  openai?: OpenAI;
  apiKey?: string;
  baseURL?: string;
};

export type WorkflowAuthInput = {
  licenseCode?: string;
  apiKey?: string;
  baseURL?: string;
  featureKey: FeatureKey;
  requireApiKey?: boolean;
};

export function workflowAuthError(message: string, status = 403) {
  return NextResponse.json({ error: message }, { status });
}

export async function validateWorkflowAuth({
  licenseCode,
  apiKey,
  baseURL,
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
    return { license, apiKey: apiKey || "", baseURL: baseURL || "" };
  }

  const openai = createOpenAIClientFromRequest({
    apiKey: apiKey || "",
    baseURL: baseURL || "",
  });

  return {
    license,
    openai,
    apiKey: apiKey || "",
    baseURL: baseURL || "",
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
      apiKey,
      baseURL: String(formData.get("baseURL") || ""),
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
  body: { licenseCode?: string; apiKey?: string; baseURL?: string },
  featureKey: FeatureKey,
  options: { requireApiKey?: boolean } = {},
) {
  try {
    return await validateWorkflowAuth({
      licenseCode: body.licenseCode || "",
      apiKey: body.apiKey || "",
      baseURL: body.baseURL || "",
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
