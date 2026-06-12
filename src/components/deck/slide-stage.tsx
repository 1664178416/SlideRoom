import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minus,
  Plus,
} from "lucide-react";
import { Slide } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlideArt } from "@/components/deck/slide-art";
import {
  formatSlideLabel,
  getGeneratedSlideTitle,
  getSlideSectionKey,
  usePreferences,
} from "@/lib/preferences";

type SlideStageProps = {
  hasNextSlide: boolean;
  hasPreviousSlide: boolean;
  onNextSlide: () => void;
  onPreviousSlide: () => void;
  slide: Slide;
  zoom: number;
  onZoomChange: (zoom: number) => void;
};

const maxSlideWidth = 1024;
const minZoom = 0.78;
const maxZoom = 1.14;

export function SlideStage({
  hasNextSlide,
  hasPreviousSlide,
  onNextSlide,
  onPreviousSlide,
  slide,
  zoom,
  onZoomChange,
}: SlideStageProps) {
  const { language, t } = usePreferences();
  const stageViewportRef = useRef<HTMLDivElement | null>(null);
  const [stageViewportSize, setStageViewportSize] = useState({ width: 0, height: 0 });
  const zoomAtFit = Math.abs(zoom - 1) < 0.005;
  const zoomAtMin = zoom <= minZoom + 0.005;
  const zoomAtMax = zoom >= maxZoom - 0.005;
  const displayTitle = getGeneratedSlideTitle(slide.title, slide.pageNumber, language);
  const speakerNotes = slide.speakerNotes.trim();
  const hasSpeakerNotes = speakerNotes.length > 0;
  const showSectionMeta = slide.section !== "imported";
  const slideAspectRatio = slide.aspectRatio && slide.aspectRatio > 0 ? slide.aspectRatio : 16 / 10;
  const fittedSlideSize = useMemo(() => {
    if (stageViewportSize.width <= 0 || stageViewportSize.height <= 0) {
      return null;
    }

    const baseWidth = Math.min(
      stageViewportSize.width,
      stageViewportSize.height * slideAspectRatio,
      maxSlideWidth,
    );
    const width = baseWidth * zoom;

    return {
      width,
      height: width / slideAspectRatio,
    };
  }, [slideAspectRatio, stageViewportSize.height, stageViewportSize.width, zoom]);
  const slideFrameStyle = fittedSlideSize ?? {
    aspectRatio: slideAspectRatio,
    maxWidth: maxSlideWidth,
    width: "100%",
  };

  useEffect(() => {
    const viewport = stageViewportRef.current;
    if (!viewport) return;

    function updateViewportSize() {
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      setStageViewportSize({
        width: rect.width,
        height: rect.height,
      });
    }

    updateViewportSize();

    const resizeObserver = new ResizeObserver(updateViewportSize);
    resizeObserver.observe(viewport);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <main className="glass-panel flex min-h-[560px] flex-col rounded-md sm:min-h-[640px] lg:h-full lg:min-h-0">
      <div className="flex min-h-14 shrink-0 flex-col items-stretch justify-center gap-2 border-b border-border/[0.72] px-3 py-2 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <Badge tone="accent">{formatSlideLabel(slide.pageNumber, language)}</Badge>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{displayTitle}</div>
            {showSectionMeta && (
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded-[4px] border border-border/70 bg-background/[0.48] px-1.5 py-0.5 leading-none dark:bg-background/[0.14]">
                  {t("common.section")}
                </span>
                <span className="truncate">{t(getSlideSectionKey(slide.section))}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full shrink-0 items-center justify-end gap-1 rounded-md border border-border/70 bg-background/[0.44] p-1 dark:bg-background/[0.14] sm:w-auto">
          <Button
            aria-label={t("stage.previousSlide")}
            disabled={!hasPreviousSlide}
            onClick={onPreviousSlide}
            size="icon"
            title={t("stage.previousSlide")}
            variant="ghost"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            aria-label={t("stage.nextSlide")}
            disabled={!hasNextSlide}
            onClick={onNextSlide}
            size="icon"
            title={t("stage.nextSlide")}
            variant="ghost"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="mx-0.5 h-4 w-px bg-border/70" aria-hidden="true" />
          <Button aria-label={t("stage.zoomOut")} disabled={zoomAtMin} variant="ghost" size="icon" title={t("stage.zoomOut")} onClick={() => onZoomChange(Math.max(minZoom, zoom - 0.08))}>
            <Minus className="h-4 w-4" />
          </Button>
          <div className="w-12 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </div>
          <Button aria-label={t("stage.zoomIn")} disabled={zoomAtMax} variant="ghost" size="icon" title={t("stage.zoomIn")} onClick={() => onZoomChange(Math.min(maxZoom, zoom + 0.08))}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button aria-label={t("stage.fit")} aria-pressed={zoomAtFit} disabled={zoomAtFit} variant="ghost" size="icon" title={t("stage.fit")} onClick={() => onZoomChange(1)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-8">
        <div
          className="flex h-full min-h-0 w-full touch-pan-y items-center justify-center overflow-auto"
          data-slide-flip-zone="true"
          data-slide-stage-viewport="true"
          ref={stageViewportRef}
        >
          <div
            className="origin-center"
            data-slide-stage-frame="true"
            key={slide.id}
            style={slideFrameStyle}
          >
            <SlideArt slide={slide} className="w-full shadow-stage" priority />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border/[0.72] bg-background/20 px-3 py-2 dark:bg-background/10">
        {hasSpeakerNotes ? (
          <div className="overflow-hidden rounded-md border border-border/[0.72] bg-white/[0.38] shadow-[0_1px_0_rgba(255,255,255,0.58)_inset] dark:bg-secondary/[0.24] dark:shadow-none">
            <div
              className="max-h-[148px] min-h-[76px] overflow-y-auto px-3.5 py-2.5 text-sm leading-6 [scrollbar-gutter:stable]"
              data-slide-notes-scroll="true"
            >
              <p className="whitespace-pre-wrap break-words text-foreground/78">{speakerNotes}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border/[0.62] bg-white/[0.20] px-3 py-1.5 text-xs text-muted-foreground dark:bg-secondary/[0.12]">
            {t("stage.noSpeakerNotes")}
          </div>
        )}
      </div>
    </main>
  );
}
