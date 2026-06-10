"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent, type WheelEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { TopBar } from "@/components/deck/top-bar";
import { SlideRail } from "@/components/deck/slide-rail";
import { SlideStage } from "@/components/deck/slide-stage";
import { AIInspector } from "@/components/deck/ai-inspector";
import { WorkspaceCommandMenu } from "@/components/deck/workspace-command-menu";
import { readUploadedDeckSession, writeUploadedDeckSession } from "@/lib/deck-session";
import { getSessionDeckTitle, normalizeDeckFileName } from "@/lib/deck-display";
import { buildDeckMarkdownExport, getDeckMarkdownFileName } from "@/lib/deck-export";
import { getDeckSlides } from "@/lib/deck-slides";
import { deckMeta, type Slide } from "@/lib/mock-data";
import { readProcessingSession, writeProcessingSession, type ProcessingSession } from "@/lib/processing-session";
import { upsertRecentDeck } from "@/lib/recent-decks";
import {
  getDeckContextQuality,
  getSlideContextStats,
  isSupportedDeckFileName,
  maxUploadFileSizeBytes,
  type ReadDeckResponse,
  type UploadDeckErrorCode,
  type UploadDeckResponse,
  type UploadedDeckSession,
} from "@/lib/upload-contract";
import { type TranslationKey, usePreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

type WorkspaceState = {
  currentSlideId?: string;
  inspectorOpen?: boolean;
  railOpen?: boolean;
  zoom?: number;
};

const workspaceStorageKey = "slideroom-workspace-state-v2";
const completedProcessingStartedAtOffsetMs = 3600;
const slideWheelThreshold = 72;
const slideWheelResetMs = 220;
const slideWheelCooldownMs = 520;
const slideSwipeThresholdPx = 56;
const slideSwipeMaxDurationMs = 700;
const slideSwipeDominanceRatio = 1.35;
const uploadErrorMessageKeys: Record<UploadDeckErrorCode, TranslationKey> = {
  empty_file: "home.uploadErrorEmpty",
  file_too_large: "home.uploadErrorTooLarge",
  missing_file: "home.uploadErrorMissing",
  unsupported_type: "home.uploadErrorUnsupported",
  upload_failed: "home.uploadFailedHint",
};

function getClientTimestamp() {
  return Date.now();
}

function buildProcessingHref(deckId: string, fileName: string, startedAt: number, pageCount = deckMeta.pageCount) {
  const processingParams = new URLSearchParams({
    fileName: normalizeDeckFileName(fileName, deckMeta.fileName),
    pageCount: String(Math.max(1, Math.round(pageCount))),
    startedAt: String(startedAt || getClientTimestamp()),
  });

  return `/deck/${deckId}/processing?${processingParams.toString()}`;
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

function getWorkspaceStorageKey(deckId: string) {
  return `${workspaceStorageKey}:${deckId}`;
}

function hasSlide(deckSlides: Slide[], slideId?: string) {
  return Boolean(slideId && deckSlides.some((slide) => slide.id === slideId));
}

function readWorkspaceState(deckId: string, deckSlides: Slide[]): WorkspaceState {
  if (typeof window === "undefined") return {};

  try {
    const storedState = window.localStorage.getItem(getWorkspaceStorageKey(deckId));
    if (!storedState) return {};

    const parsedState = JSON.parse(storedState) as WorkspaceState;
    return {
      currentSlideId: hasSlide(deckSlides, parsedState.currentSlideId) ? parsedState.currentSlideId : undefined,
      inspectorOpen: typeof parsedState.inspectorOpen === "boolean" ? parsedState.inspectorOpen : undefined,
      railOpen: typeof parsedState.railOpen === "boolean" ? parsedState.railOpen : undefined,
      zoom: typeof parsedState.zoom === "number" ? Math.min(1.14, Math.max(0.78, parsedState.zoom)) : undefined,
    };
  } catch {
    return {};
  }
}

function writeWorkspaceState(deckId: string, deckSlides: Slide[], state: WorkspaceState) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getWorkspaceStorageKey(deckId),
      JSON.stringify({
        currentSlideId: hasSlide(deckSlides, state.currentSlideId) ? state.currentSlideId : undefined,
        inspectorOpen: typeof state.inspectorOpen === "boolean" ? state.inspectorOpen : undefined,
        railOpen: typeof state.railOpen === "boolean" ? state.railOpen : undefined,
        zoom: typeof state.zoom === "number" ? Math.min(1.14, Math.max(0.78, state.zoom)) : undefined,
      } satisfies WorkspaceState),
    );
  } catch {
    // Storage can fail in private mode or when quota is exhausted.
  }
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
  if (deckId === deckMeta.id) return null;

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
  if (deckId === deckMeta.id) return null;

  const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}`);
  const result = (await response.json()) as ReadDeckResponse;

  if (!result.ok) return null;
  return result.session;
}

function normalizeWheelDelta(delta: number, deltaMode: number) {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * window.innerHeight;

  return delta;
}

function isWheelIgnoredTarget(target: HTMLElement) {
  return Boolean(
    target.closest(
      [
        "a",
        "button",
        "input",
        "select",
        "textarea",
        "[contenteditable='true']",
        "[data-command-menu]",
        "[data-ai-settings-panel]",
        "[data-settings-panel]",
        "[data-slide-notes-scroll]",
      ].join(","),
    ),
  );
}

function getScrollableAncestor(target: HTMLElement, boundary: HTMLElement) {
  let element: HTMLElement | null = target;

  while (element && element !== boundary.parentElement) {
    const canScrollVertically = element.scrollHeight > element.clientHeight + 1;
    const canScrollHorizontally = element.scrollWidth > element.clientWidth + 1;

    if (canScrollVertically || canScrollHorizontally) {
      return element;
    }

    if (element === boundary) break;
    element = element.parentElement;
  }

  return null;
}

function canConsumeWheelScroll(element: HTMLElement, deltaX: number, deltaY: number) {
  const dominantVertical = Math.abs(deltaY) >= Math.abs(deltaX);

  if (dominantVertical && element.scrollHeight > element.clientHeight + 1) {
    if (deltaY > 0) {
      return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
    }

    return element.scrollTop > 1;
  }

  if (!dominantVertical && element.scrollWidth > element.clientWidth + 1) {
    if (deltaX > 0) {
      return element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
    }

    return element.scrollLeft > 1;
  }

  return false;
}

export default function DeckWorkspacePage() {
  const params = useParams<{ deckId?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, t } = usePreferences();
  const deckId = params.deckId || deckMeta.id;
  const routeDeckFileName = useMemo(() => {
    const fileName = searchParams.get("fileName");
    return fileName ? normalizeDeckFileName(fileName, deckMeta.fileName) : null;
  }, [searchParams]);
  const [uploadedDeckSession, setUploadedDeckSession] = useState<UploadedDeckSession | null>(null);
  const [processingSession, setProcessingSession] = useState<ProcessingSession | null>(null);
  const deckFileName = routeDeckFileName ?? uploadedDeckSession?.fileName ?? processingSession?.fileName ?? deckMeta.fileName;
  const effectiveUploadedSession = useMemo(() => {
    return uploadedDeckSession ?? buildFallbackUploadedSession({ deckId, fileName: deckFileName, processingSession });
  }, [deckFileName, deckId, processingSession, uploadedDeckSession]);
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
  const deckTitle = getSessionDeckTitle(deckFileName, deckMeta.fileName, deckMeta.title);
  const [currentSlideId, setCurrentSlideId] = useState<string | undefined>();
  const [zoom, setZoom] = useState(1);
  const [railQuery, setRailQuery] = useState("");
  const [aiSettingsOpen, setAISettingsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [workspaceUploadBusy, setWorkspaceUploadBusy] = useState(false);
  const [workspaceUploadErrorCode, setWorkspaceUploadErrorCode] = useState<UploadDeckErrorCode | null>(null);
  const [sessionRestoreCheckedDeckId, setSessionRestoreCheckedDeckId] = useState(deckId === deckMeta.id ? deckId : "");
  const [restoredWorkspaceKey, setRestoredWorkspaceKey] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const exportReadyTimerRef = useRef<number | null>(null);
  const lastSlideWheelFlipRef = useRef(0);
  const wheelAccumulatorRef = useRef({
    deltaY: 0,
    lastAt: 0,
  });
  const swipeStartRef = useRef<{
    at: number;
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const deckStateKey = useMemo(() => {
    return `${deckId}:${pageCount}:${deckSlides[0]?.id ?? "empty"}:${deckSlides.at(-1)?.id ?? "empty"}`;
  }, [deckId, deckSlides, pageCount]);
  const workspaceSessionHydrating = deckId !== deckMeta.id && sessionRestoreCheckedDeckId !== deckId;
  const workspaceRestored = restoredWorkspaceKey === deckStateKey;

  const currentSlide = useMemo(() => {
    return deckSlides.find((slide) => slide.id === currentSlideId) ?? deckSlides[0];
  }, [currentSlideId, deckSlides]);

  const currentSlideIndex = useMemo(
    () => Math.max(0, deckSlides.findIndex((slide) => slide.id === currentSlide.id)),
    [currentSlide.id, deckSlides],
  );

  useEffect(() => {
    let active = true;

    const restoreTimerId = window.setTimeout(() => {
      if (deckId === deckMeta.id) {
        setUploadedDeckSession(null);
        setProcessingSession(null);
        setSessionRestoreCheckedDeckId(deckId);
        return;
      }

      setSessionRestoreCheckedDeckId("");

      const storedUploadedDeckSession = readUploadedDeckSession(deckId);
      const storedProcessingSession = readProcessingSession(deckId);
      if (active) {
        setUploadedDeckSession(storedUploadedDeckSession);
        setProcessingSession(storedProcessingSession);
        setSessionRestoreCheckedDeckId(deckId);
      }

      fetchUploadedDeckSession(deckId)
        .then((session) => {
          if (!active || !session) return;

          const storedSession = writeUploadedDeckSession(session) ?? session;
          setUploadedDeckSession(storedSession);
        })
        .catch(() => {
          // Missing metadata should not block opening the workspace fallback.
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(restoreTimerId);
    };
  }, [deckId]);

  useEffect(() => {
    document.documentElement.style.setProperty("--deck-accent", currentSlide.accent);
  }, [currentSlide]);

  useEffect(() => {
    if (workspaceSessionHydrating) return;

    upsertRecentDeck({
      contextQuality,
      deckId,
      fileName: deckFileName,
      openedAt: getClientTimestamp(),
      speakerNotesSlideCount: contextStats.speakerNotesSlideCount,
      slideCount: pageCount,
      status: "ready",
      textSlideCount: contextStats.textSlideCount,
    });
  }, [contextQuality, contextStats, deckFileName, deckId, pageCount, workspaceSessionHydrating]);

  useEffect(() => {
    if (!routeDeckFileName) return;

    const nextProcessingSession: ProcessingSession = {
      deckId,
      fileName: routeDeckFileName,
      pageCount,
      startedAt: getClientTimestamp() - completedProcessingStartedAtOffsetMs,
    };

    writeProcessingSession(nextProcessingSession);

    const syncTimerId = window.setTimeout(() => {
      router.replace(`/deck/${deckId}`, { scroll: false });
    }, 0);

    return () => window.clearTimeout(syncTimerId);
  }, [deckId, pageCount, routeDeckFileName, router]);

  useEffect(() => {
    if (workspaceSessionHydrating) return;

    const restoreTimerId = window.setTimeout(() => {
      const restoredState = readWorkspaceState(deckId, deckSlides);

      setCurrentSlideId(restoredState.currentSlideId ?? deckSlides[0]?.id);
      if (typeof restoredState.zoom === "number") setZoom(restoredState.zoom);
      if (typeof restoredState.railOpen === "boolean") setRailOpen(restoredState.railOpen);
      if (typeof restoredState.inspectorOpen === "boolean") setInspectorOpen(restoredState.inspectorOpen);

      setRestoredWorkspaceKey(deckStateKey);
    }, 0);

    return () => window.clearTimeout(restoreTimerId);
  }, [deckId, deckSlides, deckStateKey, workspaceSessionHydrating]);

  useEffect(() => {
    if (!workspaceRestored || workspaceSessionHydrating) return;

    writeWorkspaceState(deckId, deckSlides, {
      currentSlideId: currentSlide.id,
      inspectorOpen,
      railOpen,
      zoom,
    });
  }, [currentSlide.id, deckId, deckSlides, inspectorOpen, railOpen, workspaceRestored, workspaceSessionHydrating, zoom]);

  const selectSlideByIndex = useCallback(
    (index: number) => {
      const nextSlide = deckSlides[index];
      if (nextSlide) {
        setCurrentSlideId(nextSlide.id);
      }
    },
    [deckSlides],
  );

  const handleStageWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (commandOpen || event.ctrlKey || event.metaKey) return;

      const target = event.target as HTMLElement | null;
      if (!target || isWheelIgnoredTarget(target)) return;
      if (!target.closest("[data-slide-flip-zone='true']")) return;

      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode);
      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode);
      if (Math.abs(deltaY) <= Math.max(20, Math.abs(deltaX) * 1.25)) return;

      const scrollableAncestor = getScrollableAncestor(target, event.currentTarget);
      if (scrollableAncestor && canConsumeWheelScroll(scrollableAncestor, deltaX, deltaY)) return;

      const now = Date.now();
      if (now - lastSlideWheelFlipRef.current < slideWheelCooldownMs) {
        event.preventDefault();
        return;
      }

      if (now - wheelAccumulatorRef.current.lastAt > slideWheelResetMs) {
        wheelAccumulatorRef.current.deltaY = 0;
      }

      wheelAccumulatorRef.current.deltaY += deltaY;
      wheelAccumulatorRef.current.lastAt = now;

      if (Math.abs(wheelAccumulatorRef.current.deltaY) < slideWheelThreshold) {
        return;
      }

      event.preventDefault();
      const direction = wheelAccumulatorRef.current.deltaY > 0 ? 1 : -1;
      const nextSlideIndex = Math.min(
        deckSlides.length - 1,
        Math.max(0, currentSlideIndex + direction),
      );

      if (nextSlideIndex !== currentSlideIndex) {
        selectSlideByIndex(nextSlideIndex);
      }

      wheelAccumulatorRef.current.deltaY = 0;
      lastSlideWheelFlipRef.current = now;
    },
    [commandOpen, currentSlideIndex, deckSlides.length, selectSlideByIndex],
  );

  const handleStagePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (commandOpen || zoom > 1.01) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const target = event.target as HTMLElement | null;
      if (!target || isWheelIgnoredTarget(target)) return;
      if (!target.closest("[data-slide-flip-zone='true']")) return;

      swipeStartRef.current = {
        at: Date.now(),
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can fail if the browser has already cancelled the gesture.
      }
    },
    [commandOpen, zoom],
  );

  const handleStagePointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (swipeStartRef.current?.pointerId !== event.pointerId) return;

    swipeStartRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
  }, []);

  const handleStagePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const swipeStart = swipeStartRef.current;
      if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;

      swipeStartRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // The pointer may already be released by the browser.
      }

      const deltaX = event.clientX - swipeStart.x;
      const deltaY = event.clientY - swipeStart.y;
      const elapsedMs = Date.now() - swipeStart.at;
      const horizontalEnough = Math.abs(deltaX) >= slideSwipeThresholdPx;
      const dominantEnough = Math.abs(deltaX) >= Math.abs(deltaY) * slideSwipeDominanceRatio;
      if (!horizontalEnough || !dominantEnough || elapsedMs > slideSwipeMaxDurationMs) return;

      const direction = deltaX < 0 ? 1 : -1;
      const nextSlideIndex = Math.min(
        deckSlides.length - 1,
        Math.max(0, currentSlideIndex + direction),
      );

      if (nextSlideIndex !== currentSlideIndex) {
        event.preventDefault();
        selectSlideByIndex(nextSlideIndex);
      }
    },
    [currentSlideIndex, deckSlides.length, selectSlideByIndex],
  );

  const focusSearch = useCallback((query = "") => {
    setAISettingsOpen(false);
    setSettingsOpen(false);
    setRailOpen(true);
    setRailQuery(query);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        searchInputRef.current?.scrollIntoView({ block: "center" });
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    });
  }, []);

  const openWorkspaceUploadPicker = useCallback(() => {
    if (workspaceUploadBusy) return;

    setWorkspaceUploadErrorCode(null);
    setAISettingsOpen(false);
    setSettingsOpen(false);
    setCommandOpen(false);
    uploadInputRef.current?.click();
  }, [workspaceUploadBusy]);

  const handleWorkspaceUploadFile = useCallback(
    async (file: File) => {
      if (workspaceUploadBusy) return;

      if (!isSupportedDeckFileName(file.name)) {
        setWorkspaceUploadErrorCode("unsupported_type");
        return;
      }

      if (file.size <= 0) {
        setWorkspaceUploadErrorCode("empty_file");
        return;
      }

      if (file.size > maxUploadFileSizeBytes) {
        setWorkspaceUploadErrorCode("file_too_large");
        return;
      }

      setWorkspaceUploadErrorCode(null);
      setWorkspaceUploadBusy(true);
      try {
        const uploadedDeckSession = await uploadDeckFile(file);
        const storedDeckSession = writeUploadedDeckSession(uploadedDeckSession) ?? uploadedDeckSession;
        const uploadedPageCount = Math.max(1, storedDeckSession.pageCount || getDeckSlides(storedDeckSession).length);

        writeProcessingSession({
          deckId: storedDeckSession.deckId,
          fileName: storedDeckSession.fileName,
          pageCount: uploadedPageCount,
          startedAt: storedDeckSession.uploadedAt,
        });

        router.push(
          buildProcessingHref(
            storedDeckSession.deckId,
            storedDeckSession.fileName,
            storedDeckSession.uploadedAt,
            uploadedPageCount,
          ),
        );
      } catch (error) {
        const errorCode = isUploadDeckFileError(error) ? error.errorCode : "upload_failed";
        setWorkspaceUploadErrorCode(errorCode);
      } finally {
        setWorkspaceUploadBusy(false);
      }
    },
    [router, workspaceUploadBusy],
  );

  function handleWorkspaceUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    void handleWorkspaceUploadFile(file);
  }

  const exportDeck = useCallback(() => {
    const markdown = buildDeckMarkdownExport({
      contextStats,
      deckId,
      deckFileName,
      deckSlides,
      deckTitle,
      language,
      pageCount,
      t,
    });
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = getDeckMarkdownFileName(deckFileName, language);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (exportReadyTimerRef.current !== null) {
      window.clearTimeout(exportReadyTimerRef.current);
    }

    setExportReady(true);
    exportReadyTimerRef.current = window.setTimeout(() => {
      setExportReady(false);
      exportReadyTimerRef.current = null;
    }, 1800);
  }, [contextStats, deckFileName, deckId, deckSlides, deckTitle, language, pageCount, t]);

  useEffect(() => {
    return () => {
      if (exportReadyTimerRef.current !== null) {
        window.clearTimeout(exportReadyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.isComposing || event.keyCode === 229) return;

      const isCommandTarget = Boolean(target?.closest("[data-command-menu]"));
      const isEditing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const isControlTarget = Boolean(
        target?.closest("a,button,input,select,textarea,[role='button'],[role='tab'],[contenteditable='true']"),
      );

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAISettingsOpen(false);
        setSettingsOpen(false);
        setCommandOpen((current) => !current);
        return;
      }

      if (isCommandTarget) return;

      if (commandOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setCommandOpen(false);
        }

        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        exportDeck();
        return;
      }

      if (event.key === "Escape") {
        setAISettingsOpen(false);
        setSettingsOpen(false);
        return;
      }

      if (isEditing || isControlTarget) return;

      if (event.key === "/") {
        event.preventDefault();
        focusSearch();
      }

      if (event.key === "Home") {
        event.preventDefault();
        selectSlideByIndex(0);
      }

      if (event.key === "End") {
        event.preventDefault();
        selectSlideByIndex(deckSlides.length - 1);
      }

      if (event.key === " ") {
        event.preventDefault();
        selectSlideByIndex(
          event.shiftKey
            ? Math.max(0, currentSlideIndex - 1)
            : Math.min(deckSlides.length - 1, currentSlideIndex + 1),
        );
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        selectSlideByIndex(Math.max(0, currentSlideIndex - 1));
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        selectSlideByIndex(Math.min(deckSlides.length - 1, currentSlideIndex + 1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandOpen, currentSlideIndex, deckSlides.length, exportDeck, focusSearch, selectSlideByIndex]);

  const workspaceGridClassName = cn(
    "grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-visible transition-[grid-template-columns] duration-200 lg:overflow-hidden",
    railOpen && inspectorOpen && "lg:grid-cols-[238px_minmax(0,1fr)_372px]",
    railOpen && !inspectorOpen && "lg:grid-cols-[238px_minmax(0,1fr)]",
    !railOpen && inspectorOpen && "lg:grid-cols-[minmax(0,1fr)_372px]",
    !railOpen && !inspectorOpen && "lg:grid-cols-[minmax(0,1fr)]",
  );
  const workspaceUploadErrorHint = workspaceUploadErrorCode ? t(uploadErrorMessageKeys[workspaceUploadErrorCode]) : "";

  if (workspaceSessionHydrating) {
    return (
      <div
        aria-busy="true"
        className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground"
      >
        <div className="glass-panel flex w-full max-w-[420px] flex-col items-center rounded-md px-6 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-white/[0.46] text-sm font-bold tracking-normal text-foreground shadow-[0_1px_0_rgba(255,255,255,0.72)_inset] dark:bg-secondary/[0.42]">
            SR
          </div>
          <div className="mt-4 text-sm font-semibold">{t("processing.preparingWorkspace")}</div>
          <div className="mt-2 max-w-[300px] text-xs leading-5 text-muted-foreground">
            {t("home.processingHint")}
          </div>
          <div className="mt-5 h-1.5 w-44 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-3 overflow-y-auto p-3 lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <TopBar
        aiSettingsOpen={aiSettingsOpen}
        contextQuality={contextQuality}
        contextStats={contextStats}
        deckFileName={deckFileName}
        deckTitle={deckTitle}
        exportReady={exportReady}
        inspectorOpen={inspectorOpen}
        onCloseAISettings={() => setAISettingsOpen(false)}
        onCloseSettings={() => setSettingsOpen(false)}
        onExport={exportDeck}
        onOpenCommandMenu={() => {
          setAISettingsOpen(false);
          setSettingsOpen(false);
          setCommandOpen(true);
        }}
        onUploadClick={openWorkspaceUploadPicker}
        onToggleInspector={() => setInspectorOpen((current) => !current)}
        onToggleRail={() => setRailOpen((current) => !current)}
        onToggleAISettings={() => {
          setSettingsOpen(false);
          setAISettingsOpen((current) => !current);
        }}
        onToggleSettings={() => {
          setAISettingsOpen(false);
          setSettingsOpen((current) => !current);
        }}
        pageCount={pageCount}
        railOpen={railOpen}
        settingsOpen={settingsOpen}
        uploadBusy={workspaceUploadBusy}
      />
      <input
        accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        aria-label={t("home.uploadPpt")}
        className="sr-only"
        data-workspace-upload-input="true"
        onChange={handleWorkspaceUploadChange}
        ref={uploadInputRef}
        type="file"
      />
      {workspaceUploadBusy && (
        <div
          aria-live="polite"
          className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-primary/20 bg-primary/[0.07] px-3 py-2 text-sm text-foreground"
          data-workspace-upload-status="true"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="min-w-0">
            <span className="font-semibold">{t("workspace.uploadingDeck")}</span>
            <span className="ml-2 text-muted-foreground">{t("workspace.uploadingDeckHint")}</span>
          </span>
        </div>
      )}
      {workspaceUploadErrorCode && (
        <div
          aria-live="polite"
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-destructive/25 bg-destructive/[0.07] px-3 py-2 text-sm leading-5 text-destructive"
          data-workspace-upload-error="true"
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <span className="min-w-0 break-words">{workspaceUploadErrorHint}</span>
          <button
            aria-label={t("common.close")}
            className="flex h-6 w-6 items-center justify-center rounded-[5px] text-destructive/80 transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setWorkspaceUploadErrorCode(null)}
            title={t("common.close")}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className={workspaceGridClassName}>
        <div
          className="order-1 min-h-0 min-w-0 lg:order-2 lg:h-full"
          data-workspace-stage="true"
          onPointerCancel={handleStagePointerCancel}
          onPointerDown={handleStagePointerDown}
          onPointerUp={handleStagePointerUp}
          onWheel={handleStageWheel}
        >
          <SlideStage
            hasNextSlide={currentSlideIndex < deckSlides.length - 1}
            hasPreviousSlide={currentSlideIndex > 0}
            onNextSlide={() => selectSlideByIndex(Math.min(deckSlides.length - 1, currentSlideIndex + 1))}
            onPreviousSlide={() => selectSlideByIndex(Math.max(0, currentSlideIndex - 1))}
            slide={currentSlide}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        </div>
        <div
          aria-hidden={!inspectorOpen}
          className={cn(
            "order-2 min-h-0 min-w-0 lg:order-3 lg:h-full",
            !inspectorOpen && "hidden",
          )}
          data-workspace-inspector="true"
        >
          <AIInspector key={deckId} deckId={deckId} deckSlides={deckSlides} slide={currentSlide} />
        </div>
        {railOpen && (
          <div className="order-3 min-h-0 min-w-0 lg:order-1 lg:h-full" data-workspace-rail="true">
            <SlideRail
              currentSlide={currentSlide}
              onQueryChange={setRailQuery}
              onSelect={(slide) => setCurrentSlideId(slide.id)}
              query={railQuery}
              searchInputRef={searchInputRef}
              slides={deckSlides}
            />
          </div>
        )}
      </div>
      <WorkspaceCommandMenu
        currentSlide={currentSlide}
        inspectorOpen={inspectorOpen}
        onClose={() => setCommandOpen(false)}
        onExport={exportDeck}
        onFocusRailSearch={focusSearch}
        onSelectSlide={(slide) => setCurrentSlideId(slide.id)}
        onToggleInspector={() => setInspectorOpen((current) => !current)}
        onToggleRail={() => setRailOpen((current) => !current)}
        open={commandOpen}
        railOpen={railOpen}
        slides={deckSlides}
      />
    </div>
  );
}
