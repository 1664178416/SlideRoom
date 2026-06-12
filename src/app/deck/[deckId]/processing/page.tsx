"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Presentation,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PreferencesControls } from "@/components/preferences-controls";
import { SlideArt } from "@/components/deck/slide-art";
import { contextQualityLabelKeys, getContextQualityTone } from "@/lib/context-quality";
import { readUploadedDeckSession, writeUploadedDeckSession } from "@/lib/deck-session";
import { getSessionDeckTitle, normalizeDeckFileName } from "@/lib/deck-display";
import { getDeckSlides } from "@/lib/deck-slides";
import { deckMeta, isDemoDeckId } from "@/lib/mock-data";
import { processingDurationMs, readProcessingSession, writeProcessingSession, type ProcessingSession } from "@/lib/processing-session";
import { getActiveProcessingStepIndex, processingSteps } from "@/lib/processing-steps";
import { upsertRecentDeck } from "@/lib/recent-decks";
import {
  getDeckContextQuality,
  getSlideContextStats,
  type ReadDeckResponse,
  type UploadedDeckSession,
} from "@/lib/upload-contract";
import {
  formatSlideLabel,
  getGeneratedKickerLabel,
  getGeneratedSlideTitle,
  usePreferences,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

const autoOpenDelayMs = 900;
const progressUpdateIntervalMs = 180;

function calculateProcessingProgress(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  return Math.min(100, Math.max(6, Math.round((elapsed / processingDurationMs) * 100)));
}

function readRouteProcessingSession(
  deckId: string,
  searchParams: Pick<URLSearchParams, "get">,
): ProcessingSession | null {
  const fileName = normalizeDeckFileName(searchParams.get("fileName") ?? "", deckMeta.fileName);
  const pageCount = Number(searchParams.get("pageCount"));
  const startedAt = Number(searchParams.get("startedAt"));

  if (!Number.isFinite(startedAt)) return null;

  return {
    deckId,
    fileName,
    pageCount: Number.isFinite(pageCount) ? Math.max(1, Math.round(pageCount)) : undefined,
    startedAt,
  };
}

function buildFallbackUploadedSession({
  deckId,
  fileName,
  processingSession,
}: {
  deckId: string;
  fileName: string;
  processingSession: ProcessingSession | null;
}): UploadedDeckSession | null {
  if (isDemoDeckId(deckId)) return null;

  return {
    deckId,
    fileName,
    inspectionStatus: "unsupported",
    originalFileName: fileName,
    pageCount: Math.max(1, processingSession?.pageCount ?? 1),
    slides: [],
    size: 0,
    status: "uploaded",
    storageKey: "",
    uploadedAt: processingSession?.startedAt ?? 0,
  };
}

async function fetchUploadedDeckSession(deckId: string) {
  if (isDemoDeckId(deckId)) return null;

  const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}`);
  const result = (await response.json()) as ReadDeckResponse;

  if (!result.ok) return null;
  return result.session;
}

export default function DeckProcessingPage() {
  const router = useRouter();
  const params = useParams<{ deckId?: string }>();
  const searchParams = useSearchParams();
  const { language, t } = usePreferences();
  const autoOpenTimerRef = useRef<number | null>(null);
  const deckId = params.deckId || deckMeta.id;
  const routeProcessingSession = useMemo(
    () => readRouteProcessingSession(deckId, searchParams),
    [deckId, searchParams],
  );
  const [storedProcessingSession, setStoredProcessingSession] = useState<ProcessingSession | null>(null);
  const [uploadedDeckSession, setUploadedDeckSession] = useState<UploadedDeckSession | null>(null);
  const processingSession = routeProcessingSession ?? storedProcessingSession;
  const processingStartedAt = processingSession?.startedAt ?? uploadedDeckSession?.uploadedAt ?? 0;
  const fileName = processingSession?.fileName ?? uploadedDeckSession?.fileName ?? deckMeta.fileName;
  const effectiveUploadedSession = useMemo(() => {
    return uploadedDeckSession ?? buildFallbackUploadedSession({ deckId, fileName, processingSession });
  }, [deckId, fileName, processingSession, uploadedDeckSession]);
  const deckSlides = useMemo(() => getDeckSlides(effectiveUploadedSession), [effectiveUploadedSession]);
  const pageCount = deckSlides.length;
  const contextStats = useMemo(() => getSlideContextStats(deckSlides), [deckSlides]);
  const contextQuality = useMemo(
    () =>
      getDeckContextQuality({
        inspectionStatus: effectiveUploadedSession?.inspectionStatus ?? "parsed",
        pageCount,
        slides: deckSlides,
      }),
    [deckSlides, effectiveUploadedSession?.inspectionStatus, pageCount],
  );
  const [progress, setProgress] = useState(6);
  const deckTitle = getSessionDeckTitle(fileName, deckMeta.fileName, deckMeta.title);
  const ready = progress >= 100;
  const processingHref = useMemo(() => {
    const searchParams = new URLSearchParams({
      fileName,
      pageCount: String(pageCount),
      startedAt: String(processingStartedAt || 0),
    });

    return `/deck/${deckId}/processing?${searchParams.toString()}`;
  }, [deckId, fileName, pageCount, processingStartedAt]);
  const workspaceHref = useMemo(() => {
    if (fileName === deckMeta.fileName) return `/deck/${deckId}`;

    const searchParams = new URLSearchParams({ fileName });

    return `/deck/${deckId}?${searchParams.toString()}`;
  }, [deckId, fileName]);

  const activeStepIndex = useMemo(() => getActiveProcessingStepIndex(progress, ready), [progress, ready]);

  useEffect(() => {
    let active = true;

    const restoreTimerId = window.setTimeout(() => {
      setStoredProcessingSession(readProcessingSession(deckId));
      const storedUploadedDeckSession = readUploadedDeckSession(deckId);
      if (active) setUploadedDeckSession(storedUploadedDeckSession);

      fetchUploadedDeckSession(deckId)
        .then((session) => {
          if (!active || !session) return;

          const storedSession = writeUploadedDeckSession(session) ?? session;
          setUploadedDeckSession(storedSession);
        })
        .catch(() => {
          // Missing metadata should not block the processing fallback.
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(restoreTimerId);
    };
  }, [deckId]);

  useEffect(() => {
    if (routeProcessingSession) {
      writeProcessingSession(routeProcessingSession);
      upsertRecentDeck({
        contextQuality,
        deckId: routeProcessingSession.deckId,
        fileName: routeProcessingSession.fileName,
        openedAt: routeProcessingSession.startedAt,
        speakerNotesSlideCount: contextStats.speakerNotesSlideCount,
        slideCount: routeProcessingSession.pageCount ?? pageCount,
        status: "processing",
        textSlideCount: contextStats.textSlideCount,
      });

      if (window.location.pathname + window.location.search !== processingHref) {
        router.replace(processingHref, { scroll: false });
      }
    }
  }, [contextQuality, contextStats, pageCount, processingHref, routeProcessingSession, router]);

  useEffect(() => {
    upsertRecentDeck({
      contextQuality,
      deckId,
      fileName,
      openedAt: processingStartedAt,
      speakerNotesSlideCount: contextStats.speakerNotesSlideCount,
      slideCount: pageCount,
      status: ready ? "ready" : "processing",
      textSlideCount: contextStats.textSlideCount,
    });
  }, [contextQuality, contextStats, deckId, fileName, pageCount, processingStartedAt, ready]);

  useEffect(() => {
    const startedAt = processingStartedAt || Date.now();
    let progressTimerId = 0;

    function updateProgress() {
      const nextProgress = calculateProcessingProgress(startedAt);
      setProgress(nextProgress);

      if (nextProgress >= 100 && progressTimerId) {
        window.clearInterval(progressTimerId);
      }
    }

    updateProgress();
    progressTimerId = window.setInterval(updateProgress, progressUpdateIntervalMs);

    return () => window.clearInterval(progressTimerId);
  }, [deckId, processingStartedAt]);

  useEffect(() => {
    if (!ready) return;

    autoOpenTimerRef.current = window.setTimeout(() => {
      upsertRecentDeck({
        contextQuality,
        deckId,
        fileName,
        openedAt: Date.now(),
        speakerNotesSlideCount: contextStats.speakerNotesSlideCount,
        slideCount: pageCount,
        status: "ready",
        textSlideCount: contextStats.textSlideCount,
      });
      router.push(workspaceHref);
    }, autoOpenDelayMs);

    return () => {
      if (autoOpenTimerRef.current !== null) {
        window.clearTimeout(autoOpenTimerRef.current);
        autoOpenTimerRef.current = null;
      }
    };
  }, [contextQuality, contextStats, deckId, fileName, pageCount, ready, router, workspaceHref]);

  function openWorkspace() {
    if (autoOpenTimerRef.current !== null) {
      window.clearTimeout(autoOpenTimerRef.current);
      autoOpenTimerRef.current = null;
    }

    upsertRecentDeck({
      contextQuality,
      deckId,
      fileName,
      openedAt: Date.now(),
      speakerNotesSlideCount: contextStats.speakerNotesSlideCount,
      slideCount: pageCount,
      status: "ready",
      textSlideCount: contextStats.textSlideCount,
    });

    router.push(workspaceHref);
  }

  const readySlideCount = Math.min(
    deckSlides.length,
    Math.floor((progress / 100) * deckSlides.length),
  );

  return (
    <main className="min-h-screen p-3">
      <div className="glass-panel flex min-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-md">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/[0.72] px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-background">
              SR
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">SlideRoom</div>
              <div className="hidden truncate text-xs text-muted-foreground sm:block">
                {t("processing.subtitle")}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <PreferencesControls />
            <Button
              aria-label={t("processing.backHome")}
              onClick={() => router.push("/")}
              size="icon"
              title={t("processing.backHome")}
              type="button"
              variant="ghost"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="flex min-h-[420px] flex-col rounded-md border border-border/[0.72] bg-white/[0.42] p-3 dark:bg-secondary/[0.34] lg:min-h-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                  {t("processing.title")}
                </div>
                <div className="mt-1 truncate text-base font-semibold">{deckTitle}</div>
              </div>
              <Badge tone={ready ? "success" : "accent"}>
                {ready ? t("processing.ready") : `${progress}%`}
              </Badge>
            </div>

            <div className="mt-4 rounded-md border border-border bg-background/[0.46] p-3 dark:bg-background/[0.14]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                {t("processing.file")}
              </div>
              <div className="mt-2 truncate text-sm font-semibold">{fileName}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {pageCount} {t("common.slides")}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={getContextQualityTone(contextQuality)}>
                  {t(contextQualityLabelKeys[contextQuality])}
                </Badge>
                <Badge tone="neutral">
                  {t("common.textSlides")}: {contextStats.textSlideCount}/{pageCount}
                </Badge>
                <Badge tone="neutral">
                  {t("common.noteSlides")}: {contextStats.speakerNotesSlideCount}/{pageCount}
                </Badge>
              </div>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                animate={{ width: `${progress}%` }}
                className="h-full rounded-full bg-primary"
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>

            <div className="mt-4 min-h-0 flex-1 rounded-md border border-border/[0.72] bg-background/[0.34] p-2 dark:bg-background/[0.12]">
              <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                {t("processing.pipeline")}
              </div>
              <div className="space-y-1.5">
                {processingSteps.map((step, index) => {
                  const done = index < activeStepIndex || ready;
                  const active = !ready && index === activeStepIndex;

                  return (
                    <div
                      className={cn(
                        "grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 rounded-[5px] border px-2 py-1.5 text-xs transition",
                        done
                          ? "border-primary/[0.24] bg-primary/10 text-foreground"
                          : active
                            ? "border-border bg-white/[0.54] text-foreground dark:bg-secondary/[0.38]"
                            : "border-transparent text-muted-foreground",
                      )}
                      key={step}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-border bg-background/[0.52] dark:bg-background/[0.14]">
                        {done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        ) : active ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45" aria-hidden="true" />
                        )}
                      </span>
                      <span className="truncate font-medium">{t(step)}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {done ? t("processing.pageReady") : active ? `${progress}%` : t("processing.pageQueued")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button
              className="mt-3 w-full"
              disabled={!ready}
              onClick={openWorkspace}
              type="button"
            >
              {ready ? t("processing.openNow") : t("processing.preparingWorkspace")}
              {ready ? <ArrowRight className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            </Button>
          </aside>

          <section className="flex min-h-[520px] flex-col overflow-hidden rounded-md border border-border/[0.72] bg-white/[0.36] p-3 dark:bg-secondary/[0.28] lg:min-h-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                  {t("processing.pages")}
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {readySlideCount}/{deckSlides.length} {t("common.ready")}
                </div>
              </div>
              <Badge tone={ready ? "success" : "neutral"}>
                {ready ? t("processing.autoOpen") : t(processingSteps[activeStepIndex])}
              </Badge>
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-md border border-border/[0.62] bg-background/[0.26] p-2 dark:bg-background/[0.10]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {deckSlides.map((slide, index) => {
                  const status =
                    index < readySlideCount
                      ? "ready"
                      : index === readySlideCount
                        ? "processing"
                        : "queued";
                  const slideTitle = getGeneratedSlideTitle(slide.title, slide.pageNumber, language);

                  return (
                    <motion.div
                      animate={{ opacity: status === "queued" ? 0.46 : 1, y: status === "queued" ? 4 : 0 }}
                      className="overflow-hidden rounded-md border border-border bg-background/[0.54] p-1.5 dark:bg-background/[0.16]"
                      key={slide.id}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <SlideArt slide={slide} compact />
                      <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold">
                            {formatSlideLabel(slide.pageNumber, language)} · {slideTitle}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {getGeneratedKickerLabel(slide.kicker, language)}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "flex h-6 shrink-0 items-center gap-1 rounded-[5px] border px-1.5 text-[10px] font-medium",
                            status === "ready"
                              ? "border-primary/[0.22] bg-primary/10 text-primary"
                              : status === "processing"
                                ? "border-border bg-white/[0.48] text-foreground dark:bg-secondary/[0.34]"
                                : "border-border bg-background/[0.44] text-muted-foreground",
                          )}
                        >
                          {status === "ready" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : status === "processing" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Presentation className="h-3 w-3" />
                          )}
                          {status === "ready"
                            ? t("processing.pageReady")
                            : status === "processing"
                              ? t("processing.pageProcessing")
                              : t("processing.pageQueued")}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <AnimatePresence>
              {ready && (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 rounded-md border border-primary/[0.24] bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
                  exit={{ opacity: 0, y: 4 }}
                  initial={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  {t("processing.autoOpen")}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </div>
    </main>
  );
}
