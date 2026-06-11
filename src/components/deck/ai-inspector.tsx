import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  FileText,
  History,
  Loader2,
  Map,
  MessageSquareText,
  PenLine,
  Send,
  Sparkles,
  StickyNote,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { Slide } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatSlideLabel, getSlideSectionKey, TranslationKey, usePreferences } from "@/lib/preferences";
import { generateAIResponse } from "@/lib/ai-provider-client";
import { readAIProviderConfig } from "@/lib/ai-provider-config";
import {
  buildAssistantResult,
  buildPresetPrompt,
  buildQuestionPrompt,
  compactPresetModelContent,
  emptyMessages,
  getAssistantPromptForLanguage,
  getContextTitle,
  getMessageCounterSeed,
  getResultMode,
  resolvePresetOutputTokens,
  quickActionDefinitions,
  readAIInspectorState,
  resolveQuestionOutputTokens,
  writeAIInspectorState,
  type AssistantMessage,
  type AssistantResult,
  type ContextMode,
  type Message,
  type QuickActionId,
} from "@/lib/ai-inspector";

const quickActionIcons: Record<QuickActionId, typeof Wand2> = {
  explain: Wand2,
  summary: MessageSquareText,
  script: PenLine,
  review: AlertTriangle,
};

const quickActions = quickActionDefinitions.map((action) => ({
  ...action,
  icon: quickActionIcons[action.id],
}));

type ConversationHistoryItem = {
  action: QuickActionId;
  assistantId?: string;
  contextMode: ContextMode;
  label: string;
  promptKey?: TranslationKey;
  status: "error" | "pending" | "success";
  userId: string;
};

type GeneratingRequest = {
  action: QuickActionId;
  id: string;
  slideId: string;
};

function getReadableContextSlides(slide: Slide, contextMode: ContextMode, deckSlides: Slide[]) {
  const activeIndex = Math.max(0, deckSlides.findIndex((item) => item.id === slide.id));
  const contextSlides =
    contextMode === "current"
      ? [slide]
      : contextMode === "nearby"
        ? deckSlides.slice(Math.max(0, activeIndex - 1), Math.min(deckSlides.length, activeIndex + 2))
        : deckSlides;

  return contextSlides.filter((contextSlide) => {
    return contextSlide.extractedText.trim().length > 0 || contextSlide.speakerNotes.trim().length > 0;
  });
}

function ResultNotesPanel({
  compact,
  result,
  t,
}: {
  compact?: boolean;
  result: AssistantResult;
  t: (key: TranslationKey) => string;
}) {
  const noteLines = [
    ...result.sections.flatMap((section) => section.content.split("\n")),
  ].filter((line) => line.trim().length > 0);
  const displayedNoteLines = result.error ? getCompactErrorLines(noteLines) : noteLines;

  if (compact && !result.error) {
    const compactLines = noteLines.slice(0, 1);

    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center px-3 py-4">
        <CompactResultCard lines={compactLines} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border/[0.54] bg-background/[0.06] p-2">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/[0.62] bg-white/[0.52] shadow-[0_1px_0_rgba(255,255,255,0.56)_inset] dark:bg-secondary/[0.26] dark:shadow-none">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/[0.48] bg-background/[0.20] px-3 py-1.5 dark:bg-background/[0.08]">
          <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border",
                result.error
                  ? "border-destructive/20 bg-destructive/10 text-destructive"
                  : "border-primary/[0.20] bg-primary/[0.08] text-primary",
              )}
            >
              {result.error ? <AlertTriangle className="h-3.5 w-3.5" /> : <StickyNote className="h-3.5 w-3.5" />}
            </span>
            <span className="truncate">{result.error ? t("common.error") : t("ai.notes")}</span>
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2 text-[13px] leading-5 text-muted-foreground [scrollbar-gutter:stable]">
          <div className={cn("space-y-1", result.error && "text-destructive")}>
            {displayedNoteLines.map((line, index) => (
              <ResultContentLine key={`${result.title}-${index}`} line={line} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getLabeledLineParts(line: string) {
  const cleanLine = line.trim();
  const separatorIndex = cleanLine.search(/[:：]/);
  const hasLabel = separatorIndex > 0 && separatorIndex <= 16;

  if (!hasLabel) {
    return {
      body: cleanLine,
      label: "",
    };
  }

  return {
    body: cleanLine.slice(separatorIndex + 1).trim(),
    label: cleanLine.slice(0, separatorIndex).trim(),
  };
}

function getCompactErrorLines(lines: string[]) {
  const primaryLine = lines
    .map((line) => line.trim())
    .find((line) => line && !/^(Responses API|Chat Completions)\b/i.test(line));

  if (!primaryLine) return lines.slice(0, 1);

  return [primaryLine.length > 180 ? `${primaryLine.slice(0, 177).trimEnd()}...` : primaryLine];
}

function formatAIRequestError(error: unknown, requestFailedLabel: string) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const cleanMessage = rawMessage.replace(/\s+/g, " ").trim();
  const normalizedLabel = requestFailedLabel.replace(/[：:.。\s]+$/g, "").trim();
  const escapedLabel = normalizedLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const repeatedPrefixPattern = new RegExp(`^${escapedLabel}\\s*[：:.。]?\\s*`, "i");

  if (!cleanMessage) return requestFailedLabel;
  if (normalizedLabel && repeatedPrefixPattern.test(cleanMessage)) {
    return cleanMessage;
  }

  return `${requestFailedLabel}: ${cleanMessage}`;
}

function CompactResultCard({ lines }: { lines: string[] }) {
  const compactLines = lines
    .map((line) => getLabeledLineParts(line))
    .filter((line) => line.body.length > 0);

  if (compactLines.length === 0) return null;
  const primaryLine = compactLines[0];

  return (
    <div className="relative mx-auto flex w-full max-w-[310px] flex-col items-center overflow-hidden rounded-md border border-primary/[0.18] bg-white/[0.72] px-4 py-5 text-center shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_20px_42px_rgba(15,23,42,0.07)] dark:bg-secondary/[0.34] dark:shadow-none">
      <span className="pointer-events-none absolute left-1/2 top-0 h-0.5 w-16 -translate-x-1/2 rounded-b-full bg-primary/[0.55]" aria-hidden="true" />
      {primaryLine.label && (
        <span className="mb-3 rounded-[5px] border border-primary/[0.18] bg-primary/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
          {primaryLine.label}
        </span>
      )}
      <p className="max-w-full break-words text-[22px] font-semibold leading-7 text-foreground/94 sm:text-[24px] sm:leading-8">
        {primaryLine.body}
      </p>
    </div>
  );
}

function splitNumberedItems(value: string) {
  const matches = [...value.matchAll(/(^|[\s:：?？!！;；])(\d+)\.\s+/g)];
  if (matches.length < 2) return null;

  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const nextMatch = matches[index + 1];
    const nextPrefix = nextMatch?.[1] ?? "";
    const end =
      nextMatch && nextMatch.index !== undefined
        ? nextMatch.index + (nextPrefix && !/\s/.test(nextPrefix) ? nextPrefix.length : 0)
        : value.length;

    return {
      number: match[2],
      text: value.slice(start, end).trim(),
    };
  });
}

