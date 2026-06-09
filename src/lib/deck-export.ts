import { contextQualityLabelKeys } from "@/lib/context-quality";
import { getPersistedAISlideExportLines } from "@/lib/ai-inspector";
import { getDeckFileStem } from "@/lib/deck-display";
import {
  formatMarkdownCodeBlock,
  formatMarkdownInline,
  formatMarkdownListItems,
  formatMarkdownQuote,
  getMarkdownEmptyValue,
} from "@/lib/markdown-export";
import { deckMeta, type Slide } from "@/lib/mock-data";
import type { DeckContextQuality, SlideContextStats } from "@/lib/upload-contract";
import {
  formatSlideLabel,
  getGeneratedMetricLabel,
  getGeneratedSlideTitle,
  getGeneratedSlideSummary,
  getGeneratedVisualSummary,
  getSlideSectionKey,
  type Language,
  type TranslationKey,
} from "@/lib/preferences";

type BuildDeckMarkdownExportInput = {
  contextQuality: DeckContextQuality;
  contextStats: SlideContextStats;
  deckFileName: string;
  deckSlides: Slide[];
  deckTitle: string;
  language: Language;
  pageCount: number;
  t: (key: TranslationKey) => string;
};

const maxExportExtractedTextLength = 1800;
const maxExportSpeakerNotesLength = 2400;

function clipExportText(value: string, maxLength: number, language: Language) {
  const cleanValue = value.trim();
  if (cleanValue.length <= maxLength) return cleanValue;

  const hiddenLength = cleanValue.length - maxLength;
  const suffix =
    language === "zh"
      ? `\n\n[已截断 ${hiddenLength} 字，完整原文仍保留在工作台中]`
      : `\n\n[truncated ${hiddenLength} chars; full text remains in the workspace]`;

  return `${cleanValue.slice(0, maxLength).trimEnd()}${suffix}`;
}

export function getDeckMarkdownFileName(deckFileName: string, language: Language) {
  return `${getDeckFileStem(deckFileName, deckMeta.id)}-${language}-notes.md`;
}

export function buildDeckMarkdownExport({
  contextQuality,
  contextStats,
  deckFileName,
  deckSlides,
  deckTitle,
  language,
  pageCount,
  t,
}: BuildDeckMarkdownExportInput) {
  const emptyValue = getMarkdownEmptyValue(language);

  return [
    `# ${formatMarkdownInline(deckTitle, emptyValue)}`,
    "",
    `- ${t("processing.file")}: ${formatMarkdownInline(deckFileName, emptyValue)}`,
    `- ${t("common.totalSlides")}: ${pageCount}`,
    `- ${t("workspace.contextQuality")}: ${t(contextQualityLabelKeys[contextQuality])}`,
    `- ${t("common.textSlides")}: ${contextStats.textSlideCount}/${pageCount}`,
    `- ${t("common.noteSlides")}: ${contextStats.speakerNotesSlideCount}/${pageCount}`,
    `- ${t("ai.context")}: ${t("ai.wholeDeck")}`,
    "",
    ...deckSlides.flatMap((slide) => {
      const slideTitle = getGeneratedSlideTitle(slide.title, slide.pageNumber, language);
      const slideSummary = getGeneratedSlideSummary(slide.summary, slide.pageNumber, language);
      const slideVisualSummary = getGeneratedVisualSummary(slide.visualSummary, language);
      const metricLines =
        slide.metrics.length > 0
          ? slide.metrics.map(
              (metric) =>
                `  - ${formatMarkdownInline(getGeneratedMetricLabel(metric.label, language), emptyValue)}: ${formatMarkdownInline(metric.value, emptyValue)}`,
            )
          : [`  - ${emptyValue}`];
      const aiInsightLines = getPersistedAISlideExportLines({
        deckSlides,
        language,
        slide,
        t,
      });

      return [
        `## ${formatSlideLabel(slide.pageNumber, language)} · ${formatMarkdownInline(slideTitle, emptyValue)}`,
        "",
        `- ${t("common.section")}: ${t(getSlideSectionKey(slide.section))}`,
        `- ${t("common.summary")}: ${formatMarkdownInline(slideSummary, emptyValue)}`,
        "",
        `### ${t("common.keyPoints")}`,
        ...formatMarkdownListItems(slide.bullets, emptyValue),
        "",
        `### ${t("common.metrics")}`,
        ...metricLines,
        "",
        `### ${t("common.visualSummary")}`,
        formatMarkdownInline(slideVisualSummary, emptyValue),
        "",
        `### ${t("common.extractedText")}`,
        ...formatMarkdownCodeBlock(
          clipExportText(slide.extractedText, maxExportExtractedTextLength, language),
          emptyValue,
        ),
        "",
        `### ${t("common.speakerNotes")}`,
        ...formatMarkdownQuote(
          clipExportText(slide.speakerNotes, maxExportSpeakerNotesLength, language),
          emptyValue,
        ),
        "",
        ...aiInsightLines,
      ];
    }),
  ].join("\n");
}
