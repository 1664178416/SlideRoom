import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Maximize2,
  Minus,
  Plus,
  StickyNote,
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
  slide: Slide;
  zoom: number;
  onZoomChange: (zoom: number) => void;
};

const slideAspectRatio = 16 / 10;
const maxSlideWidth = 1024;
const minZoom = 0.78;
const maxZoom = 1.14;

export function SlideStage({ slide, zoom, onZoomChange }: SlideStageProps) {
  const { language, t } = usePreferences();
  const stageViewportRef = useRef<HTMLDivElement | null>(null);
  const [stageViewportSize, setStageViewportSize] = useState({ width: 0, height: 0 });
  const zoomAtFit = Math.abs(zoom - 1) < 0.005;
  const zoomAtMin = zoom <= minZoom + 0.005;
  const zoomAtMax = zoom >= maxZoom - 0.005;
  const displayTitle = getGeneratedSlideTitle(slide.title, slide.pageNumber, language);
  const speakerNotes = slide.speakerNotes.trim() || t("stage.noSpeakerNotes");
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
  }, [stageViewportSize.height, stageViewportSize.width, zoom]);

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
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/[0.72] px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Badge tone="accent">{formatSlideLabel(slide.pageNumber, language)}</Badge>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{displayTitle}</div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded-[4px] border border-border/70 bg-background/[0.48] px-1.5 py-0.5 leading-none dark:bg-background/[0.14]">
                {t("common.section")}
              </span>
              <span className="truncate">{t(getSlideSectionKey(slide.section))}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border/70 bg-background/[0.44] p-1 dark:bg-background/[0.14]">
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
        <div className="flex h-full min-h-0 w-full items-center justify-center overflow-auto" ref={stageViewportRef}>
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="origin-center"
              data-slide-stage-frame="true"
              exit={{ opacity: 0, scale: 0.985 }}
              initial={{ opacity: 0, scale: 0.985 }}
              key={slide.id}
              style={fittedSlideSize ?? undefined}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <SlideArt slide={slide} className="h-full w-full shadow-stage" />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="shrink-0 border-t border-border/[0.72] bg-background/20 px-3 py-2.5 dark:bg-background/10">
        <div className="flex min-h-[128px] flex-col overflow-hidden rounded-md border border-border/[0.72] bg-white/[0.42] shadow-[0_1px_0_rgba(255,255,255,0.62)_inset] dark:bg-secondary/[0.28] dark:shadow-none">
          <div className="shrink-0 border-b border-border/[0.58] bg-background/[0.28] dark:bg-background/[0.10]">
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-3 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/[0.24] bg-primary/10 text-primary">
                <StickyNote className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
                  <span className="truncate">{t("common.speakerNotes")}</span>
                  <span className="h-1 w-1 rounded-full bg-border" aria-hidden="true" />
                  <span className="truncate">{formatSlideLabel(slide.pageNumber, language)}</span>
                  <span className="h-1 w-1 rounded-full bg-border" aria-hidden="true" />
                  <span className="truncate">{t(getSlideSectionKey(slide.section))}</span>
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{t("stage.pptNote")}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 text-sm leading-6 text-muted-foreground [scrollbar-gutter:stable]">
            <div className="border-l-2 border-primary/[0.24] pl-3">
              <p className="whitespace-pre-wrap break-words text-foreground/78">{speakerNotes}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
