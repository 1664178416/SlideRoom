export type AIProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const aiProviderConfigStorageKey = "slideroom-ai-provider-config-v1";

export const defaultAIProviderConfig: AIProviderConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeAIProviderConfig(value: unknown): AIProviderConfig {
  if (!isRecord(value)) return defaultAIProviderConfig;

  return {
    apiKey: typeof value.apiKey === "string" ? value.apiKey.trim() : "",
    baseUrl:
      typeof value.baseUrl === "string" && value.baseUrl.trim()
        ? value.baseUrl.trim()
        : defaultAIProviderConfig.baseUrl,
    model: typeof value.model === "string" ? value.model.trim() : "",
  };
}

export function readAIProviderConfig(): AIProviderConfig {
  if (typeof window === "undefined") return defaultAIProviderConfig;

  try {
    const storedConfig = window.localStorage.getItem(aiProviderConfigStorageKey);
    if (!storedConfig) return defaultAIProviderConfig;

    return sanitizeAIProviderConfig(JSON.parse(storedConfig));
  } catch {
    return defaultAIProviderConfig;
  }
}

export function writeAIProviderConfig(config: AIProviderConfig) {
  if (typeof window === "undefined") return defaultAIProviderConfig;

  const nextConfig = sanitizeAIProviderConfig(config);

  try {
    window.localStorage.setItem(aiProviderConfigStorageKey, JSON.stringify(nextConfig));
  } catch {
    // Storage can be unavailable in private mode or constrained environments.
  }

  return nextConfig;
}

export function clearAIProviderConfig() {
  if (typeof window === "undefined") return defaultAIProviderConfig;

  try {
    window.localStorage.removeItem(aiProviderConfigStorageKey);
  } catch {
    // Storage can be unavailable in private mode or constrained environments.
  }

  return defaultAIProviderConfig;
}
