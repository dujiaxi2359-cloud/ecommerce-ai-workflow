export type ApiProvider = "azure" | "openai";

export type UserApiKeyConfig = {
  provider: ApiProvider;
  apiKey: string;
  baseURL?: string;
  azureEndpoint?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
};
