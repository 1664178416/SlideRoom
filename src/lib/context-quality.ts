import type { TranslationKey } from "@/lib/preferences";
import type { DeckContextQuality } from "@/lib/upload-contract";

export const contextQualityLabelKeys: Record<DeckContextQuality, TranslationKey> = {
  failed: "home.contextFailed",
  parsed: "home.contextParsed",
  partial: "home.contextPartial",
  preview_only: "home.contextPreviewOnly",
};

export function getContextQualityTone(
  quality?: DeckContextQuality,
): "neutral" | "accent" | "success" | "danger" {
  if (quality === "parsed") return "success";
  if (quality === "partial") return "accent";
  if (quality === "failed") return "danger";
  return "neutral";
}
