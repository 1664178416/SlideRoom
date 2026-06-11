"use client";

import { DragEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Clock3,
  FileText,
  FileUp,
  FolderClock,
  Loader2,
  Presentation,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlideArt } from "@/components/deck/slide-art";
import { PreferencesControls } from "@/components/preferences-controls";
import { contextQualityLabelKeys, getContextQualityTone } from "@/lib/context-quality";
import { writeUploadedDeckSession } from "@/lib/deck-session";
import { getDeckSlides } from "@/lib/deck-slides";
import { deckMeta, slides } from "@/lib/mock-data";
import { getDeckDisplayTitle, normalizeDeckFileName } from "@/lib/deck-display";
import { clearProcessingSession, isProcessingComplete, processingDurationMs, writeProcessingSession } from "@/lib/processing-session";
import { getVisibleProcessingSteps } from "@/lib/processing-steps";
import { clearRecentDecks, readRecentDecks, upsertRecentDeck, type RecentDeck, type RecentDeckStatus } from "@/lib/recent-decks";
import {
  getDeckContextQuality,
  getSlideContextStats,
  isSupportedDeckFileName,
  maxUploadFileSizeBytes,
  type DeckContextQuality,
  type DeckInspectionStatus,
  type SlideContextStats,
  type UploadDeckErrorCode,
  type UploadDeckResponse,
  type UploadedDeckSession,
} from "@/lib/upload-contract";
import { Language, type TranslationKey, usePreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

type UploadState = "idle" | "processing" | "ready" | "error";

const uploadErrorMessageKeys: Record<UploadDeckErrorCode, TranslationKey> = {
  empty_file: "home.uploadErrorEmpty",
  file_too_large: "home.uploadErrorTooLarge",
  missing_file: "home.uploadErrorMissing",
  unsupported_type: "home.uploadErrorUnsupported",
  upload_failed: "home.uploadFailedHint",
};

const homeRecentDeckLimit = 4;
const localPreviewDeckId = "local-preview";
const demoContextStats = getSlideContextStats(slides);
const demoRecentDeck: RecentDeck = {
  contextQuality: "parsed",
  deckId: deckMeta.id,
  fileName: deckMeta.fileName,
  openedAt: 0,
  speakerNotesSlideCount: demoContextStats.speakerNotesSlideCount,
  slideCount: deckMeta.pageCount,
  status: "ready",
  textSlideCount: demoContextStats.textSlideCount,
};

type RecentDeckContextMeta = {
  contextQuality?: DeckContextQuality;
  contextStats?: SlideContextStats;
};

function buildWorkspaceHref(deckId: string, fileName: string) {
  const normalizedName = normalizeDeckFileName(fileName, deckMeta.fileName);
  if (normalizedName === deckMeta.fileName) return `/deck/${deckId}`;

  const workspaceParams = new URLSearchParams({ fileName: normalizedName });
  return `/deck/${deckId}?${workspaceParams.toString()}`;
}

function buildProcessingHref(deckId: string, fileName: string, startedAt: number, pageCount = deckMeta.pageCount) {
  const processingParams = new URLSearchParams({
    fileName: normalizeDeckFileName(fileName, deckMeta.fileName),
    pageCount: String(Math.max(1, Math.round(pageCount))),
    startedAt: String(startedAt || getClientTimestamp()),
  });

  return `/deck/${deckId}/processing?${processingParams.toString()}`;
}

function getClientTimestamp() {
  return Date.now();
}

class UploadDeckFileError extends Error {
  errorCode: UploadDeckErrorCode;

  constructor(errorCode: UploadDeckErrorCode, message: string) {
    super(message);
    this.errorCode = errorCode;
  }
}

function isUploadDeckFileError(error: unknown): error is UploadDeckFileError {
  return error instanceof UploadDeckFileError;
}

async function uploadDeckFile(file: File): Promise<UploadedDeckSession> {
  const formData = new FormData();

  formData.set("file", file);

  const response = await fetch("/api/decks/upload", {
    body: formData,
    method: "POST",
  });
  const result = (await response.json()) as UploadDeckResponse;

  if (!result.ok) {
    throw new UploadDeckFileError(result.errorCode, result.message);
  }

  return result.session;
}

function getResolvedRecentDeckStatus(recentDeck: RecentDeck, currentTimestamp: number): RecentDeckStatus {
  if (
    recentDeck.status === "processing" &&
    recentDeck.openedAt > 0 &&
    currentTimestamp > 0 &&
    isProcessingComplete(recentDeck.openedAt, currentTimestamp)
  ) {
    return "ready";
  }

  return recentDeck.status;
}

function getRecentDeckContextStats(recentDeck: RecentDeck): SlideContextStats | undefined {
  if (recentDeck.textSlideCount === undefined && recentDeck.speakerNotesSlideCount === undefined) return undefined;

  return {
    speakerNotesSlideCount: recentDeck.speakerNotesSlideCount ?? 0,
    textSlideCount: recentDeck.textSlideCount ?? 0,
  };
}

function formatRecentOpenedAt(openedAt: number, currentTimestamp: number, language: Language, fallbackLabel: string) {
  if (!openedAt || !currentTimestamp) return fallbackLabel;

  const locale = language === "zh" ? "zh-CN" : "en";
  const elapsedSeconds = Math.max(0, Math.round((currentTimestamp - openedAt) / 1000));
  const relativeUnits: Array<{ seconds: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { seconds: 86400, unit: "day" },
    { seconds: 3600, unit: "hour" },
    { seconds: 60, unit: "minute" },
    { seconds: 1, unit: "second" },
  ];
  const relativeUnit = relativeUnits.find((unit) => elapsedSeconds >= unit.seconds) ?? relativeUnits.at(-1);

  try {
    if (!relativeUnit) throw new Error("Missing relative time unit");

    const relativeValue = elapsedSeconds < 45 ? 0 : -Math.max(1, Math.round(elapsedSeconds / relativeUnit.seconds));
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(relativeValue, relativeUnit.unit);
  } catch {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
    }).format(new Date(openedAt));
  }
}

