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
import {
  buildAssistantResult,
  buildPresetPrompt,
  emptyMessages,
  getAssistantPromptForLanguage,
  getContextTitle,
  getMessageCounterSeed,
  getResultMode,
  quickActionDefinitions,
  readAIInspectorState,
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
  userId: string;
};

function ResultNotesPanel({
  result,
  t,
}: {
  result: AssistantResult;
  t: (key: TranslationKey) => string;
}) {
  const noteLines = [
    result.summary,
    ...result.sections.flatMap((section) => section.content.split("\n")),
  ].filter((line) => line.trim().length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border/[0.54] bg-background/[0.08] p-2">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/[0.70] bg-white/[0.66] shadow-[0_1px_0_rgba(255,255,255,0.62)_inset,0_10px_24px_rgba(15,23,42,0.045)] dark:bg-secondary/[0.32] dark:shadow-none">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/[0.54] bg-background/[0.28] px-3 py-2 dark:bg-background/[0.08]">
          <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border border-primary/[0.22] bg-primary/10 text-primary">
              <StickyNote className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{t("ai.notes")}</span>
          </span>
          <span className="rounded-[5px] border border-border/[0.58] bg-background/[0.44] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground dark:bg-background/[0.14]">
            {t("ai.generated")}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-background/[0.10] to-background/[0.03] px-3 py-3 text-[13px] leading-5 text-muted-foreground [scrollbar-gutter:stable] dark:from-background/[0.04] dark:to-background/[0.01]">
          <div className="space-y-2">
            {noteLines.map((line, index) => (
              <ResultContentLine key={`${result.title}-${index}`} line={line} />
            ))}
          </div>
        </div>
      </div>
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

  const separatorIndex = cleanLine.search(/[:：]/);
  const hasLabel = separatorIndex > 0 && separatorIndex <= 16;
  const label = hasLabel ? cleanLine.slice(0, separatorIndex) : "";
  const body = hasLabel ? cleanLine.slice(separatorIndex + 1).trim() : cleanLine;
  const numberedItems = splitNumberedItems(body);

  if (numberedItems) {
    return (
      <div className="rounded-md border border-border/[0.56] bg-white/[0.36] px-2.5 py-2 shadow-[0_1px_0_rgba(255,255,255,0.45)_inset] dark:bg-background/[0.10] dark:shadow-none">
        {label && (
          <div className="mb-2 flex w-fit items-center gap-1.5 rounded-[5px] border border-border/[0.56] bg-background/[0.42] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground dark:bg-background/[0.14]">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            {label}
          </div>
        )}
        <div className="space-y-1.5">
          {numberedItems.map((item) => (
            <div
              className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 rounded-[5px] border border-border/[0.36] bg-background/[0.34] px-2 py-1.5 dark:bg-background/[0.10]"
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
      <div className="rounded-md border border-border/[0.42] bg-white/[0.24] px-2.5 py-2 dark:bg-background/[0.08]">
        <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
        <p className="break-words text-foreground/86">{body}</p>
      </div>
    );
  }

  return (
    <p className="rounded-[5px] px-1.5 py-1 text-foreground/86">
      {cleanLine}
    </p>
  );
}

function AssistantResultPanel({
  action,
  onRun,
  result,
  t,
}: {
  action: (typeof quickActions)[number];
  onRun: () => void;
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
    if (!metaOpen) return;

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
  }, [metaOpen]);

  async function copyResult() {
    const copyText = [
      result.title,
      "",
      result.summary,
      "",
      `${t("ai.context")}: ${result.contextNote}`,
      `${t("ai.sources")}: ${result.sourceSlideText}`,
      "",
      `## ${t("ai.promptTrace")}`,
      result.prompt,
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

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-white/[0.66] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.70)_inset,0_14px_34px_rgba(15,23,42,0.055)] dark:bg-secondary/[0.58] dark:shadow-none">
      <div className="flex items-center justify-between gap-2 border-b border-border/[0.68] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/[0.24] bg-primary/[0.12] text-primary">
            <ActionIcon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              {t("ai.generated")}
            </span>
            <span className="block truncate text-sm font-semibold">{result.title}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label={`${t("ai.runPreset")} · ${t(action.labelKey)}`}
            className="flex h-7 w-7 items-center justify-center rounded-[5px] text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onRun}
            title={`${t("ai.runPreset")} · ${t(action.labelKey)}`}
            type="button"
          >
            <Sparkles className="h-3.5 w-3.5" />
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
            {t(action.shortLabelKey)}
          </span>
        </div>
      </div>
      <div
        className="relative shrink-0 border-b border-border/[0.58] bg-background/30 px-2.5 py-1.5 dark:bg-background/[0.12]"
        ref={metaDisclosureRef}
      >
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
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
          <p className="min-w-0 border-l border-primary/30 pl-2 text-xs leading-5 text-foreground [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
            {result.summary}
          </p>
          <button
            aria-expanded={metaOpen}
            aria-controls="ai-result-context-prompt"
            aria-label={t("ai.contextPrompt")}
            className="flex h-6 min-w-0 shrink-0 items-center gap-1.5 rounded-[5px] border border-border bg-white/[0.28] px-1.5 text-left text-[10px] font-medium text-muted-foreground transition hover:bg-white/[0.48] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-background/[0.10] dark:hover:bg-secondary/[0.26]"
            data-ai-meta-toggle="true"
            onClick={() => setMetaOpen((current) => !current)}
            title={t("ai.contextPrompt")}
            type="button"
          >
            <Map className="h-3 w-3 shrink-0 text-primary/[0.78]" />
            <span className="hidden truncate xl:inline">{t("ai.contextPrompt")}</span>
            <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", metaOpen && "rotate-180")} />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {metaOpen && (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="mt-1.5 overflow-hidden rounded-md border border-border/[0.7] bg-background/82 text-[11px] leading-5 text-muted-foreground shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-secondary/72 dark:shadow-none"
              exit={{ height: 0, opacity: 0 }}
              id="ai-result-context-prompt"
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-start gap-2 px-2.5 py-1.5">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/[0.72]" />
                <p className="line-clamp-2">{result.contextNote}</p>
              </div>
              <pre className="max-h-[148px] overflow-y-auto border-t border-border/[0.56] bg-white/[0.24] px-2.5 py-1.5 whitespace-pre-wrap break-words dark:bg-background/[0.10]">
                {result.prompt}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <ResultNotesPanel key={`${action.id}-${result.title}`} result={result} t={t} />
    </div>
  );
}

function AssistantResultEmpty({
  action,
  contextTitle,
  onRun,
  promptPreview,
  slideLabel,
  t,
}: {
  action: (typeof quickActions)[number];
  contextTitle: string;
  onRun: () => void;
  promptPreview: string;
  slideLabel: string;
  t: (key: TranslationKey) => string;
}) {
  const ActionIcon = action.icon;
  const [promptOpen, setPromptOpen] = useState(false);

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
      <div className="flex flex-1 flex-col justify-center py-6">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background/[0.58] text-primary dark:bg-background/20">
          <Sparkles className="h-4 w-4" />
        </div>
        <p className="mt-3 text-center text-sm font-semibold text-foreground">{t("ai.emptyResult")}</p>
        <p className="mx-auto mt-1 max-w-[260px] text-center text-xs leading-5 text-muted-foreground">
          {t(action.hintKey)}
        </p>
        <Button
          className="mx-auto mt-4 h-8 px-3"
          data-ai-empty-run="true"
          onClick={onRun}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t("ai.runPreset")}
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border border-border/70 bg-background/[0.48] text-xs text-muted-foreground dark:bg-background/[0.14]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-2">
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase text-muted-foreground">{t("ai.context")}</span>
            <span className="block truncate text-xs font-medium text-foreground">{contextTitle}</span>
          </div>
          <button
            aria-expanded={promptOpen}
            aria-label={t("ai.contextPrompt")}
            className="flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-[5px] border border-border bg-white/[0.28] px-2 text-[10px] font-medium text-muted-foreground transition hover:bg-white/[0.48] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-background/[0.10] dark:hover:bg-secondary/[0.26]"
            data-ai-empty-prompt-toggle="true"
            onClick={() => setPromptOpen((current) => !current)}
            title={t("ai.contextPrompt")}
            type="button"
          >
            <Map className="h-3 w-3 shrink-0 text-primary/[0.78]" />
            <span className="hidden truncate xl:inline">{t("ai.contextPrompt")}</span>
            <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", promptOpen && "rotate-180")} />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {promptOpen && (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden border-t border-border/[0.56]"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <pre className="max-h-[148px] overflow-y-auto bg-white/[0.22] px-2.5 py-2 text-[11px] leading-5 whitespace-pre-wrap break-words dark:bg-background/[0.10]">
                {promptPreview}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
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
                {index === 0 && (
                  <span className="rounded-[4px] border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                    {t("ai.latest")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

type AIInspectorProps = {
  deckSlides: Slide[];
  slide: Slide;
};

export function AIInspector({ deckSlides, slide }: AIInspectorProps) {
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

  const prompt = draftsBySlideId[slide.id] ?? "";
  const messages = messagesBySlideId[slide.id] ?? emptyMessages;
  const clearArmed = clearArmedSlideId === slide.id;
  const historyOpen = historyOpenSlideId === slide.id;
  const canSubmit = prompt.trim().length > 0;
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
        userId: message.id,
      });

      return items;
    }, []);
  }, [contextMode, messages]);
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message): message is AssistantMessage => message.role === "assistant");
  const activeAction = latestAssistantMessage
    ? latestAssistantMessage.action ?? getResultMode(latestAssistantMessage.prompt)
    : undefined;
  const selectedAction = quickActions.find((action) => action.id === selectedActionId) ?? quickActions[0];
  const generatedActionIds = useMemo(() => {
    return messages.reduce<Set<QuickActionId>>((actionIds, message) => {
      if (message.role === "assistant") {
        actionIds.add(message.action ?? getResultMode(message.prompt));
      }

      return actionIds;
    }, new Set<QuickActionId>());
  }, [messages]);

  const contextTitle = useMemo(() => getContextTitle(contextMode, t), [contextMode, t]);
  const selectedPresetPrompt = useMemo(
    () =>
      buildPresetPrompt({
        action: selectedAction.id,
        contextMode,
        deckSlides,
        language,
        sectionLabel,
        slide,
        slideLabel,
      }),
    [contextMode, deckSlides, language, sectionLabel, selectedAction.id, slide, slideLabel],
  );

  const selectedAssistantMessageById = selectedAssistantMessageId
    ? messages.find(
        (message): message is AssistantMessage =>
          message.role === "assistant" &&
          message.id === selectedAssistantMessageId &&
          (message.action ?? getResultMode(message.prompt)) === selectedAction.id,
      )
    : undefined;
  const latestSelectedActionMessage = [...messages]
    .reverse()
    .find(
      (message): message is AssistantMessage =>
        message.role === "assistant" && (message.action ?? getResultMode(message.prompt)) === selectedAction.id,
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
      )
    : null;
  const selectedConversationMessageId = selectedAssistantMessage?.id ?? null;

  useEffect(() => {
    const restoreTimerId = window.setTimeout(() => {
      const restoredState = readAIInspectorState();

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
  }, []);

  useEffect(() => {
    if (!inspectorStateRestored) return;

    writeAIInspectorState({
      contextMode,
      draftsBySlideId,
      messagesBySlideId,
      selectedActionId,
    });
  }, [contextMode, draftsBySlideId, inspectorStateRestored, messagesBySlideId, selectedActionId]);

  useEffect(() => {
    if (!clearArmed) return;

    const clearTimerId = window.setTimeout(() => setClearArmedSlideId(null), 2400);
    return () => window.clearTimeout(clearTimerId);
  }, [clearArmed]);

  function submitPrompt(value: string, action?: QuickActionId, promptKey?: TranslationKey) {
    const clean = value.trim();
    if (!clean) return;

    const resolvedAction = action ?? getResultMode(clean);
    messageCounter.current += 1;
    const messageId = `${slide.id}-${messageCounter.current}`;
    const userMessage: Message = {
      id: `user-${messageId}`,
      role: "user",
      content: clean,
      promptKey,
    };
    const assistantMessage: Message = {
      id: `assistant-${messageId}`,
      role: "assistant",
      prompt: clean,
      contextMode,
      action: resolvedAction,
      promptKey,
    };

    setSelectedActionId(resolvedAction);
    setSelectedAssistantMessageId(assistantMessage.id);
    setHistoryOpenSlideId(null);
    setClearArmedSlideId(null);
    setMessagesBySlideId((current) => {
      const slideMessages = current[slide.id] ?? [];
      const nextMessagesBySlideId = {
        ...current,
        [slide.id]: [...slideMessages, userMessage, assistantMessage],
      };
      const nextDraftsBySlideId = {
        ...draftsBySlideId,
        [slide.id]: "",
      };

      writeAIInspectorState({
        contextMode,
        draftsBySlideId: nextDraftsBySlideId,
        messagesBySlideId: nextMessagesBySlideId,
        selectedActionId: resolvedAction,
      });

      return nextMessagesBySlideId;
    });
    setDraftsBySlideId((current) => ({
      ...current,
      [slide.id]: "",
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt(prompt);
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    if (canSubmit) submitPrompt(prompt);
  }

  function handleQuickAction(action: (typeof quickActions)[number]["id"]) {
    const selectedAction = quickActions.find((item) => item.id === action);
    if (!selectedAction) return;

    submitPrompt(
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

    setSelectedActionId(item.action);
    setSelectedAssistantMessageId(item.assistantId);
    setHistoryOpenSlideId(null);
  }

  function updatePrompt(value: string) {
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
      });

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
      });

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
    <aside className="glass-panel flex min-h-[660px] flex-col overflow-hidden rounded-md sm:min-h-[720px] lg:h-full lg:min-h-0">
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
              onClick={() => setContextMode(value as ContextMode)}
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
                onRun={() => handleQuickAction(selectedAction.id)}
                result={selectedResult}
                t={t}
              />
            ) : (
              <AssistantResultEmpty
                action={selectedAction}
                contextTitle={contextTitle}
                onRun={() => handleQuickAction(selectedAction.id)}
                promptPreview={selectedPresetPrompt}
                slideLabel={slideLabel}
                t={t}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <form className="border-t border-border/[0.72] bg-background/[0.14] p-2 dark:bg-background/[0.08]" onSubmit={handleSubmit}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <Textarea
            aria-label={`${t("ai.askPlaceholder")} ${slideLabel}`}
            className="min-h-[54px] max-h-[104px] py-2 text-[13px] leading-5"
            onChange={(event) => updatePrompt(event.target.value)}
            onKeyDown={handlePromptKeyDown}
            placeholder={`${t("ai.askPlaceholder")} ${slideLabel}...`}
            rows={2}
            value={prompt}
          />
          <div className="flex shrink-0 items-center gap-1.5">
            {messages.length > 0 && (
              <Button
                aria-label={clearArmed ? t("ai.confirmClearConversation") : t("ai.clearConversation")}
                className={cn("h-[54px] px-2", clearArmed && "px-3")}
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
              <Send className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t("ai.ask")}</span>
            </Button>
          </div>
        </div>
      </form>
    </aside>
  );
}

