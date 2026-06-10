import { NextRequest, NextResponse } from "next/server";
import { sanitizeAIProviderConfig, type AIProviderConfig } from "@/lib/ai-provider-config";
import type { Language } from "@/lib/preferences";

type GenerateRequest = {
  config?: AIProviderConfig;
  language?: Language;
  maxOutputTokens?: number;
  prompt?: string;
};

type ProviderMode = "responses" | "chat_completions";

type ProviderAttempt =
  | {
      content: string;
      endpoint: string;
      mode: ProviderMode;
      ok: true;
    }
  | {
      endpoint: string;
      message: string;
      mode: ProviderMode;
      ok: false;
      status?: number;
    };

const maxPromptLength = 18000;
const defaultModelOutputTokens = 120;
const minModelOutputTokens = 8;
const maxModelOutputTokens = 240;
const providerRequestTimeoutMs = 45000;

const providerModeLabels: Record<ProviderMode, string> = {
  chat_completions: "Chat Completions",
  responses: "Responses API",
};

function isLanguage(value: unknown): value is Language {
  return value === "zh" || value === "en";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

function isLikelyLocalBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().toLowerCase();

  return (
    trimmed.startsWith("localhost") ||
    trimmed.startsWith("127.0.0.1") ||
    trimmed.startsWith("[::1]") ||
    trimmed.startsWith("::1")
  );
}

function getInvalidBaseUrlMessage(language: Language) {
  return language === "zh"
    ? "Base URL 必须是有效的 http(s) 地址，例如 https://api.openai.com/v1。"
    : "Base URL must be a valid http(s) URL, for example https://api.openai.com/v1.";
}

function normalizeProviderBaseUrl(baseUrl: string, language: Language) {
  const trimmedBaseUrl = trimBaseUrl(baseUrl);
  const baseUrlWithProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmedBaseUrl)
    ? trimmedBaseUrl
    : `${isLikelyLocalBaseUrl(trimmedBaseUrl) ? "http" : "https"}://${trimmedBaseUrl}`;

  try {
    const parsedUrl = new URL(baseUrlWithProtocol);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return {
        message: getInvalidBaseUrlMessage(language),
        ok: false as const,
      };
    }

    parsedUrl.hash = "";
    parsedUrl.search = "";

    return {
      baseUrl: trimBaseUrl(parsedUrl.toString()),
      ok: true as const,
    };
  } catch {
    return {
      message: getInvalidBaseUrlMessage(language),
      ok: false as const,
    };
  }
}

function getEndpointBase(baseUrl: string) {
  return trimBaseUrl(baseUrl)
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/responses$/i, "");
}

function buildResponsesEndpoint(baseUrl: string) {
  const normalizedBaseUrl = trimBaseUrl(baseUrl);
  if (/\/responses$/i.test(normalizedBaseUrl)) return normalizedBaseUrl;
  if (/\/chat\/completions$/i.test(normalizedBaseUrl)) {
    return normalizedBaseUrl.replace(/\/chat\/completions$/i, "/responses");
  }

  return `${getEndpointBase(baseUrl)}/responses`;
}

function buildChatCompletionsEndpoint(baseUrl: string) {
  const normalizedBaseUrl = trimBaseUrl(baseUrl);
  if (/\/chat\/completions$/i.test(normalizedBaseUrl)) return normalizedBaseUrl;
  if (/\/responses$/i.test(normalizedBaseUrl)) {
    return normalizedBaseUrl.replace(/\/responses$/i, "/chat/completions");
  }

  return `${getEndpointBase(baseUrl)}/chat/completions`;
}

function getErrorDetail(error: unknown) {
  if (!(error instanceof Error)) return String(error);

  const cause = error.cause;
  if (cause && typeof cause === "object") {
    const causeRecord = cause as Record<string, unknown>;
    const causeCode = typeof causeRecord.code === "string" ? causeRecord.code : "";
    const causeMessage = typeof causeRecord.message === "string" ? causeRecord.message : "";
    const causeDetail = [causeCode, causeMessage].filter(Boolean).join(" ");

    if (causeDetail) return `${error.message} (${causeDetail})`;
  }

  return error.message;
}

function getNetworkErrorMessage(error: unknown, endpoint: string, language: Language) {
  const detail = getErrorDetail(error);

  if (language === "zh") {
    return [
      "无法连接到模型服务。",
      "请检查 Base URL 是否正确、当前网络/代理是否能访问该域名，以及服务商是否支持对应的 OpenAI-compatible 接口。",
      `底层错误：${detail}`,
    ].join("\n");
  }

  return [
    "Could not connect to the model provider.",
    "Check whether the Base URL is correct, your network/proxy can reach the domain, and the provider supports the matching OpenAI-compatible endpoint.",
    `Low-level error: ${detail}`,
  ].join("\n");
}