function buildLocalPreviewSlides({
  deckId,
  fileName,
  inspectionStatus = "unsupported",
  pageCount = 1,
}: {
  deckId: string;
  fileName: string;
  inspectionStatus?: DeckInspectionStatus;
  pageCount?: number;
}) {
  const normalizedName = normalizeDeckFileName(fileName, deckMeta.fileName);
  const normalizedPageCount = Math.max(1, Math.round(pageCount));

  return getDeckSlides({
    deckId,
    fileName: normalizedName,
    inspectionStatus,
    originalFileName: normalizedName,
    pageCount: normalizedPageCount,
    renderStatus: "unavailable",
    slides: Array.from({ length: normalizedPageCount }, (_, index) => ({
      extractedText: "",
      pageNumber: index + 1,
      speakerNotes: "",
    })),
    size: 0,
    status: "uploaded",
    storageKey: "",
    uploadedAt: getClientTimestamp(),
  });
}

export default function HomePage() {
  const router = useRouter();
  const { language, t } = usePreferences();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const processingTimersRef = useRef<number[]>([]);
  const dragDepthRef = useRef(0);
  const uploadRequestIdRef = useRef(0);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [dragActive, setDragActive] = useState(false);
  const [activeDeckId, setActiveDeckId] = useState(deckMeta.id);
  const [activeInspectionStatus, setActiveInspectionStatus] = useState<DeckInspectionStatus>("parsed");
  const [fileName, setFileName] = useState(deckMeta.fileName);
  const [activeSlideCount, setActiveSlideCount] = useState(deckMeta.pageCount);
  const [previewSlides, setPreviewSlides] = useState(slides);
  const [progress, setProgress] = useState(0);
  const [recentDecks, setRecentDecks] = useState<RecentDeck[]>([]);
  const [recentSnapshotTimestamp, setRecentSnapshotTimestamp] = useState(0);
  const [uploadErrorCode, setUploadErrorCode] = useState<UploadDeckErrorCode | null>(null);

  const visibleSteps = useMemo(() => getVisibleProcessingSteps(progress, uploadState === "ready"), [progress, uploadState]);
  const displayedRecentDecks = useMemo(() => {
    return (recentDecks.length > 0 ? recentDecks : [demoRecentDeck]).slice(0, homeRecentDeckLimit);
  }, [recentDecks]);
  const hasActiveProcessingRecentDeck = useMemo(() => {
    return displayedRecentDecks.some((recentDeck) => {
      return (
        recentDeck.status === "processing" &&
        recentDeck.openedAt > 0 &&
        !isProcessingComplete(recentDeck.openedAt, recentSnapshotTimestamp)
      );
    });
  }, [displayedRecentDecks, recentSnapshotTimestamp]);
  const contextStats = useMemo(() => getSlideContextStats(previewSlides), [previewSlides]);
  const contextQuality = useMemo(
    () =>
      getDeckContextQuality({
        inspectionStatus: activeInspectionStatus,
        pageCount: activeSlideCount,
        slides: previewSlides,
      }),
    [activeInspectionStatus, activeSlideCount, previewSlides],
  );
  const displayedContextStats =
    uploadState === "error"
      ? {
          speakerNotesSlideCount: 0,
          textSlideCount: 0,
        }
      : contextStats;
  const optimisticUploadPending = uploadState === "processing" && activeDeckId === localPreviewDeckId;
  const showContextQuality = uploadState !== "idle" && !optimisticUploadPending;
  const uploadErrorHint = uploadErrorCode ? t(uploadErrorMessageKeys[uploadErrorCode]) : null;

  const clearProcessingTimers = useCallback(() => {
    processingTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    processingTimersRef.current = [];
  }, []);

  const refreshRecentDecks = useCallback(() => {
    setRecentDecks(readRecentDecks());
    setRecentSnapshotTimestamp(getClientTimestamp());
  }, []);

  function recordRecentDeck(
    fileName: string,
    status: RecentDeckStatus,
    openedAt?: number,
    deckId = deckMeta.id,
    slideCount = deckMeta.pageCount,
    contextMeta?: RecentDeckContextMeta,
  ) {
    const openedAtTimestamp = openedAt ?? getClientTimestamp();
    const resolvedContextQuality = contextMeta ? contextMeta.contextQuality : contextQuality;
    const resolvedContextStats = contextMeta ? contextMeta.contextStats : contextStats;
    const recentDeck = upsertRecentDeck({
      ...(resolvedContextQuality ? { contextQuality: resolvedContextQuality } : {}),
      deckId,
      fileName,
      openedAt: openedAtTimestamp,
      ...(resolvedContextStats
        ? {
            speakerNotesSlideCount: resolvedContextStats.speakerNotesSlideCount,
            textSlideCount: resolvedContextStats.textSlideCount,
          }
        : {}),
      slideCount,
      status,
    });

    if (recentDeck) refreshRecentDecks();
    return recentDeck;
  }

  function isSupportedDeckFile(file: File) {
    return isSupportedDeckFileName(file.name);
  }

  function beginProcessingSession({
    deckId,
    fileName,
    pageCount = deckMeta.pageCount,
    startedAt,
    contextMeta,
  }: {
    contextMeta?: RecentDeckContextMeta;
    deckId: string;
    fileName: string;
    pageCount?: number;
    startedAt: number;
  }) {
    clearProcessingTimers();
    const normalizedName = normalizeDeckFileName(fileName, deckMeta.fileName);

    setActiveDeckId(deckId);
    setFileName(normalizedName);
    setActiveSlideCount(pageCount);
    setUploadErrorCode(null);
    setUploadState("processing");
    setProgress(8);
    writeProcessingSession({
      deckId,
      fileName: normalizedName,
      pageCount,
      startedAt,
    });
    recordRecentDeck(normalizedName, "processing", startedAt, deckId, pageCount, contextMeta);

    const checkpoints = [18, 33, 51, 68, 84, 100];
    checkpoints.forEach((value, index) => {
      const timerId = window.setTimeout(() => {
        setProgress(value);
        if (value === 100) setUploadState("ready");
      }, 360 + index * 430);
      processingTimersRef.current.push(timerId);
    });

    router.push(buildProcessingHref(deckId, normalizedName, startedAt, pageCount));
  }

  function openDemoWorkspace() {
    clearProcessingSession(deckMeta.id);
    setActiveDeckId(deckMeta.id);
    setActiveInspectionStatus("parsed");
    setActiveSlideCount(deckMeta.pageCount);
    setPreviewSlides(slides);
    recordRecentDeck(deckMeta.fileName, "ready", undefined, deckMeta.id, deckMeta.pageCount, {
      contextQuality: "parsed",
      contextStats: demoContextStats,
    });
    router.push(`/deck/${deckMeta.id}`);
  }

  function openReadyWorkspace() {
    const normalizedName = normalizeDeckFileName(fileName, deckMeta.fileName);

    recordRecentDeck(normalizedName, "ready", undefined, activeDeckId, activeSlideCount);

    if (activeDeckId === deckMeta.id && normalizedName === deckMeta.fileName) {
      clearProcessingSession(activeDeckId);
    } else {
      writeProcessingSession({
        deckId: activeDeckId,
        fileName: normalizedName,
        pageCount: activeSlideCount,
        startedAt: getClientTimestamp() - processingDurationMs,
      });
    }

    router.push(buildWorkspaceHref(activeDeckId, normalizedName));
  }

  function openRecentDeck(recentDeck: RecentDeck) {
    const normalizedName = normalizeDeckFileName(recentDeck.fileName, deckMeta.fileName);
    const processingStartedAt = recentDeck.openedAt || getClientTimestamp();
    const currentTimestamp = getClientTimestamp();
    const resolvedStatus = getResolvedRecentDeckStatus(recentDeck, currentTimestamp);
    const recentContextStats = getRecentDeckContextStats(recentDeck);
    const recentContextMeta = {
      ...(recentDeck.contextQuality ? { contextQuality: recentDeck.contextQuality } : {}),
      ...(recentContextStats ? { contextStats: recentContextStats } : {}),
    };

    if (resolvedStatus === "processing") {
      recordRecentDeck(
        normalizedName,
        "processing",
        processingStartedAt,
        recentDeck.deckId,
        recentDeck.slideCount,
        recentContextMeta,
      );
      writeProcessingSession({
        deckId: recentDeck.deckId,
        fileName: normalizedName,
        pageCount: recentDeck.slideCount,
        startedAt: processingStartedAt,
      });
      router.push(buildProcessingHref(recentDeck.deckId, normalizedName, processingStartedAt, recentDeck.slideCount));
      return;
    }

    recordRecentDeck(
      normalizedName,
      "ready",
      undefined,
      recentDeck.deckId,
      recentDeck.slideCount,
      recentContextMeta,
    );

    if (recentDeck.deckId === deckMeta.id && normalizedName === deckMeta.fileName) {
      clearProcessingSession(recentDeck.deckId);
    } else {
      writeProcessingSession({
        deckId: recentDeck.deckId,
        fileName: normalizedName,
        pageCount: recentDeck.slideCount,
        startedAt: currentTimestamp - processingDurationMs,
      });
    }

    router.push(buildWorkspaceHref(recentDeck.deckId, normalizedName));
  }

  function clearRecentHistory() {
    clearRecentDecks();
    clearProcessingSession();
    refreshRecentDecks();
  }

  const uploadBusy = uploadState === "processing";

  function openUploadPicker() {
    if (uploadBusy) return;

    inputRef.current?.click();
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    uploadRequestIdRef.current += 1;
    const uploadRequestId = uploadRequestIdRef.current;

    if (!isSupportedDeckFile(file)) {
      const failedFileName = normalizeDeckFileName(file.name, deckMeta.fileName);

      clearProcessingTimers();
      setActiveDeckId(localPreviewDeckId);
      setFileName(failedFileName);
      setActiveInspectionStatus("failed");
      setActiveSlideCount(1);
      setPreviewSlides(buildLocalPreviewSlides({ deckId: localPreviewDeckId, fileName: failedFileName, inspectionStatus: "failed" }));
      setUploadErrorCode("unsupported_type");
      setUploadState("error");
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (file.size <= 0) {
      const failedFileName = normalizeDeckFileName(file.name, deckMeta.fileName);

      clearProcessingTimers();
      setActiveDeckId(localPreviewDeckId);
      setFileName(failedFileName);
      setActiveInspectionStatus("failed");
      setActiveSlideCount(1);
      setPreviewSlides(buildLocalPreviewSlides({ deckId: localPreviewDeckId, fileName: failedFileName, inspectionStatus: "failed" }));
      setUploadErrorCode("empty_file");
      setUploadState("error");
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (file.size > maxUploadFileSizeBytes) {
      const failedFileName = normalizeDeckFileName(file.name, deckMeta.fileName);

      clearProcessingTimers();
      setActiveDeckId(localPreviewDeckId);
      setFileName(failedFileName);
      setActiveInspectionStatus("failed");
      setActiveSlideCount(1);
      setPreviewSlides(buildLocalPreviewSlides({ deckId: localPreviewDeckId, fileName: failedFileName, inspectionStatus: "failed" }));
      setUploadErrorCode("file_too_large");
      setUploadState("error");
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const optimisticFileName = normalizeDeckFileName(file.name, deckMeta.fileName);

    clearProcessingTimers();
    setActiveDeckId(localPreviewDeckId);
    setActiveInspectionStatus("unsupported");
    setFileName(optimisticFileName);
    setActiveSlideCount(1);
    setPreviewSlides(buildLocalPreviewSlides({ deckId: localPreviewDeckId, fileName: optimisticFileName }));
    setUploadErrorCode(null);
    setUploadState("processing");
    setProgress(4);

    try {
      const uploadedDeckSession = await uploadDeckFile(file);
      if (uploadRequestId !== uploadRequestIdRef.current) return;

      const storedDeckSession = writeUploadedDeckSession(uploadedDeckSession) ?? uploadedDeckSession;
      const uploadedSlides = getDeckSlides(storedDeckSession);
      const uploadedPageCount = Math.max(1, storedDeckSession.pageCount || uploadedSlides.length);
      const uploadedContextStats = getSlideContextStats(uploadedSlides);
      const uploadedContextQuality = getDeckContextQuality({
        inspectionStatus: storedDeckSession.inspectionStatus,
        pageCount: uploadedPageCount,
        slides: uploadedSlides,
      });

      setActiveInspectionStatus(storedDeckSession.inspectionStatus);
      setPreviewSlides(uploadedSlides);
      setActiveSlideCount(uploadedPageCount);

      beginProcessingSession({
        contextMeta: {
          contextQuality: uploadedContextQuality,
          contextStats: uploadedContextStats,
        },
        deckId: storedDeckSession.deckId,
        fileName: storedDeckSession.fileName,
        pageCount: uploadedPageCount,
        startedAt: storedDeckSession.uploadedAt,
      });
    } catch (error) {
      if (uploadRequestId !== uploadRequestIdRef.current) return;

      clearProcessingTimers();
      setActiveDeckId(localPreviewDeckId);
      setFileName(optimisticFileName);
      setActiveInspectionStatus("failed");
      setActiveSlideCount(1);
      setPreviewSlides(buildLocalPreviewSlides({ deckId: localPreviewDeckId, fileName: optimisticFileName, inspectionStatus: "failed" }));
      setUploadErrorCode(isUploadDeckFileError(error) ? error.errorCode : "upload_failed");
      setUploadState("error");
      setProgress(0);
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    if (uploadBusy) return;

    handleFiles(event.dataTransfer.files);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (uploadBusy) return;

    dragDepthRef.current += 1;
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (uploadBusy) return;

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragActive(false);
    }
  }

  function handleUploadKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    openUploadPicker();
  }

  useEffect(() => {
    return () => clearProcessingTimers();
  }, [clearProcessingTimers]);

  useEffect(() => {
    const refreshTimerId = window.setTimeout(refreshRecentDecks, 0);

    function handleRecentDecksChange() {
      refreshRecentDecks();
    }

    window.addEventListener("focus", handleRecentDecksChange);
    window.addEventListener("storage", handleRecentDecksChange);

    return () => {
      window.clearTimeout(refreshTimerId);
      window.removeEventListener("focus", handleRecentDecksChange);
      window.removeEventListener("storage", handleRecentDecksChange);
    };
  }, [refreshRecentDecks]);

  useEffect(() => {
    if (!hasActiveProcessingRecentDeck) return;

    const statusTimerId = window.setInterval(() => {
      setRecentSnapshotTimestamp(getClientTimestamp());
    }, 800);

    return () => window.clearInterval(statusTimerId);
  }, [hasActiveProcessingRecentDeck]);

  const statusLabel = {
    idle: t("home.waiting"),
    processing: t("home.processing"),
    ready: t("home.ready"),
    error: t("home.invalidFile"),
  }[uploadState];

  const statusHint = {
    idle: t("home.fileTypes"),
    processing: t("home.processingHint"),
    ready: t("home.readyHint"),
    error: uploadErrorHint ?? t("home.invalidFileHint"),
  }[uploadState];

  return (
    <main className="min-h-screen p-3">
      <div className="grid grid-cols-1 gap-3 lg:min-h-[calc(100vh-1.5rem)] lg:grid-cols-[282px_minmax(0,1fr)]">
        <section className="glass-panel order-1 flex min-h-[640px] flex-col rounded-md lg:order-2 lg:min-h-[calc(100vh-1.5rem)]">
          <div className="flex h-14 items-center justify-between gap-2 border-b border-border/[0.72] px-3 sm:px-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold">SlideRoom</div>
              <div className="hidden truncate text-xs text-muted-foreground sm:block">{t("app.tagline")}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <PreferencesControls className="lg:hidden" />
              <Button aria-label={t("home.enterWorkspace")} onClick={openDemoWorkspace} variant="ghost">
                <span className="hidden sm:inline">{t("home.enterWorkspace")}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex min-h-[320px] items-center justify-center rounded-md border border-border/[0.72] bg-white/[0.36] p-3 dark:bg-secondary/[0.28] sm:p-4 xl:min-h-0">
              <div className="w-full max-w-4xl">
                <div
                  aria-label={t("home.uploadTitle")}
                  className={cn(
                    "flex min-h-[248px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-5 text-center outline-none transition focus-visible:border-primary/[0.58] focus-visible:ring-2 focus-visible:ring-primary/[0.16] sm:min-h-[280px] sm:p-6",
                    uploadState === "error"
                      ? "border-destructive bg-destructive/[0.06] hover:bg-destructive/[0.08]"
                      : uploadBusy
                        ? "cursor-wait border-primary/[0.34] bg-primary/[0.06]"
                        : dragActive
                          ? "border-primary bg-primary/[0.08]"
                          : "border-border bg-background/[0.56] hover:border-primary/[0.52] hover:bg-white/[0.58] dark:hover:bg-secondary/[0.58]",
                  )}
                  aria-disabled={uploadBusy}
                  onClick={openUploadPicker}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (uploadBusy) return;

                    setDragActive(true);
                  }}
                  onDrop={handleDrop}
                  onKeyDown={handleUploadKeyDown}
                  role="button"
                  tabIndex={0}
                >
                  <input
                    accept=".ppt,.pptx"
                    className="hidden"
                    disabled={uploadBusy}
                    onChange={(event) => handleFiles(event.target.files)}
                    ref={inputRef}
                    type="file"
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-foreground text-background">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <div className="mt-5 text-xl font-semibold tracking-normal">{t("home.uploadTitle")}</div>
                  <div className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    {t("home.uploadDescription")}
                  </div>
                  <Badge className="mt-3" tone={uploadState === "error" ? "danger" : "neutral"}>
                    {uploadState === "error" ? uploadErrorHint ?? t("home.invalidFileHint") : t("home.fileTypes")}
                  </Badge>
                  <span className="mt-5 inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors">
                    {uploadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadBusy
                      ? t("home.processing")
                      : uploadState === "error"
                        ? t("home.uploadAnother")
                        : t("home.chooseFile")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex min-h-[360px] flex-col overflow-hidden rounded-md border border-border/[0.72] bg-white/[0.42] p-3 dark:bg-secondary/[0.36] xl:min-h-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{fileName}</div>
                  <div
                    aria-live="polite"
                    className={cn(
                      "mt-1 text-xs text-muted-foreground",
                      uploadState === "error" && "text-destructive",
                    )}
                  >
                    {statusLabel}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{statusHint}</div>
                  {showContextQuality && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={getContextQualityTone(contextQuality)}>
                        {t(contextQualityLabelKeys[contextQuality])}
                      </Badge>
                      {uploadState !== "error" && (
                        <>
                          <Badge tone="neutral">
                            {t("common.textSlides")}: {displayedContextStats.textSlideCount}/{activeSlideCount}
                          </Badge>
                          <Badge tone="neutral">
                            {t("common.noteSlides")}: {displayedContextStats.speakerNotesSlideCount}/{activeSlideCount}
                          </Badge>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {uploadState === "processing" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : uploadState === "ready" ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : uploadState === "error" ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <Presentation className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  animate={{ width: `${progress}%` }}
                  className={cn("h-full rounded-full", uploadState === "error" ? "bg-destructive" : "bg-primary")}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-md border border-border/[0.62] bg-background/[0.28] p-2 dark:bg-background/[0.12]">
                <div className="grid max-h-full grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {previewSlides.map((slide, index) => {
                    const ready = uploadState === "ready" || progress >= ((index + 1) / previewSlides.length) * 92;
                    return (
                      <motion.div
                        animate={{ opacity: ready ? 1 : 0.42, y: ready ? 0 : 4 }}
                        className="rounded-md border border-border bg-background/[0.54] p-1.5 dark:bg-background/[0.16]"
                        key={slide.id}
                      >
                        <SlideArt slide={slide} compact />
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {(uploadState === "processing" || uploadState === "ready") && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {visibleSteps.map((step) => (
                    <Badge key={step} tone={step === "processing.ready" ? "success" : "neutral"}>
                      {t(step)}
                    </Badge>
                  ))}
                </div>
              )}

              <Button
                className="mt-4 w-full"
                disabled={uploadState !== "ready"}
                onClick={openReadyWorkspace}
              >
                {t("home.openWorkspace")}
                <ArrowRight className="h-4 w-4" />
              </Button>

              {uploadState === "error" && (
                <Button className="mt-2 w-full" onClick={openUploadPicker} variant="outline">
                  <Upload className="h-4 w-4" />
                  {t("home.uploadAnother")}
                </Button>
              )}
            </div>
          </div>
        </section>

        <aside className="glass-panel order-2 flex flex-col rounded-md p-3 lg:order-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-foreground text-sm font-semibold text-background">
                SR
              </div>
              <div className="min-w-0">
                <div className="font-semibold">SlideRoom</div>
                <div className="truncate text-xs text-muted-foreground">{t("app.subtitle")}</div>
              </div>
            </div>
            <PreferencesControls className="hidden shrink-0 lg:flex" />
          </div>

          <div className="mt-6 space-y-2 lg:mt-8">
            <Button className="w-full justify-start" disabled={uploadBusy} onClick={openUploadPicker}>
              {uploadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadBusy ? t("home.processing") : t("home.uploadPpt")}
            </Button>
            <Button
              className="w-full justify-start"
              onClick={openDemoWorkspace}
              variant="outline"
            >
              <Presentation className="h-4 w-4" />
              {t("home.openDemoDeck")}
            </Button>
          </div>

          <div className="mt-6 lg:mt-8">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <FolderClock className="h-3.5 w-3.5" />
                <span className="truncate">{t("home.recent")}</span>
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="hidden truncate text-[10px] font-medium text-muted-foreground sm:inline">
                  {t("home.recentHint")}
                </span>
                {recentDecks.length > 0 && (
                  <button
                    aria-label={t("home.clearRecent")}
                    className="flex h-6 w-6 items-center justify-center rounded-[5px] text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-clear-recent-decks="true"
                    onClick={clearRecentHistory}
                    title={t("home.clearRecent")}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </div>
            <div className="space-y-1.5">
              {displayedRecentDecks.map((recentDeck) => {
                const normalizedName = normalizeDeckFileName(recentDeck.fileName, deckMeta.fileName);
                const recentTitle = getDeckDisplayTitle(normalizedName, deckMeta.title);
                const openedLabel = formatRecentOpenedAt(
                  recentDeck.openedAt,
                  recentSnapshotTimestamp,
                  language,
                  t("home.sampleDeck"),
                );
                const resolvedStatus = getResolvedRecentDeckStatus(recentDeck, recentSnapshotTimestamp);
                const recentContextStats = getRecentDeckContextStats(recentDeck);
                const recentContextQuality = recentDeck.contextQuality;
                const recentContextTone = getContextQualityTone(recentContextQuality);
                const statusLabel =
                  recentDeck.openedAt === 0
                    ? t("home.sampleDeck")
                    : resolvedStatus === "processing"
                      ? t("home.processingDeck")
                      : t("home.readyDeck");

                return (
                  <button
                    aria-label={`${t("home.openRecent")}: ${recentTitle}`}
                    className="group grid w-full grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border/[0.72] bg-white/[0.34] px-2 py-2 text-left transition hover:border-primary/[0.28] hover:bg-white/[0.68] dark:bg-secondary/[0.34] dark:hover:bg-secondary/[0.62]"
                    data-recent-deck="true"
                    data-recent-deck-file={normalizedName}
                    data-recent-deck-status={resolvedStatus}
                    key={`${recentDeck.deckId}-${normalizedName}`}
                    onClick={() => openRecentDeck(recentDeck)}
                    type="button"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/[0.54] text-primary transition group-hover:border-primary/[0.28] group-hover:bg-primary/10 dark:bg-background/[0.14]">
                      <Presentation className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground">{recentTitle}</span>
                      <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="shrink-0 tabular-nums">
                          {recentDeck.slideCount || deckMeta.pageCount} {t("common.slides")}
                        </span>
                        <span className="text-border">/</span>
                        <Clock3 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{openedLabel}</span>
                      </span>
                      {recentContextQuality && (
                        <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
                          <span
                            className={cn(
                              "rounded-[5px] border px-1.5 py-0.5 text-[9px] font-semibold",
                              recentContextTone === "success" && "border-primary/20 bg-primary/10 text-primary",
                              recentContextTone === "accent" && "border-accent/20 bg-accent/10 text-foreground",
                              recentContextTone === "danger" &&
                                "border-destructive/20 bg-destructive/10 text-destructive",
                              recentContextTone === "neutral" && "border-border bg-background/[0.46] text-muted-foreground",
                            )}
                          >
                            {t(contextQualityLabelKeys[recentContextQuality])}
                          </span>
                          {recentContextStats && (
                            <span className="truncate text-[9px] font-medium tabular-nums text-muted-foreground">
                              {t("slideArt.text")} {recentContextStats.textSlideCount}/
                              {recentDeck.slideCount || deckMeta.pageCount}
                              <span className="px-1 text-border">/</span>
                              {t("slideArt.notes")} {recentContextStats.speakerNotesSlideCount}/
                              {recentDeck.slideCount || deckMeta.pageCount}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span
                        className={cn(
                          "rounded-[5px] border px-1.5 py-0.5 text-[9px] font-semibold",
                          resolvedStatus === "processing" && recentDeck.openedAt !== 0
                            ? "border-accent/20 bg-accent/10 text-accent"
                            : "border-primary/20 bg-primary/10 text-primary",
                        )}
                      >
                        {statusLabel}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto pt-6 lg:pt-8">
            <Badge tone="accent">{t("home.mvp")}</Badge>
          </div>
        </aside>
      </div>
    </main>
  );
}
