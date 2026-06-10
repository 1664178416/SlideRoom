import { getPersistedAISlideExportLines } from "@/lib/ai-inspector";
import { getDeckFileStem } from "@/lib/deck-display";
import {
  formatMarkdownCodeBlock,
  formatMarkdownInline,
  formatMarkdownQuote,
  getMarkdownEmptyValue,
} from "@/lib/markdown-export";
import { deckMeta, type Slide } from "@/lib/mock-data";
import type { SlideContextStats } from "@/lib/upload-contract";
import {
  formatSlideLabel,
  getGeneratedSlideTitle,
  type Language,
  type TranslationKey,
} from "@/lib/preferences";

type BuildDeckMarkdownExportInput = {
  contextStats: SlideContextStats;
  deckId: string;
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

function formatExportTimestamp(language: Language) {
  const locale = language === "zh" ? "zh-CN" : "en";

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

export function getDeckMarkdownFileName(deckFileName: string, language: Language) {
  return `${getDeckFileStem(deckFileName, deckMeta.id)}-${language}-notes.md`;
}

export function buildDeckMarkdownExport({
  contextStats,
  deckId,
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
    `- ${t("export.generatedAt")}: ${formatMarkdownInline(formatExportTimestamp(language), emptyValue)}`,
    `- ${t("common.totalSlides")}: ${pageCount}`,
    `- ${t("common.textSlides")}: ${contextStats.textSlideCount}/${pageCount}`,
    `- ${t("common.noteSlides")}: ${contextStats.speakerNotesSlideCount}/${pageCount}`,
    `- ${t("settings.deferredAI")}: ${formatMarkdownInline(t("export.aiOnDemand"), emptyValue)}`,
    "",
    ...deckSlides.flatMap((slide) => {
      const slideTitle = getGeneratedSlideTitle(slide.title, slide.pageNumber, language);
      const aiInsightLines = getPersistedAISlideExportLines({
        deckId,
        language,
        slide,
        t,
      });

      return [
        `## ${formatSlideLabel(slide.pageNumber, language)} · ${formatMarkdownInline(slideTitle, emptyValue)}`,
        "",
        `### ${t("common.speakerNotes")}`,
        ...formatMarkdownQuote(
          clipExportText(slide.speakerNotes, maxExportSpeakerNotesLength, language),
          emptyValue,
        ),
        "",
        `### ${t("common.extractedText")}`,
        ...formatMarkdownCodeBlock(
          clipExportText(slide.extractedText, maxExportExtractedTextLength, language),
          emptyValue,
        ),
        "",
        ...aiInsightLines,
      ];
    }),
  ].join("\n");
}