function ResultContentLine({ line }: { line: string }) {
  const cleanLine = line.trim();
  if (!cleanLine) return null;

  const { body, label } = getLabeledLineParts(cleanLine);
  const hasLabel = Boolean(label);
  const numberedItems = splitNumberedItems(body);

  if (numberedItems) {
    return (
      <div className="rounded-[5px] px-1.5 py-1.5 hover:bg-background/[0.34] dark:hover:bg-background/[0.10]">
        {label && (
          <div className="mb-1 flex w-fit items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
            {label}
          </div>
        )}
        <div className="space-y-1">
          {numberedItems.map((item) => (
            <div
              className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 rounded-[5px] px-1.5 py-1"
              key={`${item.number}-${item.text}`}
            >
              <span
                aria-hidden="true"
                className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-primary/10 text-[10px] font-semibold tabular-nums text-primary"
              >
                {item.number}
              </span>
              <p className="text-foreground/86">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (hasLabel) {
    return (
      <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2 rounded-[5px] px-1.5 py-1.5 transition-colors hover:bg-background/[0.34] dark:hover:bg-background/[0.10]">
        <div className="min-w-0 truncate text-[11px] font-semibold text-muted-foreground">{label}</div>
        <p className="min-w-0 break-words text-foreground/88">{body}</p>
      </div>
    );
  }

  return (
    <p className="rounded-[5px] px-1.5 py-1 text-foreground/88">
      {cleanLine}
    </p>
  );
}

function AssistantResultPanel({
  action,
  compact,
  isGenerating,
  onRun,
  runDisabled,
  result,
  t,
}: {
  action: (typeof quickActions)[number];
  compact?: boolean;
  isGenerating: boolean;
  onRun: () => void;
  runDisabled: boolean;
  result: AssistantResult;
  t: (key: TranslationKey) => string;
}) {
  const ActionIcon = action.icon;
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "failed">("idle");
  const [metaOpen, setMetaOpen] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const metaDisclosureRef = useRef<HTMLDivElement | null>(null);
  const visibleSourceSlideLabels = result.sourceSlideLabels.slice(0, 2);
  const hiddenSourceSlideCount = Math.max(0, result.sourceSlideLabels.length - visibleSourceSlideLabels.length);
  const showMeta = !compact || Boolean(result.error);
  const effectiveMetaOpen = showMeta && metaOpen;
  const copyStatusLabel =
    copyFeedback === "copied"
      ? t("common.copied")
      : copyFeedback === "failed"
        ? t("common.copyFailed")
        : t("ai.copyResult");

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!effectiveMetaOpen) return;

    function handleDocumentMouseDown(event: MouseEvent) {
      const eventPath = event.composedPath();

      if (metaDisclosureRef.current && eventPath.includes(metaDisclosureRef.current)) return;
      setMetaOpen(false);
    }

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setMetaOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [effectiveMetaOpen]);

  async function copyResult() {
    const copyText = compact && !result.error
      ? [
          result.title,
          "",
          ...result.sections.flatMap((section) => section.content.split("\n")).filter(Boolean),
        ].join("\n")
      : [
          result.title,
          "",
          result.summary,
          "",
          `${t("ai.context")}: ${result.contextNote}`,
          `${t("ai.sources")}: ${result.sourceSlideText}`,
          "",
          ...result.sections.flatMap((section) => [
            `## ${t(section.titleKey)}`,
            section.content,
            "",
          ]),
        ].join("\n");

    let didCopy = false;

    try {
      if (!window.navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }

      await window.navigator.clipboard.writeText(copyText);
      didCopy = true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = copyText;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      try {
        document.body.appendChild(textarea);
        textarea.select();
        didCopy = document.execCommand("copy");
      } catch {
        didCopy = false;
      } finally {
        textarea.remove();
      }
    }

    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current);
    }

    setCopyFeedback(didCopy ? "copied" : "failed");
    copiedTimerRef.current = window.setTimeout(() => {
      setCopyFeedback("idle");
      copiedTimerRef.current = null;
    }, 1400);
  }

  if (compact && !result.error) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/[0.72] bg-white/[0.46] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.60)_inset,0_12px_30px_rgba(15,23,42,0.045)] dark:bg-secondary/[0.30] dark:shadow-none">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/[0.20] bg-primary/[0.08] text-primary">
              <ActionIcon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{t(action.labelKey)}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{result.sourceSlideText}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              aria-label={`${t("ai.runPreset")} · ${t(action.labelKey)}`}
              className="flex h-7 w-7 items-center justify-center rounded-[5px] text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={runDisabled}
              onClick={onRun}
              title={`${t("ai.runPreset")} · ${t(action.labelKey)}`}
              type="button"
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            </button>
            <button
              aria-label={copyStatusLabel}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-[5px] text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                copyFeedback === "failed" && "text-destructive hover:text-destructive",
              )}
              onClick={copyResult}
              title={copyStatusLabel}
              type="button"
            >
              {copyFeedback === "copied" ? (
                <Check className="h-3.5 w-3.5" />
              ) : copyFeedback === "failed" ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <ResultNotesPanel compact result={result} t={t} />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-white/[0.66] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.70)_inset,0_14px_34px_rgba(15,23,42,0.055)] dark:bg-secondary/[0.58] dark:shadow-none">
      <div className="flex items-center justify-between gap-2 border-b border-border/[0.68] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/[0.24] bg-primary/[0.12] text-primary">
            {result.error ? <AlertTriangle className="h-3.5 w-3.5" /> : <ActionIcon className="h-3.5 w-3.5" />}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
              {result.error ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
              )}
              {result.error ? t("common.error") : t("ai.generated")}
            </span>
            <span className="block truncate text-sm font-semibold">{result.title}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label={`${t("ai.runPreset")} · ${t(action.labelKey)}`}
            className="flex h-7 w-7 items-center justify-center rounded-[5px] text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={runDisabled}
            onClick={onRun}
            title={`${t("ai.runPreset")} · ${t(action.labelKey)}`}
            type="button"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          </button>
          <button
            aria-label={copyStatusLabel}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-[5px] text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              copyFeedback === "failed" && "text-destructive hover:text-destructive",
            )}
            onClick={copyResult}
            title={copyStatusLabel}
            type="button"
          >
            {copyFeedback === "copied" ? (
              <Check className="h-3.5 w-3.5" />
            ) : copyFeedback === "failed" ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <span className="rounded-[5px] border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {result.error ? t("common.error") : t(action.shortLabelKey)}
          </span>
        </div>
      </div>
      {showMeta && (
        <div
          className="relative shrink-0 border-b border-border/[0.58] bg-background/30 px-2.5 py-1.5 dark:bg-background/[0.12]"
          ref={metaDisclosureRef}
        >
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {visibleSourceSlideLabels.map((sourceSlideLabel) => (
              <span
                className="shrink-0 rounded-[5px] border border-border bg-white/[0.36] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground dark:bg-background/[0.14]"
                key={sourceSlideLabel}
              >
                {sourceSlideLabel}
              </span>
            ))}
            {hiddenSourceSlideCount > 0 && (
              <span className="shrink-0 rounded-[5px] border border-border bg-white/[0.24] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground dark:bg-background/[0.10]">
                +{hiddenSourceSlideCount}
              </span>
            )}
          </div>
          <button
            aria-expanded={effectiveMetaOpen}
            aria-controls="ai-result-context-detail"
            aria-label={t("ai.contextPrompt")}
            className="flex h-6 min-w-0 shrink-0 items-center gap-1.5 rounded-[5px] border border-border bg-white/[0.28] px-1.5 text-left text-[10px] font-medium text-muted-foreground transition hover:bg-white/[0.48] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-background/[0.10] dark:hover:bg-secondary/[0.26]"
            data-ai-meta-toggle="true"
            onClick={() => setMetaOpen((current) => !current)}
            title={t("ai.contextPrompt")}
            type="button"
          >
            <Map className="h-3 w-3 shrink-0 text-primary/[0.78]" />
            <span className="hidden truncate xl:inline">{t("ai.contextPrompt")}</span>
            <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", effectiveMetaOpen && "rotate-180")} />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {effectiveMetaOpen && (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="mt-1.5 overflow-hidden rounded-md border border-border/[0.7] bg-background/82 text-[11px] leading-5 text-muted-foreground shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-secondary/72 dark:shadow-none"
              exit={{ height: 0, opacity: 0 }}
              id="ai-result-context-detail"
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-start gap-2 px-2.5 py-1.5">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/[0.72]" />
                <p className="line-clamp-2">{result.contextNote}</p>
              </div>
              <div className="border-t border-border/[0.56] bg-white/[0.24] px-2.5 py-1.5 dark:bg-background/[0.10]">
                <span className="mr-1 font-semibold text-foreground">{t("ai.sources")}:</span>
                <span>{result.sourceSlideText}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      )}
      <ResultNotesPanel compact={compact} key={`${action.id}-${result.title}`} result={result} t={t} />
    </div>
  );
}

