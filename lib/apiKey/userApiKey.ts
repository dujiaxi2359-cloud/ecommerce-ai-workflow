import type { ApiProvider, UserApiKeyConfig } from "@/lib/apiKey/apiKeyTypes";

export const userApiKeyStorageKey = "commerce_ai_api_key";
export const userBaseURLStorageKey = "commerce_ai_base_url";
export const userApiProviderStorageKey = "commerce_ai_api_provider";
export const userAzureEndpointStorageKey = "commerce_ai_azure_endpoint";
export const userAzureDeploymentStorageKey = "commerce_ai_azure_deployment";
export const userAzureApiVersionStorageKey = "commerce_ai_azure_api_version";

function normalizeProvider(value: string | null): ApiProvider {
  return value === "openai" ? "openai" : "azure";
}

export function saveUserApiKey(config: UserApiKeyConfig) {
  localStorage.setItem(userApiProviderStorageKey, config.provider);
  localStorage.setItem(userApiKeyStorageKey, config.apiKey.trim());
  localStorage.setItem(userBaseURLStorageKey, (config.baseURL || "").trim());
  localStorage.setItem(userAzureEndpointStorageKey, (config.azureEndpoint || "").trim());
  localStorage.setItem(userAzureDeploymentStorageKey, (config.azureDeployment || "").trim());
  localStorage.setItem(userAzureApiVersionStorageKey, (config.azureApiVersion || "").trim());
}

export function loadUserApiKey(): UserApiKeyConfig {
  return {
    provider: normalizeProvider(localStorage.getItem(userApiProviderStorageKey)),
    apiKey: localStorage.getItem(userApiKeyStorageKey) || "",
    baseURL: localStorage.getItem(userBaseURLStorageKey) || "",
    azureEndpoint: localStorage.getItem(userAzureEndpointStorageKey) || "",
    azureDeployment: localStorage.getItem(userAzureDeploymentStorageKey) || "gpt-image-2",
    azureApiVersion: localStorage.getItem(userAzureApiVersionStorageKey) || "2025-04-01-preview",
  };
}

export function clearUserApiKey() {
  localStorage.removeItem(userApiProviderStorageKey);
  localStorage.removeItem(userApiKeyStorageKey);
  localStorage.removeItem(userBaseURLStorageKey);
  localStorage.removeItem(userAzureEndpointStorageKey);
  localStorage.removeItem(userAzureDeploymentStorageKey);
  localStorage.removeItem(userAzureApiVersionStorageKey);
}
