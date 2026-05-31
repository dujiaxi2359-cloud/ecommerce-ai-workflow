import type { ApiProvider, UserApiKeyConfig } from "@/lib/apiKey/apiKeyTypes";

export const userApiKeyStorageKey = "commerce_ai_api_key";
export const userBaseURLStorageKey = "commerce_ai_base_url";
export const userApiProviderStorageKey = "commerce_ai_api_provider";
export const userTextModelStorageKey = "commerce_ai_text_model";
export const userImageModelStorageKey = "commerce_ai_image_model";
export const userGoogleBananaModelStorageKey = "commerce_ai_google_banana_model";
export const userAzureEndpointStorageKey = "commerce_ai_azure_endpoint";
export const userAzureDeploymentStorageKey = "commerce_ai_azure_deployment";
export const userAzureApiVersionStorageKey = "commerce_ai_azure_api_version";

function normalizeProvider(value: string | null): ApiProvider {
  if (value === "azure" || value === "azure-openai") return "azure";
  if (value === "banana" || value === "google-banana") return "banana";
  return "openai";
}

export function saveUserApiKey(config: UserApiKeyConfig) {
  localStorage.setItem(userApiProviderStorageKey, config.provider);
  localStorage.setItem(userApiKeyStorageKey, config.apiKey.trim());
  localStorage.setItem(userBaseURLStorageKey, (config.baseURL || "").trim());
  localStorage.setItem(userTextModelStorageKey, (config.textModel || "").trim());
  localStorage.setItem(userImageModelStorageKey, (config.imageModel || "").trim());
  localStorage.setItem(userGoogleBananaModelStorageKey, (config.googleBananaModel || "").trim());
  localStorage.setItem(userAzureEndpointStorageKey, (config.azureEndpoint || "").trim());
  localStorage.setItem(userAzureDeploymentStorageKey, (config.azureDeployment || "").trim());
  localStorage.setItem(userAzureApiVersionStorageKey, (config.azureApiVersion || "").trim());
}

export function loadUserApiKey(): UserApiKeyConfig {
  const provider = normalizeProvider(localStorage.getItem(userApiProviderStorageKey));
  const rawStoredImageModel = localStorage.getItem(userImageModelStorageKey) || "";
  const storedImageModel =
    provider === "openai" && rawStoredImageModel === "gpt-image-2"
      ? ""
      : rawStoredImageModel;
  const storedDeployment = localStorage.getItem(userAzureDeploymentStorageKey) || "";
  const deploymentWasImplicitDefault =
    provider === "openai" &&
    storedDeployment === "gpt-image-2" &&
    !storedImageModel;

  return {
    provider,
    apiKey: localStorage.getItem(userApiKeyStorageKey) || "",
    baseURL: localStorage.getItem(userBaseURLStorageKey) || "",
    textModel: localStorage.getItem(userTextModelStorageKey) || "",
    imageModel: storedImageModel,
    googleBananaModel: localStorage.getItem(userGoogleBananaModelStorageKey) || "banana-pro",
    azureEndpoint: localStorage.getItem(userAzureEndpointStorageKey) || "",
    azureDeployment:
      (deploymentWasImplicitDefault ? "" : storedDeployment) ||
      (provider === "azure" ? "gpt-image-2" : ""),
    azureApiVersion: localStorage.getItem(userAzureApiVersionStorageKey) || "2025-04-01-preview",
  };
}

export function clearUserApiKey() {
  localStorage.removeItem(userApiProviderStorageKey);
  localStorage.removeItem(userApiKeyStorageKey);
  localStorage.removeItem(userBaseURLStorageKey);
  localStorage.removeItem(userTextModelStorageKey);
  localStorage.removeItem(userImageModelStorageKey);
  localStorage.removeItem(userGoogleBananaModelStorageKey);
  localStorage.removeItem(userAzureEndpointStorageKey);
  localStorage.removeItem(userAzureDeploymentStorageKey);
  localStorage.removeItem(userAzureApiVersionStorageKey);
}
