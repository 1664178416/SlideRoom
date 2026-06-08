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
        ...formatMarkdownCodeBlock(slide.extractedText, emptyValue),
        "",
        `### ${t("common.speakerNotes")}`,
        ...formatMarkdownQuote(slide.speakerNotes, emptyValue),
        "",
        ...aiInsightLines,
      ];
    }),
  ].join("\n");
}
