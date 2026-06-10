import type { AIProviderConfig } from "@/lib/ai-provider-config";
import type { Language } from "@/lib/preferences";

export type AIProviderMode = "chat_completions" | "responses";

export type GenerateAIResult =
  | {
      content: string;
      ok: true;
      providerMode?: AIProviderMode;
    }
  | {
      message: string;
      ok: false;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAIProviderMode(value: unknown): value is AIProviderMode {
  return value === "chat_completions" || value === "responses";
}

export async function generateAI({
  config,
  language,
  maxOutputTokens,
  prompt,
}: {
  config: AIProviderConfig;
  language: Language;
  maxOutputTokens?: number;
  prompt: string;
}) {
  let response: Response;

  try {
    response = await fetch("/api/ai/generate", {
      body: JSON.stringify({
        config,
        language,
        maxOutputTokens,
        prompt,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      language === "zh"
        ? `无法连接到本地 AI 代理接口：${detail}`
        : `Could not reach the local AI proxy: ${detail}`,
    );
  }

  const responseText = await response.text();
  let result: unknown;

  try {
    result = JSON.parse(responseText) as unknown;
  } catch {
    throw new Error(
      language === "zh"
        ? `AI 代理返回了无法解析的响应：${responseText.slice(0, 600) || response.statusText}`
        : `The AI proxy returned an unreadable response: ${responseText.slice(0, 600) || response.statusText}`,
    );
  }

  if (!isRecord(result) || typeof result.ok !== "boolean") {
    throw new Error(
      language === "zh"
        ? "AI 代理返回格式不正确。"
        : "The AI proxy returned an unexpected response shape.",
    );
  }

  if (!result.ok) {
    throw new Error(
      typeof result.message === "string" && result.message.trim()
        ? result.message
        : language === "zh"
          ? "AI 请求失败。"
          : "The AI request failed.",
    );
  }

  if (typeof result.content !== "string") {
    throw new Error(
      language === "zh"
        ? "AI 代理没有返回可读文本。"
        : "The AI proxy did not return readable text.",
    );
  }

  return {
    content: result.content,
    ok: true,
    ...(isAIProviderMode(result.providerMode) ? { providerMode: result.providerMode } : {}),
  } satisfies GenerateAIResult;
}

export async function generateAIResponse(input: Parameters<typeof generateAI>[0]) {
  const result = await generateAI(input);
  return result.content;
}
