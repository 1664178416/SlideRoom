import { deckMeta, slides, type Slide } from "@/lib/mock-data";
import type { UploadedDeckSession, UploadedSlideContext } from "@/lib/upload-contract";

const importedAccents = [
  "168 42% 30%",
  "205 42% 38%",
  "18 58% 54%",
  "39 74% 45%",
  "151 34% 34%",
  "7 60% 48%",
];

const maxImportedBullets = 3;
const maxImportedMetrics = 2;
const numericSignalPattern = /(?:[$¥€]\s*)?\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|pt|pts|x|k|m|b|K|M|B)?/g;
const sentenceSeparatorPattern = /[.!?;\u3002\uff01\uff1f\uff1b\n]+/;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clipText(value: string, maxLength: number) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function uniqueItems(items: string[]) {
  const seenItems = new Set<string>();

  return items.filter((item) => {
    const normalizedItem = item.toLowerCase();
    if (seenItems.has(normalizedItem)) return false;

    seenItems.add(normalizedItem);
    return true;
  });
}

function getExtractedLines(context?: UploadedSlideContext) {
  return (context?.extractedText ?? "")
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 0);
}

function getSlideContextByPageNumber(session: UploadedDeckSession) {
  return new Map(session.slides.map((slide) => [slide.pageNumber, slide]));
}

function getImportedSlideTitle(pageNumber: number, context?: UploadedSlideContext) {
  const lines = getExtractedLines(context);
  const text = normalizeText(lines[0] ?? context?.extractedText ?? "");
  const candidate = text
    .split(sentenceSeparatorPattern)
    .map((item) => item.trim())
    .find((item) => item.length >= 2 && !/^slide\s*\d+$/i.test(item));

  return candidate ? clipText(candidate, 34) : `Slide ${String(pageNumber).padStart(2, "0")}`;
}

function getImportedSlideSummary(pageNumber: number, context?: UploadedSlideContext) {
  const lines = getExtractedLines(context);
  const title = getImportedSlideTitle(pageNumber, context).toLowerCase();
  const summaryLines = lines.filter((line) => line.toLowerCase() !== title).slice(0, 3);
  const extractedText = normalizeText(summaryLines.join(" ") || context?.extractedText || "");

  if (extractedText) {
    return clipText(extractedText, 180);
  }

  return `Slide ${String(pageNumber).padStart(2, "0")} is ready for page-specific questions. Text extraction did not return content for this page yet.`;
}

function getImportedSlideBullets(context?: UploadedSlideContext) {
  const lines = getExtractedLines(context);
  const candidates = lines.length > 1 ? lines.slice(1) : lines;
  const text = normalizeText(candidates.join("\n"));
  if (!text) return [];

  return uniqueItems(
    text
      .split(sentenceSeparatorPattern)
      .map((item) => clipText(item, 72))
      .filter((item) => item.length >= 4),
  ).slice(0, maxImportedBullets);
}

function getNumericValue(signal: string) {
  const normalizedSignal = signal.replace(/[$¥€,%\s]/g, "").replace(/,/g, "");
  const value = Number.parseFloat(normalizedSignal);

  return Number.isFinite(value) ? value : null;
}

function getMetricLabelFromLine(line: string, signal: string) {
  const signalIndex = line.indexOf(signal);
  const labelSource = signalIndex >= 0 ? line.slice(0, signalIndex) : line.replace(signal, "");
  const words = labelSource
    .replace(/[()[\]{}:：,，/|]+/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  return clipText(words.slice(-3).join(" ") || "Signal", 18);
}

function getImportedSlideMetrics(context?: UploadedSlideContext): Slide["metrics"] {
  const extractedText = context?.extractedText ?? "";
  const lines = getExtractedLines(context);
  const signals = uniqueItems([...extractedText.matchAll(numericSignalPattern)].map((match) => normalizeText(match[0])))
    .filter((signal) => signal.length > 0)
    .slice(0, maxImportedMetrics);

  if (signals.length > 0) {
    return signals.map((signal, index) => {
      const sourceLine = lines.find((line) => line.includes(signal)) ?? "";

      return {
        label: getMetricLabelFromLine(sourceLine, signal),
        value: signal,
        tone: index === 0 ? "teal" : "blue",
      };
    });
  }

  const textLength = normalizeText(extractedText).length;
  if (textLength > 0) {
    return [{ label: "Text", value: `${Math.min(999, textLength)}`, tone: "teal" }];
  }

  return [];
}

function getImportedSlideChart(pageNumber: number, context?: UploadedSlideContext) {
  const numericSignals = [...(context?.extractedText ?? "").matchAll(numericSignalPattern)]
    .map((match) => getNumericValue(match[0]))
    .filter((value): value is number => value !== null)
    .slice(0, 5);

  if (numericSignals.length > 0) {
    const maxSignal = Math.max(...numericSignals, 1);
    const values = numericSignals.map((signal) => Math.min(92, Math.max(28, Math.round((signal / maxSignal) * 84))));

    return Array.from({ length: 5 }, (_, index) => values[index] ?? values[values.length - 1] ?? 42);
  }

  const lineSignals = getExtractedLines(context)
    .map((line) => Math.min(92, Math.max(28, Math.round((line.length / 96) * 84))))
    .slice(0, 5);

  if (lineSignals.length > 0) {
    return Array.from({ length: 5 }, (_, index) => lineSignals[index] ?? Math.max(30, lineSignals[lineSignals.length - 1] - index * 4));
  }

  return [42, 58, 52, 68, 74].map((value, index) => Math.min(96, value + ((pageNumber + index) % 4) * 5));
}

function getImportedVisualSummary(context?: UploadedSlideContext) {
  const textLineCount = getExtractedLines(context).length;
  const noteLength = normalizeText(context?.speakerNotes ?? "").length;

  if (textLineCount > 0 || noteLength > 0) {
    return `Imported slide with extracted text ready for page-level reading and questions.`;
  }

  return `Imported slide placeholder. Full image rendering can be connected after the local renderer is enabled.`;
}

function getImportedSlide(pageNumber: number, session: UploadedDeckSession, context?: UploadedSlideContext): Slide {
  const title = getImportedSlideTitle(pageNumber, context);
  const extractedText = context?.extractedText ?? "";
  const speakerNotes = context?.speakerNotes ?? "";

  return {
    id: `${session.deckId}-slide-${String(pageNumber).padStart(2, "0")}`,
    pageNumber,
    section: "imported",
    title,
    kicker: session.inspectionStatus === "parsed" ? "Imported PPTX page" : "Imported PPT page",
    summary: getImportedSlideSummary(pageNumber, context),
    bullets: getImportedSlideBullets(context),
    metrics: getImportedSlideMetrics(context),
    chart: getImportedSlideChart(pageNumber, context),
    accent: importedAccents[(pageNumber - 1) % importedAccents.length],
    visualSummary: getImportedVisualSummary(context),
    extractedText,
    speakerNotes,
  };
}

export function getDeckSlides(session?: UploadedDeckSession | null): Slide[] {
  if (!session || session.deckId === deckMeta.id) return slides;

  const contextsByPageNumber = getSlideContextByPageNumber(session);
  const pageCount = Math.max(1, session.pageCount || session.slides.length || deckMeta.pageCount);

  return Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    return getImportedSlide(pageNumber, session, contextsByPageNumber.get(pageNumber));
  });
}
