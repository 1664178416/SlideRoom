"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  type ReadDeckResponse,
  type UploadedDeckSession,
} from "@/lib/upload-contract";
import { usePreferences } from "@/lib/preferences";
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

function getClientTimestamp() {
  return Date.now();
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [restoredWorkspaceKey, setRestoredWorkspaceKey] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const exportReadyTimerRef = useRef<number | null>(null);
  const lastSlideWheelFlipRef = useRef(0);
  const wheelAccumulatorRef = useRef({
    deltaY: 0,
    lastAt: 0,
  });
  const deckStateKey = useMemo(() => {
    return `${deckId}:${pageCount}:${deckSlides[0]?.id ?? "empty"}:${deckSlides.at(-1)?.id ?? "empty"}`;
  }, [deckId, deckSlides, pageCount]);
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
      const storedUploadedDeckSession = readUploadedDeckSession(deckId);
      if (active) setUploadedDeckSession(storedUploadedDeckSession);
      setProcessingSession(readProcessingSession(deckId));

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
  }, [contextQuality, contextStats, deckFileName, deckId, pageCount]);

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
    const restoreTimerId = window.setTimeout(() => {
      const restoredState = readWorkspaceState(deckId, deckSlides);

      setCurrentSlideId(restoredState.currentSlideId ?? deckSlides[0]?.id);
      if (typeof restoredState.zoom === "number") setZoom(restoredState.zoom);
      if (typeof restoredState.railOpen === "boolean") setRailOpen(restoredState.railOpen);
      if (typeof restoredState.inspectorOpen === "boolean") setInspectorOpen(restoredState.inspectorOpen);

      setRestoredWorkspaceKey(deckStateKey);
    }, 0);

    return () => window.clearTimeout(restoreTimerId);
  }, [deckId, deckSlides, deckStateKey]);

  useEffect(() => {
    if (!workspaceRestored) return;

    writeWorkspaceState(deckId, deckSlides, {
      currentSlideId: currentSlide.id,
      inspectorOpen,
      railOpen,
      zoom,
    });
  }, [currentSlide.id, deckId, deckSlides, inspectorOpen, railOpen, workspaceRestored, zoom]);

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

  const focusSearch = useCallback((query = "") => {
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

  const exportDeck = useCallback(() => {
    const markdown = buildDeckMarkdownExport({
      contextQuality,
      contextStats,
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
  }, [contextQuality, contextStats, deckFileName, deckSlides, deckTitle, language, pageCount, t]);

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
        setSettingsOpen(false);
        return;
      }

      if (isEditing || isControlTarget) return;

      if (event.key === "/") {
        event.preventDefault();
        focusSearch();
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        selectSlideByIndex(Math.max(0, currentSlideIndex - 1));
      }

      if (event.key === "ArrowRight") {
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

  return (
    <div className="flex min-h-screen flex-col gap-3 overflow-y-auto p-3 lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <TopBar
        contextQuality={contextQuality}
        contextStats={contextStats}
        deckFileName={deckFileName}
        deckTitle={deckTitle}
        exportReady={exportReady}
        inspectorOpen={inspectorOpen}
        onCloseSettings={() => setSettingsOpen(false)}
        onExport={exportDeck}
        onOpenCommandMenu={() => {
          setSettingsOpen(false);
          setCommandOpen(true);
        }}
        onToggleInspector={() => setInspectorOpen((current) => !current)}
        onToggleRail={() => setRailOpen((current) => !current)}
        onToggleSettings={() => setSettingsOpen((current) => !current)}
        pageCount={pageCount}
        railOpen={railOpen}
        settingsOpen={settingsOpen}
      />
      <div className={workspaceGridClassName}>
        <div
          className="order-1 min-h-0 min-w-0 lg:order-2 lg:h-full"
          data-workspace-stage="true"
          onWheel={handleStageWheel}
        >
          <SlideStage slide={currentSlide} zoom={zoom} onZoomChange={setZoom} />
        </div>
        {inspectorOpen && (
          <div className="order-2 min-h-0 min-w-0 lg:order-3 lg:h-full" data-workspace-inspector="true">
            <AIInspector deckSlides={deckSlides} slide={currentSlide} />
          </div>
        )}
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
