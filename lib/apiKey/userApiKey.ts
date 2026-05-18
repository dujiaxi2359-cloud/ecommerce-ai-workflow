import type { UserApiKeyConfig } from "@/lib/apiKey/apiKeyTypes";

export const userApiKeyStorageKey = "commerce_ai_api_key";
export const userBaseURLStorageKey = "commerce_ai_base_url";

export function saveUserApiKey(config: UserApiKeyConfig) {
  localStorage.setItem(userApiKeyStorageKey, config.apiKey.trim());
  localStorage.setItem(userBaseURLStorageKey, (config.baseURL || "").trim());
}

export function loadUserApiKey(): UserApiKeyConfig {
  return {
    apiKey: localStorage.getItem(userApiKeyStorageKey) || "",
    baseURL: localStorage.getItem(userBaseURLStorageKey) || "",
  };
}

export function clearUserApiKey() {
  localStorage.removeItem(userApiKeyStorageKey);
  localStorage.removeItem(userBaseURLStorageKey);
}