function AssistantResultEmpty({
  action,
  contextTitle,
  isGenerating,
  notice,
  onRun,
  runDisabled,
  slideLabel,
  t,
}: {
  action: (typeof quickActions)[number];
  contextTitle: string;
  isGenerating: boolean;
  notice?: string;
  onRun: () => void;
  runDisabled: boolean;
  slideLabel: string;
  t: (key: TranslationKey) => string;
}) {
  const ActionIcon = action.icon;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-md border border-border/[0.72] bg-white/[0.42] p-3 shadow-[0_1px_0_rgba(255,255,255,0.52)_inset] dark:bg-secondary/[0.26] dark:shadow-none">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/[0.22] bg-primary/10 text-primary">
            <ActionIcon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{t(action.labelKey)}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{slideLabel}</span>
          </span>
        </div>
        <span className="rounded-[5px] border border-border bg-background/[0.52] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {t("ai.notGenerated")}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center px-1 py-6">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background/[0.58] text-primary dark:bg-background/20">
          <Sparkles className="h-4 w-4" />
        </div>
        <p className="mt-3 text-center text-sm font-semibold text-foreground">{t("ai.emptyResult")}</p>
        <p className="mx-auto mt-1 max-w-[260px] text-center text-xs leading-5 text-muted-foreground">
          {t(action.hintKey)}
        </p>
        {notice && (
          <p className="mx-auto mt-2 max-w-[280px] rounded-md border border-border/[0.72] bg-background/[0.54] px-2.5 py-1.5 text-center text-xs leading-5 text-muted-foreground dark:bg-background/[0.14]">
            {notice}
          </p>
        )}
        <Button
          className="mx-auto mt-4 h-8 px-3"
          data-ai-empty-run="true"
          disabled={runDisabled}
          onClick={onRun}
          size="sm"
          type="button"
          variant="secondary"
        >
          {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {isGenerating ? t("ai.generating") : t("ai.runPreset")}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-background/[0.46] px-2.5 py-2 text-xs text-muted-foreground dark:bg-background/[0.14]">
        <span className="min-w-0 truncate text-[11px] font-medium">{contextTitle}</span>
        <span className="shrink-0 rounded-[5px] border border-border bg-white/[0.28] px-1.5 py-0.5 text-[10px] font-semibold dark:bg-background/[0.10]">
          {t("ai.onDemand")}
        </span>
      </div>
    </div>
  );
}

