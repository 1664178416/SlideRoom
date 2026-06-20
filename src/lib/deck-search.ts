import type { Slide } from "@/lib/mock-data";
import {
  getSlideDisplayKicker,
  getSlideDisplayLabel,
  getSlideDisplayMetricLabel,
  getSlideDisplaySummary,
  getSlideDisplayTitle,
  getSlideDisplayVisualSummary,
} from "@/lib/slide-derived";
import {
  getSlideSectionLabel,
  getSlideSectionKey,
  type Language,
  type TranslationKey,
} from "@/lib/preferences";

const unboundedPreviewLength = Number.POSITIVE_INFINITY;

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clipSearchText(value: string, maxLength = unboundedPreviewLength) {
  const cleanValue = normalizeSearchText(value);
  if (!Number.isFinite(maxLength) || cleanValue.length <= maxLength) return cleanValue;

  return `${cleanValue.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

export function getImportedSlidePreview(
  slide: Pick<Slide, "extractedText" | "speakerNotes">,
  maxLength = unboundedPreviewLength,
): { key: TranslationKey; value: string } {
  const rawText = clipSearchText(slide.extractedText, maxLength);
  const rawNotes = clipSearchText(slide.speakerNotes, maxLength);

  if (rawText) {
    return {
      key: "rail.rawExcerpt",
      value: rawText,
    };
  }

  if (rawNotes) {
    return {
      key: "rail.rawNotes",
      value: rawNotes,
    };
  }

  return {
    key: "rail.noReadableText",
    value: "",
  };
}

export function buildSlideSearchText(
  slide: Slide,
  {
    language,
    t,
  }: {
    language: Language;
    t: (key: TranslationKey) => string;
  },
) {
  return [
    String(slide.pageNumber),
    String(slide.pageNumber).padStart(2, "0"),
    getSlideDisplayLabel(slide, language),
    getSlideDisplayLabel(slide, "zh"),
    getSlideDisplayLabel(slide, "en"),
    slide.title,
    getSlideDisplayTitle(slide, language),
    getSlideDisplayTitle(slide, "zh"),
    getSlideDisplayTitle(slide, "en"),
    slide.section,
    `section.${slide.section}`,
    t(getSlideSectionKey(slide.section)),
    getSlideSectionLabel(slide.section, "zh"),
    getSlideSectionLabel(slide.section, "en"),
    slide.kicker,
    getSlideDisplayKicker(slide, language),
    getSlideDisplayKicker(slide, "zh"),
    getSlideDisplayKicker(slide, "en"),
    slide.summary,
    getSlideDisplaySummary(slide, language),
    getSlideDisplaySummary(slide, "zh"),
    getSlideDisplaySummary(slide, "en"),
    slide.extractedText,
    slide.visualSummary,
    getSlideDisplayVisualSummary(slide, language),
    getSlideDisplayVisualSummary(slide, "zh"),
    getSlideDisplayVisualSummary(slide, "en"),
    slide.speakerNotes,
    slide.bullets.join(" "),
    slide.metrics
      .map(
        (metric) =>
          `${metric.label} ${getSlideDisplayMetricLabel(metric.label, language)} ${getSlideDisplayMetricLabel(metric.label, "zh")} ${getSlideDisplayMetricLabel(metric.label, "en")} ${metric.value}`,
      )
      .join(" "),
  ]
    .join(" ")
    .toLowerCase();
}
