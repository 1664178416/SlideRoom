import type { Slide } from "@/lib/mock-data";
import {
  formatSlideLabel,
  getGeneratedKickerLabel,
  getGeneratedMetricLabel,
  getGeneratedSlideSummary,
  getGeneratedSlideTitle,
  getGeneratedVisualSummary,
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
    formatSlideLabel(slide.pageNumber, language),
    formatSlideLabel(slide.pageNumber, "zh"),
    formatSlideLabel(slide.pageNumber, "en"),
    slide.title,
    getGeneratedSlideTitle(slide.title, slide.pageNumber, language),
    getGeneratedSlideTitle(slide.title, slide.pageNumber, "zh"),
    getGeneratedSlideTitle(slide.title, slide.pageNumber, "en"),
    slide.section,
    `section.${slide.section}`,
    t(getSlideSectionKey(slide.section)),
    getSlideSectionLabel(slide.section, "zh"),
    getSlideSectionLabel(slide.section, "en"),
    slide.kicker,
    getGeneratedKickerLabel(slide.kicker, language),
    getGeneratedKickerLabel(slide.kicker, "zh"),
    getGeneratedKickerLabel(slide.kicker, "en"),
    slide.summary,
    getGeneratedSlideSummary(slide.summary, slide.pageNumber, language),
    getGeneratedSlideSummary(slide.summary, slide.pageNumber, "zh"),
    getGeneratedSlideSummary(slide.summary, slide.pageNumber, "en"),
    slide.extractedText,
    slide.visualSummary,
    getGeneratedVisualSummary(slide.visualSummary, language),
    getGeneratedVisualSummary(slide.visualSummary, "zh"),
    getGeneratedVisualSummary(slide.visualSummary, "en"),
    slide.speakerNotes,
    slide.bullets.join(" "),
    slide.metrics
      .map(
        (metric) =>
          `${metric.label} ${getGeneratedMetricLabel(metric.label, language)} ${getGeneratedMetricLabel(metric.label, "zh")} ${getGeneratedMetricLabel(metric.label, "en")} ${metric.value}`,
      )
      .join(" "),
  ]
    .join(" ")
    .toLowerCase();
}
