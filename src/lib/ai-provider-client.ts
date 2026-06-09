import type { AIProviderConfig } from "@/lib/ai-provider-config";
import type { Language } from "@/lib/preferences";

export type GenerateAIResult =
  | {
      content: string;
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

export async function generateAIResponse({
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
  let result: GenerateAIResult;

  try {
    result = JSON.parse(responseText) as GenerateAIResult;
  } catch {
    throw new Error(
      language === "zh"
        ? `AI 代理返回了无法解析的响应：${responseText.slice(0, 600) || response.statusText}`
        : `The AI proxy returned an unreadable response: ${responseText.slice(0, 600) || response.statusText}`,
    );
  }

  if (!result.ok) {
    throw new Error(result.message);
  }

  return result.content;
}