function getSystemPrompt(language: Language) {
  if (language === "zh") {
    return [
      "你是 SlideRoom 的 PPT 阅读助手。",
      "只根据用户提供的幻灯片上下文回答，不要编造不存在的数据。",
      "默认输出要短，目标是帮用户少读，而不是替 PPT 写文章。",
      "严格遵守用户要求的行数和字数；预设生成只写 1 行短句，宁可少写。",
      "不要解释你为什么这样判断，不要补充背景，不要复述页面原文。",
      "不要使用项目符号、编号、Markdown 或多段落，除非用户明确要求。",
      "除非用户明确要求展开，否则最多 2 行；每行只保留一个判断。",
      "不要写 Markdown 标题、铺垫、客套或长段落。",
    ].join("\n");
  }

  return [
    "You are SlideRoom's PPT reading assistant.",
    "Answer only from the slide context provided by the user. Do not invent missing data.",
    "Default to short answers that save reading time instead of rewriting the slide.",
    "Strictly follow the requested line and length limits. Presets must be one short line; write less.",
    "Do not explain your reasoning, add background, or restate slide text.",
    "Do not use bullets, numbering, Markdown, or multiple paragraphs unless the user explicitly asks.",
    "Unless the user asks for depth, keep the answer to 2 lines with one judgment per line.",
    "Do not use Markdown headings, preambles, pleasantries, or long paragraphs.",
  ].join("\n");
}

function resolveOutputTokenLimit(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultModelOutputTokens;

  return Math.min(maxModelOutputTokens, Math.max(minModelOutputTokens, Math.round(value)));
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      message,
      ok: false,
    },
    { status },
  );
}

async function readProviderPayload(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      message: text.slice(0, 1200),
    };
  }
}

function collectTextParts(value: unknown, depth = 0): string[] {
  if (depth > 5) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextParts(item, depth + 1));
  }
  if (!isRecord(value)) return [];

  return ["output_text", "content", "text", "value"].flatMap((key) => {
    const nextValue = value[key];
    if (typeof nextValue === "string") return [nextValue];
    if (Array.isArray(nextValue) || isRecord(nextValue)) return collectTextParts(nextValue, depth + 1);
    return [];
  });
}

function joinTextParts(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseChatCompletionsContent(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return "";

  return joinTextParts(
    payload.choices.flatMap((choice) => {
      if (!isRecord(choice)) return [];

      if (choice.message) {
        return collectTextParts(choice.message);
      }
      if (choice.delta) {
        return collectTextParts(choice.delta);
      }
      if (typeof choice.text === "string") {
        return [choice.text];
      }

      return [];
    }),
  );
}

function parseResponsesContent(payload: unknown) {
  if (!isRecord(payload)) return "";

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload.output)) {
    const outputText = joinTextParts(
      payload.output.flatMap((item) => {
        if (!isRecord(item)) return collectTextParts(item);
        return collectTextParts(item.content ?? item);
      }),
    );

    if (outputText) return outputText;
  }

  return parseChatCompletionsContent(payload);
}

function getProviderErrorMessage(payload: unknown, status: number) {
  if (isRecord(payload)) {
    const error = payload.error;
    if (isRecord(error)) {
      const message = typeof error.message === "string" ? error.message : "";
      const code = typeof error.code === "string" ? error.code : "";
      const type = typeof error.type === "string" ? error.type : "";
      const detail = [code, type].filter(Boolean).join(", ");

      if (message && detail) return `${message} (${detail})`;
      if (message) return message;
      if (detail) return detail;
    }

    if (typeof error === "string") return error;
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.detail === "string") return payload.detail;
  }

  return `Provider request failed with status ${status}.`;
}