function QuickActionStack({
  activeAction,
  generatedActionIds,
  selectedActionId,
  onSelect,
  t,
}: {
  activeAction?: QuickActionId;
  generatedActionIds: Set<QuickActionId>;
  selectedActionId: QuickActionId;
  onSelect: (action: QuickActionId) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div aria-label={t("ai.preset")} className="grid grid-cols-4 gap-1" role="tablist">
      {quickActions.map((action) => {
        const Icon = action.icon;
        const selected = selectedActionId === action.id;
        const recentlyRun = activeAction === action.id;
        const generated = generatedActionIds.has(action.id);
        const stateLabel = generated ? t("ai.generatedStatus") : t("ai.notGenerated");

        return (
          <motion.div
            className={cn(
              "relative min-w-0 overflow-hidden rounded-md border bg-white/[0.40] shadow-[0_1px_0_rgba(255,255,255,0.54)_inset] transition-colors dark:bg-secondary/25",
              selected
                ? "border-primary/[0.36] bg-primary/[0.08] dark:bg-primary/[0.10]"
                : "border-border/[0.70] hover:border-primary/[0.24] hover:bg-white/[0.58] dark:hover:bg-secondary/[0.40]",
            )}
            key={action.id}
            layout
            role="presentation"
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              aria-label={`${t(action.labelKey)} · ${stateLabel}`}
              aria-selected={selected}
              className="grid h-11 w-full min-w-0 grid-rows-[auto_auto] place-items-center gap-0.5 px-1.5 py-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-ai-preset-selected={selected ? "true" : "false"}
              data-ai-preset-tab={action.id}
              onClick={() => onSelect(action.id)}
              role="tab"
              title={t(action.labelKey)}
              type="button"
            >
              <span
                className={cn(
                  "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                  selected
                    ? "border-primary/[0.26] bg-primary text-primary-foreground"
                    : generated
                      ? "border-primary/[0.20] bg-primary/10 text-primary dark:bg-primary/[0.12]"
                      : "border-border bg-background/60 text-muted-foreground dark:bg-background/20",
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
              <span className="max-w-full truncate text-[10px] font-semibold leading-none text-foreground">
                {t(action.shortLabelKey)}
              </span>
              <span
                className={cn(
                  "absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full transition-colors",
                  selected ? "bg-primary" : generated ? "bg-primary/[0.56]" : "bg-border",
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "absolute inset-x-1 bottom-1 h-0.5 rounded-full transition-colors",
                  selected
                    ? "bg-primary"
                    : generated
                      ? "bg-primary/[0.34]"
                      : "bg-border/[0.54]",
                )}
                aria-hidden="true"
              />
              {recentlyRun ? (
                <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              ) : generated ? (
                <Check className="absolute left-1 top-1 h-3.5 w-3.5 text-primary/[0.78]" aria-hidden="true" />
              ) : null}
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}

function ConversationHistoryPanel({
  items,
  onClose,
  onSelect,
  selectedAssistantMessageId,
  t,
}: {
  items: ConversationHistoryItem[];
  onClose: () => void;
  onSelect: (item: ConversationHistoryItem) => void;
  selectedAssistantMessageId: string | null;
  t: (key: TranslationKey) => string;
}) {
  const recentItems = [...items].reverse();

  return (
    <motion.div
      animate={{ height: "auto", opacity: 1 }}
      className="mt-2 overflow-hidden rounded-md border border-border/[0.72] bg-white/[0.42] dark:bg-background/[0.14]"
      data-ai-history-panel="true"
      exit={{ height: 0, opacity: 0 }}
      initial={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground">
          <History className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{t("ai.history")}</span>
        </div>
        <button
          aria-label={t("ai.closeHistory")}
          className="flex h-6 w-6 items-center justify-center rounded-[5px] text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClose}
          title={t("ai.closeHistory")}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {recentItems.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground">{t("ai.noHistory")}</div>
      ) : (
        <div className="max-h-44 space-y-1 overflow-y-auto p-1.5">
          {recentItems.map((item, index) => {
            const action = quickActions.find((quickAction) => quickAction.id === item.action) ?? quickActions[0];
            const Icon = action.icon;
            const turnNumber = items.length - index;
            const active = Boolean(item.assistantId && item.assistantId === selectedAssistantMessageId);
            const label = item.promptKey ? t(item.promptKey) : item.label;
            const contextLabel = getContextTitle(item.contextMode, t);
            const statusLabel =
              item.status === "error"
                ? t("common.error")
                : index === 0
                  ? t("ai.latest")
                  : item.status === "success"
                    ? t("ai.generatedStatus")
                    : t("ai.pendingStatus");

            return (
              <button
                aria-label={`${t("ai.viewTurn")} ${turnNumber}`}
                className={cn(
                  "grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-2 rounded-[5px] border px-2 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary/[0.34] bg-primary/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-white/[0.46] hover:text-foreground dark:hover:bg-secondary/[0.36]",
                )}
                data-ai-history-item={item.assistantId ?? item.userId}
                key={item.userId}
                onClick={() => onSelect(item)}
                title={label}
                type="button"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-[5px] border",
                    active
                      ? "border-primary/[0.24] bg-primary text-primary-foreground"
                      : "border-border bg-background/[0.54] text-primary dark:bg-background/[0.18]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className={cn("line-clamp-2 text-xs font-medium leading-4", active && "text-foreground")}>
                    {label}
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="truncate">{t(action.labelKey)}</span>
                    <span className="text-border">/</span>
                    <span className="truncate">{contextLabel}</span>
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-[4px] border px-1.5 py-0.5 text-[9px] font-semibold",
                    item.status === "error"
                      ? "border-destructive/20 bg-destructive/10 text-destructive"
                      : index === 0
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : "border-border bg-background/[0.46] text-muted-foreground dark:bg-background/[0.14]",
                  )}
                >
                  {statusLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

type AIInspectorProps = {
  deckId: string;
  deckSlides: Slide[];
  slide: Slide;
};

export function AIInspector({ deckId, deckSlides, slide }: AIInspectorProps) {
  const { language, t } = usePreferences();
  const slideLabel = formatSlideLabel(slide.pageNumber, language);
  const sectionLabel = t(getSlideSectionKey(slide.section));
  const [contextMode, setContextMode] = useState<ContextMode>("current");
  const [draftsBySlideId, setDraftsBySlideId] = useState<Record<string, string>>({});
  const [historyOpenSlideId, setHistoryOpenSlideId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<QuickActionId>("explain");
  const [selectedAssistantMessageId, setSelectedAssistantMessageId] = useState<string | null>(null);
  const messageCounter = useRef(0);
  const [inspectorStateRestored, setInspectorStateRestored] = useState(false);
  const [messagesBySlideId, setMessagesBySlideId] = useState<Record<string, Message[]>>({});
  const [clearArmedSlideId, setClearArmedSlideId] = useState<string | null>(null);
  const [generatingRequest, setGeneratingRequest] = useState<GeneratingRequest | null>(null);
  const [providerNoticeBySlideId, setProviderNoticeBySlideId] = useState<Record<string, string>>({});
  const generationLockedRef = useRef(false);
  const visibleSlideIdRef = useRef(slide.id);

  const prompt = draftsBySlideId[slide.id] ?? "";
  const messages = messagesBySlideId[slide.id] ?? emptyMessages;
  const providerNotice = providerNoticeBySlideId[slide.id] ?? "";
  const clearArmed = clearArmedSlideId === slide.id;
  const historyOpen = historyOpenSlideId === slide.id;
  const isGenerating = Boolean(generatingRequest);
  const isGeneratingCurrentSlide = generatingRequest?.slideId === slide.id;
  const isGeneratingSelectedAction = isGeneratingCurrentSlide && generatingRequest?.action === selectedActionId;
  const readableContextSlides = useMemo(
    () => getReadableContextSlides(slide, contextMode, deckSlides),
    [contextMode, deckSlides, slide],
  );
  const hasReadableContext = readableContextSlides.length > 0;
  const hasCurrentSlideReadableContext = slide.extractedText.trim().length > 0 || slide.speakerNotes.trim().length > 0;
  const contextUnavailableNotice = hasReadableContext ? "" : t("ai.contextUnavailable");
  const presetUnavailableNotice = hasCurrentSlideReadableContext ? "" : t("ai.presetContextUnavailable");
  const effectiveProviderNotice = hasReadableContext ? providerNotice : contextUnavailableNotice;
  const effectivePresetNotice = presetUnavailableNotice || effectiveProviderNotice;
  const canSubmit = prompt.trim().length > 0 && !isGenerating && hasReadableContext;
  const canRunPreset = !isGenerating && hasCurrentSlideReadableContext;
  const turnCount = messages.filter((message) => message.role === "user").length;
  const conversationHistory = useMemo(() => {
    return messages.reduce<ConversationHistoryItem[]>((items, message, index) => {
      if (message.role !== "user") return items;

      const nextMessage = messages[index + 1];
      const assistantMessage = nextMessage?.role === "assistant" ? nextMessage : undefined;
      const action = assistantMessage
        ? assistantMessage.action ?? getResultMode(assistantMessage.prompt)
        : getResultMode(message.content);

      items.push({
        action,
        assistantId: assistantMessage?.id,
        contextMode: assistantMessage?.contextMode ?? contextMode,
        label: message.content,
        promptKey: message.promptKey,
        status: assistantMessage?.error ? "error" : assistantMessage?.content?.trim() ? "success" : "pending",
        userId: message.id,
      });

      return items;
    }, []);
  }, [contextMode, messages]);
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message): message is AssistantMessage => message.role === "assistant");
  const latestAssistantAction = latestAssistantMessage
    ? latestAssistantMessage.action ?? getResultMode(latestAssistantMessage.prompt)
    : undefined;
  const latestAssistantActionDefinition = latestAssistantAction
    ? quickActions.find((action) => action.id === latestAssistantAction)
    : undefined;
  const activeAction =
    latestAssistantMessage?.contextMode === contextMode &&
    latestAssistantMessage?.promptKey === latestAssistantActionDefinition?.promptKey
      ? latestAssistantAction
      : undefined;
  const selectedAction = quickActions.find((action) => action.id === selectedActionId) ?? quickActions[0];
  const generatedActionIds = useMemo(() => {
    return messages.reduce<Set<QuickActionId>>((actionIds, message) => {
      if (message.role === "assistant") {
        const action = message.action ?? getResultMode(message.prompt);
        const actionDefinition = quickActions.find((item) => item.id === action);
        if (
          message.contextMode === contextMode &&
          message.content?.trim() &&
          actionDefinition &&
          message.promptKey === actionDefinition.promptKey
        ) {
          actionIds.add(action);
        }
      }

      return actionIds;
    }, new Set<QuickActionId>());
  }, [contextMode, messages]);

  const contextTitle = useMemo(() => getContextTitle(contextMode, t), [contextMode, t]);

  const selectedAssistantMessageById = selectedAssistantMessageId
    ? messages.find(
        (message): message is AssistantMessage =>
          message.role === "assistant" &&
          message.id === selectedAssistantMessageId &&
          message.contextMode === contextMode &&
          (message.action ?? getResultMode(message.prompt)) === selectedAction.id,
      )
    : undefined;
  const latestSelectedActionMessage = [...messages]
    .reverse()
    .find(
      (message): message is AssistantMessage =>
        message.role === "assistant" &&
        message.contextMode === contextMode &&
        message.promptKey === selectedAction.promptKey &&
        (message.action ?? getResultMode(message.prompt)) === selectedAction.id,
    );
  const selectedAssistantMessage = selectedAssistantMessageById ?? latestSelectedActionMessage;
  const selectedResult = selectedAssistantMessage
    ? buildAssistantResult(
        slide,
        getAssistantPromptForLanguage({
          deckSlides,
          language,
          message: selectedAssistantMessage,
          slide,
        }),
        selectedAssistantMessage.contextMode,
        language,
        sectionLabel,
        selectedAssistantMessage.action,
        deckSlides,
        selectedAssistantMessage,
      )
    : null;
  const selectedConversationMessageId = selectedAssistantMessage?.id ?? null;

  useEffect(() => {
    visibleSlideIdRef.current = slide.id;
  }, [slide.id]);

  useEffect(() => {
    const restoreTimerId = window.setTimeout(() => {
      const restoredState = readAIInspectorState(deckId);

      if (restoredState.contextMode) setContextMode(restoredState.contextMode);
      if (restoredState.selectedActionId) setSelectedActionId(restoredState.selectedActionId);
      if (restoredState.draftsBySlideId) setDraftsBySlideId(restoredState.draftsBySlideId);
      if (restoredState.messagesBySlideId) {
        setMessagesBySlideId(restoredState.messagesBySlideId);
        messageCounter.current = getMessageCounterSeed(restoredState.messagesBySlideId);
      }

      setInspectorStateRestored(true);
    }, 0);

    return () => window.clearTimeout(restoreTimerId);
  }, [deckId]);

  useEffect(() => {
    if (!inspectorStateRestored) return;

    writeAIInspectorState({
      contextMode,
      draftsBySlideId,
      messagesBySlideId,
      selectedActionId,
    }, deckId);
  }, [contextMode, deckId, draftsBySlideId, inspectorStateRestored, messagesBySlideId, selectedActionId]);

  useEffect(() => {
    if (!clearArmed) return;

    const clearTimerId = window.setTimeout(() => setClearArmedSlideId(null), 2400);
    return () => window.clearTimeout(clearTimerId);
  }, [clearArmed]);

  async function submitPrompt(value: string, action?: QuickActionId, promptKey?: TranslationKey) {
    const clean = value.trim();
    if (!clean || isGenerating || generationLockedRef.current) return;

    const resolvedAction = action ?? getResultMode(clean);
    if (promptKey && !hasCurrentSlideReadableContext) {
      setSelectedActionId(resolvedAction);
      setSelectedAssistantMessageId(null);
      setHistoryOpenSlideId(null);
      setProviderNoticeBySlideId((current) => ({
        ...current,
        [slide.id]: t("ai.presetContextUnavailable"),
      }));
      return;
    }

    if (!hasReadableContext) {
      setSelectedActionId(resolvedAction);
      setSelectedAssistantMessageId(null);
      setHistoryOpenSlideId(null);
      setProviderNoticeBySlideId((current) => ({
        ...current,
        [slide.id]: t("ai.contextUnavailable"),
      }));
      return;
    }

    const config = readAIProviderConfig();
    if (!config.apiKey || !config.baseUrl || !config.model) {
      setSelectedActionId(action ?? getResultMode(clean));
      setSelectedAssistantMessageId(null);
      setHistoryOpenSlideId(null);
      setProviderNoticeBySlideId((current) => ({
        ...current,
        [slide.id]: t("ai.configureProviderFirst"),
      }));
      return;
    }

    generationLockedRef.current = true;

    const displayPrompt = promptKey ? t(promptKey) : clean;
    messageCounter.current += 1;
    const messageId = `${slide.id}-${messageCounter.current}`;
    const assistantMessageId = `assistant-${messageId}`;
    const userMessage: Message = {
      id: `user-${messageId}`,
      role: "user",
      content: displayPrompt,
      promptKey,
    };
    const nextDraftsBySlideId = {
      ...draftsBySlideId,
      [slide.id]: "",
    };

    setSelectedActionId(resolvedAction);
    setSelectedAssistantMessageId(null);
    setHistoryOpenSlideId(null);
    setClearArmedSlideId(null);
    setProviderNoticeBySlideId((current) => {
      if (!current[slide.id]) return current;
      const next = { ...current };
      delete next[slide.id];
      return next;
    });
    setGeneratingRequest({
      action: resolvedAction,
      id: assistantMessageId,
      slideId: slide.id,
    });
    setMessagesBySlideId((current) => {
      const slideMessages = current[slide.id] ?? [];
      const nextMessagesBySlideId = {
        ...current,
        [slide.id]: [...slideMessages, userMessage],
      };

      writeAIInspectorState({
        contextMode,
        draftsBySlideId: nextDraftsBySlideId,
        messagesBySlideId: nextMessagesBySlideId,
        selectedActionId: resolvedAction,
      }, deckId);

      return nextMessagesBySlideId;
    });
    setDraftsBySlideId((current) => ({
      ...current,
      [slide.id]: "",
    }));

    const modelPrompt = promptKey
      ? clean
      : buildQuestionPrompt({
          contextMode,
          deckSlides,
          language,
          question: clean,
          sectionLabel,
          slide,
          slideLabel,
        });
    let assistantMessage: Message;

    try {
      const generatedContent = await generateAIResponse({
        config,
        language,
        maxOutputTokens: promptKey ? resolvePresetOutputTokens(resolvedAction, language) : resolveQuestionOutputTokens(clean),
        prompt: modelPrompt,
      });
      const content = promptKey
        ? compactPresetModelContent(generatedContent, resolvedAction, language)
        : generatedContent;

      assistantMessage = {
        id: assistantMessageId,
        role: "assistant",
        prompt: displayPrompt,
        ...(!promptKey && modelPrompt !== clean ? { modelPrompt } : {}),
        content,
        contextMode,
        action: resolvedAction,
        promptKey,
      };
    } catch (error) {
      assistantMessage = {
        id: assistantMessageId,
        role: "assistant",
        prompt: displayPrompt,
        ...(!promptKey && modelPrompt !== clean ? { modelPrompt } : {}),
        error: formatAIRequestError(error, t("ai.requestFailed")),
        contextMode,
        action: resolvedAction,
        promptKey,
      };
    } finally {
      generationLockedRef.current = false;
      setGeneratingRequest((current) => (current?.id === assistantMessageId ? null : current));
    }

    if (visibleSlideIdRef.current === slide.id) {
      setSelectedAssistantMessageId(assistantMessage.id);
    }
    setMessagesBySlideId((current) => {
      const slideMessages = current[slide.id] ?? [];
      const nextMessagesBySlideId = {
        ...current,
        [slide.id]: [...slideMessages, assistantMessage],
      };

      writeAIInspectorState({
        contextMode,
        draftsBySlideId: nextDraftsBySlideId,
        messagesBySlideId: nextMessagesBySlideId,
        selectedActionId: resolvedAction,
      }, deckId);

      return nextMessagesBySlideId;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPrompt(prompt);
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    if (canSubmit) void submitPrompt(prompt);
  }

  function handleQuickAction(action: (typeof quickActions)[number]["id"]) {
    const selectedAction = quickActions.find((item) => item.id === action);
    if (!selectedAction) return;

    void submitPrompt(
      buildPresetPrompt({
        action,
        contextMode,
        language,
        sectionLabel,
        slide,
        slideLabel,
        deckSlides,
      }),
      action,
      selectedAction.promptKey,
    );
  }

  function handleSelectAction(action: QuickActionId) {
    setSelectedActionId(action);
    setSelectedAssistantMessageId(null);
  }

  function handleSelectHistoryItem(item: ConversationHistoryItem) {
    if (!item.assistantId) return;

    setContextMode(item.contextMode);
    setSelectedActionId(item.action);
    setSelectedAssistantMessageId(item.assistantId);
    setHistoryOpenSlideId(null);
  }

  function handleContextModeChange(nextContextMode: ContextMode) {
    setContextMode(nextContextMode);
    setSelectedAssistantMessageId(null);
  }

  function updatePrompt(value: string) {
    if (providerNotice) {
      setProviderNoticeBySlideId((current) => {
        const next = { ...current };
        delete next[slide.id];
        return next;
      });
    }

    setDraftsBySlideId((current) => {
      const nextDraftsBySlideId = {
        ...current,
        [slide.id]: value,
      };

      writeAIInspectorState({
        contextMode,
        draftsBySlideId: nextDraftsBySlideId,
        messagesBySlideId,
        selectedActionId,
      }, deckId);

      return nextDraftsBySlideId;
    });
  }

  function clearConversation() {
    setClearArmedSlideId(null);
    setHistoryOpenSlideId(null);
    setSelectedAssistantMessageId(null);
    setMessagesBySlideId((current) => {
      const nextMessages = { ...current };
      delete nextMessages[slide.id];

      const nextDrafts = { ...draftsBySlideId };
      delete nextDrafts[slide.id];

      writeAIInspectorState({
        contextMode,
        draftsBySlideId: nextDrafts,
        messagesBySlideId: nextMessages,
        selectedActionId,
      }, deckId);

      return nextMessages;
    });
    setDraftsBySlideId((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[slide.id];
      return nextDrafts;
    });
  }

  function handleClearConversation() {
    if (clearArmed) {
      clearConversation();
      return;
    }

    setClearArmedSlideId(slide.id);
  }

  return (
    <aside className="glass-panel flex min-h-[560px] flex-col overflow-hidden rounded-md sm:min-h-[620px] lg:h-full lg:min-h-0">
      <div className="border-b border-border/[0.72] p-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">{t("ai.inspector")}</div>
            <div className="mt-1 text-sm font-semibold">
              {t("ai.asking")} {slideLabel}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge tone="success">{t("common.ready")}</Badge>
            <button
              aria-expanded={historyOpen}
              aria-label={t("ai.history")}
              className="flex items-center gap-1 rounded-[5px] px-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-ai-history-toggle="true"
              onClick={() => setHistoryOpenSlideId((current) => (current === slide.id ? null : slide.id))}
              title={t("ai.history")}
              type="button"
            >
              <History className="h-3 w-3" />
              {turnCount} {t("ai.turns")}
            </button>
          </div>
        </div>

        <div aria-label={t("ai.context")} className="mt-2 grid grid-cols-3 rounded-md border border-border bg-background/[0.58] p-1" role="group">
          {[
            ["current", t("ai.current")],
            ["nearby", t("ai.nearby")],
            ["deck", t("ai.deck")],
          ].map(([value, label]) => (
            <button
              aria-pressed={contextMode === value}
              className={cn(
                "h-7 rounded-[5px] text-xs font-medium transition",
                contextMode === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
              key={value}
              onClick={() => handleContextModeChange(value as ContextMode)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {historyOpen && (
            <ConversationHistoryPanel
              items={conversationHistory}
              onClose={() => setHistoryOpenSlideId(null)}
              onSelect={handleSelectHistoryItem}
              selectedAssistantMessageId={selectedConversationMessageId}
              t={t}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="border-b border-border/[0.72] p-2.5">
        <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          {contextTitle}
        </div>
        <QuickActionStack
          activeAction={activeAction}
          generatedActionIds={generatedActionIds}
          onSelect={handleSelectAction}
          selectedActionId={selectedActionId}
          t={t}
        />
        {isGenerating && !isGeneratingCurrentSlide && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-border/[0.62] bg-background/[0.46] px-2 py-1.5 text-[11px] leading-4 text-muted-foreground dark:bg-background/[0.14]">
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
            <span>{t("ai.otherRequestRunning")}</span>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-0 flex-1"
            exit={{ opacity: 0, y: 4 }}
            initial={{ opacity: 0, y: 4 }}
            key={`${slide.id}-${selectedAction.id}-${selectedAssistantMessage?.id ?? "empty"}`}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            {selectedResult ? (
              <AssistantResultPanel
                action={selectedAction}
                compact={Boolean(selectedAssistantMessage?.promptKey)}
                isGenerating={isGeneratingSelectedAction}
                onRun={() => handleQuickAction(selectedAction.id)}
                runDisabled={!canRunPreset}
                result={selectedResult}
                t={t}
              />
            ) : (
              <AssistantResultEmpty
                action={selectedAction}
                contextTitle={contextTitle}
                isGenerating={isGeneratingSelectedAction}
                notice={effectivePresetNotice}
                onRun={() => handleQuickAction(selectedAction.id)}
                runDisabled={!canRunPreset}
                slideLabel={slideLabel}
                t={t}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <form className="border-t border-border/[0.72] bg-background/[0.14] p-2 dark:bg-background/[0.08]" onSubmit={handleSubmit}>
        {effectiveProviderNotice && selectedResult && (
          <div className="mb-2 rounded-md border border-border/[0.72] bg-background/[0.50] px-2.5 py-1.5 text-xs leading-5 text-muted-foreground dark:bg-background/[0.14]">
            {effectiveProviderNotice}
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <Textarea
            aria-label={`${t("ai.askPlaceholder")} ${slideLabel}`}
            className="min-h-[54px] max-h-[104px] py-2 text-[13px] leading-5"
            disabled={!hasReadableContext}
            onChange={(event) => updatePrompt(event.target.value)}
            onKeyDown={handlePromptKeyDown}
            placeholder={hasReadableContext ? `${t("ai.askPlaceholder")} ${slideLabel}...` : t("ai.contextUnavailableShort")}
            rows={2}
            value={prompt}
          />
          <div className="flex shrink-0 items-center gap-1.5">
            {messages.length > 0 && (
              <Button
                aria-label={clearArmed ? t("ai.confirmClearConversation") : t("ai.clearConversation")}
                className={cn("h-[54px] px-2", clearArmed && "px-3")}
                disabled={isGeneratingCurrentSlide}
                onClick={handleClearConversation}
                size="sm"
                title={clearArmed ? t("ai.confirmClearConversation") : t("ai.clearConversation")}
                type="button"
                variant={clearArmed ? "danger" : "ghost"}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className={clearArmed ? "inline" : "sr-only xl:not-sr-only"}>{clearArmed ? t("ai.confirmClear") : t("ai.clear")}</span>
              </Button>
            )}
            <Button aria-label={t("ai.ask")} className="h-[54px] px-3" disabled={!canSubmit} size="sm" type="submit">
              {isGeneratingCurrentSlide ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span className="hidden xl:inline">{isGeneratingCurrentSlide ? t("ai.generating") : t("ai.ask")}</span>
            </Button>
          </div>
        </div>
      </form>
    </aside>
  );
}
