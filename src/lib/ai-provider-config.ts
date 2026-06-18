export type AIProviderModePreference = "auto" | "chat_completions" | "responses";

export type AIProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  providerMode: AIProviderModePreference;
};

const aiProviderConfigStorageKey = "slideroom-ai-provider-config-v1";

export const aiProviderConfigChangeEvent = "slideroom-ai-provider-config-change";

export const defaultAIProviderConfig: AIProviderConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "",
  providerMode: "auto",
};

let memoryAIProviderConfig: AIProviderConfig = defaultAIProviderConfig;
let memoryAIProviderConfigFallbackActive = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAIProviderModePreference(value: unknown): value is AIProviderModePreference {
  return value === "auto" || value === "chat_completions" || value === "responses";
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
    providerMode: isAIProviderModePreference(value.providerMode)
      ? value.providerMode
      : defaultAIProviderConfig.providerMode,
  };
}

export function isCompleteAIProviderConfig(config: AIProviderConfig) {
  return (
    config.apiKey.trim().length > 0 &&
    config.baseUrl.trim().length > 0 &&
    config.model.trim().length > 0
  );
}

function notifyAIProviderConfigChange() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(aiProviderConfigChangeEvent));
}

export function readAIProviderConfig(): AIProviderConfig {
  if (typeof window === "undefined") return memoryAIProviderConfig;

  try {
    const storedConfig = window.localStorage.getItem(aiProviderConfigStorageKey);
    if (!storedConfig) {
      if (memoryAIProviderConfigFallbackActive) return memoryAIProviderConfig;

      memoryAIProviderConfig = defaultAIProviderConfig;
      return defaultAIProviderConfig;
    }

    const nextConfig = sanitizeAIProviderConfig(JSON.parse(storedConfig));
    memoryAIProviderConfig = nextConfig;
    memoryAIProviderConfigFallbackActive = false;
    return nextConfig;
  } catch {
    return memoryAIProviderConfig;
  }
}

export function writeAIProviderConfig(config: AIProviderConfig) {
  const nextConfig = sanitizeAIProviderConfig(config);
  memoryAIProviderConfig = nextConfig;
  memoryAIProviderConfigFallbackActive = false;

  if (typeof window === "undefined") return nextConfig;

  try {
    window.localStorage.setItem(aiProviderConfigStorageKey, JSON.stringify(nextConfig));
  } catch {
    memoryAIProviderConfigFallbackActive = true;
    // Storage can be unavailable in private mode or constrained environments.
  }

  notifyAIProviderConfigChange();

  return nextConfig;
}

export function clearAIProviderConfig() {
  memoryAIProviderConfig = defaultAIProviderConfig;
  memoryAIProviderConfigFallbackActive = false;
  if (typeof window === "undefined") return defaultAIProviderConfig;

  try {
    window.localStorage.removeItem(aiProviderConfigStorageKey);
  } catch {
    // Storage can be unavailable in private mode or constrained environments.
  }

  notifyAIProviderConfigChange();

  return defaultAIProviderConfig;
}