function redactSensitiveText(value: string, config: AIProviderConfig) {
  const apiKey = config.apiKey.trim();
  const redactedValue = apiKey ? value.split(apiKey).join("[redacted-api-key]") : value;

  return redactedValue
    .replace(/Bearer\s+[^\s,;"')]+/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "sk-[redacted]");
}

async function requestProvider({
  body,
  config,
  endpoint,
  language,
  mode,
  parseContent,
}: {
  body: unknown;
  config: AIProviderConfig;
  endpoint: string;
  language: Language;
  mode: ProviderMode;
  parseContent: (payload: unknown) => string;
}): Promise<ProviderAttempt> {
  try {
    const providerResponse = await fetch(endpoint, {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(providerRequestTimeoutMs),
    });
    const providerPayload = await readProviderPayload(providerResponse);

    if (!providerResponse.ok) {
      return {
        endpoint,
        message: redactSensitiveText(getProviderErrorMessage(providerPayload, providerResponse.status), config),
        mode,
        ok: false,
        status: providerResponse.status,
      };
    }

    const content = parseContent(providerPayload);
    if (!content) {
      return {
        endpoint,
        message: "The model returned an empty response.",
        mode,
        ok: false,
        status: 502,
      };
    }

    return {
      content,
      endpoint,
      mode,
      ok: true,
    };
  } catch (error) {
    return {
      endpoint,
      message: redactSensitiveText(getNetworkErrorMessage(error, endpoint, language), config),
      mode,
      ok: false,
    };
  }
}

function shouldTryChatFallback(attempt: ProviderAttempt) {
  if (attempt.ok) return false;
  if (attempt.status === 401 || attempt.status === 403 || attempt.status === 429) return false;

  return true;
}

function formatAttemptFailure(attempt: Extract<ProviderAttempt, { ok: false }>) {
  const status = attempt.status ? `HTTP ${attempt.status}` : "network";

  return [
    `${providerModeLabels[attempt.mode]} (${status})`,
    attempt.message,
  ].join("\n");
}

function getCombinedFailureMessage(
  language: Language,
  attempts: Array<Extract<ProviderAttempt, { ok: false }>>,
  modePreference: AIProviderConfig["providerMode"],
) {
  const routeNote = modePreference === "responses"
    ? language === "zh"
      ? "当前接口模式固定为 Responses API。"
      : "The interface mode is fixed to Responses API."
    : modePreference === "chat_completions"
      ? language === "zh"
        ? "当前接口模式固定为 Chat Completions。"
        : "The interface mode is fixed to Chat Completions."
      : language === "zh"
        ? "已按自动模式先尝试 Responses API；如可回退，再尝试 Chat Completions。"
        : "Auto mode tried Responses API first, then Chat Completions when fallback was allowed.";

  if (language === "zh") {
    return [
      "模型请求失败，未生成结果。",
      routeNote,
      "",
      ...attempts.map(formatAttemptFailure),
    ].join("\n\n");
  }

  return [
    "The model request failed. No result was generated.",
    routeNote,
    "",
    ...attempts.map(formatAttemptFailure),
  ].join("\n\n");
}

export async function POST(request: NextRequest) {
  let payload: GenerateRequest;

  try {
    payload = (await request.json()) as GenerateRequest;
  } catch {
    return errorResponse("Invalid JSON body.");
  }

  const config = sanitizeAIProviderConfig(payload.config);
  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  const language = isLanguage(payload.language) ? payload.language : "en";
  const outputTokenLimit = resolveOutputTokenLimit(payload.maxOutputTokens);

  if (!config.apiKey) return errorResponse("API key is required.");
  if (!config.baseUrl) return errorResponse("Base URL is required.");
  if (!config.model) return errorResponse("Model is required.");
  if (!prompt) return errorResponse("Prompt is required.");

  const normalizedBaseUrl = normalizeProviderBaseUrl(config.baseUrl, language);
  if (!normalizedBaseUrl.ok) return errorResponse(normalizedBaseUrl.message);

  const normalizedConfig = {
    ...config,
    baseUrl: normalizedBaseUrl.baseUrl,
  };
  const clippedPrompt = prompt.slice(0, maxPromptLength);
  const systemPrompt = getSystemPrompt(language);
  const shouldUseResponses = normalizedConfig.providerMode === "auto" || normalizedConfig.providerMode === "responses";
  const shouldUseChat = normalizedConfig.providerMode === "auto" || normalizedConfig.providerMode === "chat_completions";
  const failedAttempts: Array<Extract<ProviderAttempt, { ok: false }>> = [];

  if (shouldUseResponses) {
    const responsesEndpoint = buildResponsesEndpoint(normalizedConfig.baseUrl);
    const responsesAttempt = await requestProvider({
      body: {
        input: clippedPrompt,
        instructions: systemPrompt,
        max_output_tokens: outputTokenLimit,
        model: config.model,
        temperature: 0.2,
      },
      config: normalizedConfig,
      endpoint: responsesEndpoint,
      language,
      mode: "responses",
      parseContent: parseResponsesContent,
    });

    if (responsesAttempt.ok) {
      return NextResponse.json({
        content: responsesAttempt.content,
        ok: true,
        providerMode: responsesAttempt.mode,
      });
    }

    failedAttempts.push(responsesAttempt);

    if (normalizedConfig.providerMode === "responses" || !shouldTryChatFallback(responsesAttempt)) {
      return errorResponse(
        getCombinedFailureMessage(language, failedAttempts, normalizedConfig.providerMode),
        responsesAttempt.status ?? 502,
      );
    }
  }

  if (shouldUseChat) {
    const chatEndpoint = buildChatCompletionsEndpoint(normalizedConfig.baseUrl);
    const chatAttempt = await requestProvider({
      body: {
        max_tokens: outputTokenLimit,
        messages: [
          {
            content: systemPrompt,
            role: "system",
          },
          {
            content: clippedPrompt,
            role: "user",
          },
        ],
        model: config.model,
        temperature: 0.2,
      },
      config: normalizedConfig,
      endpoint: chatEndpoint,
      language,
      mode: "chat_completions",
      parseContent: parseChatCompletionsContent,
    });

    if (chatAttempt.ok) {
      return NextResponse.json({
        content: chatAttempt.content,
        ok: true,
        providerMode: chatAttempt.mode,
      });
    }

    failedAttempts.push(chatAttempt);
  }

  const lastAttempt = failedAttempts[failedAttempts.length - 1];
  const status = lastAttempt?.status && [401, 403, 429].includes(lastAttempt.status) ? lastAttempt.status : 502;

  return errorResponse(
    getCombinedFailureMessage(language, failedAttempts, normalizedConfig.providerMode),
    status,
  );
}
