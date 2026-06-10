"use client";

import Image from "next/image";
import { useState } from "react";
import { FileText, ImageOff, StickyNote } from "lucide-react";
import { Slide } from "@/lib/mock-data";
import {
  formatSlideLabel,
  getGeneratedKickerLabel,
  getGeneratedMetricLabel,
  getGeneratedSlideTitle,
  getGeneratedSlideSummary,
  getGeneratedVisualSummary,
  usePreferences,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

const toneClass = {
  teal: "bg-emerald-700 text-white",
  coral: "bg-orange-600 text-white",
  blue: "bg-sky-800 text-white",
  gold: "bg-amber-600 text-white",
} as const;

type SlideArtProps = {
  slide: Slide;
  compact?: boolean;
  className?: string;
  priority?: boolean;
};

export function SlideArt({ slide, compact = false, className, priority = false }: SlideArtProps) {
  const { language, t } = usePreferences();
  const candidateRenderedImageUrl = compact ? slide.thumbnailUrl ?? slide.imageUrl : slide.imageUrl;
  const [failedRenderedImage, setFailedRenderedImage] = useState<{ slideId: string; url: string } | null>(null);
  const renderedImageUrl =
    candidateRenderedImageUrl &&
    !(failedRenderedImage?.slideId === slide.id && failedRenderedImage.url === candidateRenderedImageUrl)
      ? candidateRenderedImageUrl
      : undefined;
  const renderedKicker = getGeneratedKickerLabel(slide.kicker, language);
  const renderedTitle = getGeneratedSlideTitle(slide.title, slide.pageNumber, language);
  const renderedSummary = getGeneratedSlideSummary(slide.summary, slide.pageNumber, language);
  const renderedVisualSummary = getGeneratedVisualSummary(slide.visualSummary, language);
  const displayBullets =
    slide.bullets.length > 0 ? slide.bullets : [renderedSummary || renderedVisualSummary];
  const displayMetrics =
    slide.metrics.length > 0
      ? slide.metrics
      : [
          {
            label: slide.extractedText ? t("slideArt.text") : t("slideArt.context"),
            value: slide.extractedText ? String(Math.min(999, slide.extractedText.trim().length)) : t("slideArt.ready"),
            tone: "teal" as const,
          },
        ];
  const isImportedSlide = slide.section === "imported";
  const renderedAspectRatio = slide.aspectRatio && slide.aspectRatio > 0 ? slide.aspectRatio : 16 / 10;
  const renderedImageWidth = compact ? 480 : 1600;
  const renderedImageHeight = Math.max(1, Math.round(renderedImageWidth / renderedAspectRatio));
  const getRenderedMetricLabel = (label: string) => getGeneratedMetricLabel(label, language);

  if (renderedImageUrl) {
    return (
      <div
        className={cn(
          "relative aspect-[var(--slide-aspect-ratio,1.6)] overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm",
          className,
        )}
        style={{ ["--slide-aspect-ratio" as string]: String(renderedAspectRatio) }}
      >
        <Image
          alt={`${formatSlideLabel(slide.pageNumber, language)} · ${renderedTitle}`}
          className="h-full w-full object-contain"
          draggable={false}
          fetchPriority={priority || !compact ? "high" : "auto"}
          height={renderedImageHeight}
          loading={compact && !priority ? "lazy" : "eager"}
          onError={() => setFailedRenderedImage({ slideId: slide.id, url: renderedImageUrl })}
          preload={!compact}
          sizes={compact ? "238px" : "1024px"}
          src={renderedImageUrl}
          width={renderedImageWidth}
        />
      </div>
    );
  }

  if (isImportedSlide) {
    const textReady = slide.extractedText.trim().length > 0;
    const notesReady = slide.speakerNotes.trim().length > 0;
    const statusItems = [
      { icon: FileText, ready: textReady, label: t("slideArt.text") },
      { icon: StickyNote, ready: notesReady, label: t("slideArt.notes") },
    ];

    return (
      <div
        aria-label={`${formatSlideLabel(slide.pageNumber, language)} · ${t("slideArt.previewUnavailable")}`}
        className={cn(
          "relative aspect-[16/10] overflow-hidden rounded-md border border-dashed border-stone-300 bg-[#fbfaf6] text-stone-950 shadow-sm",
          compact ? "p-2.5" : "p-5 sm:p-6",
          className,
        )}
        style={{ ["--slide-accent" as string]: `hsl(${slide.accent})` }}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-[var(--slide-accent)] opacity-70" />
        <div className={cn("flex h-full min-w-0 flex-col", compact ? "justify-between gap-2" : "justify-center gap-4")}>
          <div
            className={cn(
              "flex min-w-0 items-center justify-between gap-2 font-semibold text-stone-500",
              compact ? "text-[6px]" : "text-[11px]",
            )}
          >
            <span className="truncate">{formatSlideLabel(slide.pageNumber, language)}</span>
            <span
              className={cn(
                "shrink-0 rounded border border-stone-200 bg-white/70 text-stone-500",
                compact ? "px-1 py-0.5 text-[5px]" : "px-2 py-1 text-[10px]",
              )}
            >
              {renderedKicker}
            </span>
          </div>

          <div className={cn("flex min-h-0 flex-1 flex-col items-center justify-center text-center", compact ? "gap-1.5" : "gap-3")}>
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-md border border-stone-200 bg-white/72 text-stone-500",
                compact ? "h-7 w-7" : "h-12 w-12",
              )}
            >
              <ImageOff className={cn(compact ? "h-3.5 w-3.5" : "h-5 w-5")} />
            </span>
            <div className="min-w-0">
              <div className={cn("font-semibold text-stone-900", compact ? "text-[10px]" : "text-base")}>{t("slideArt.previewUnavailable")}</div>
              {!compact && (
                <p className="mx-auto mt-1 max-w-[360px] text-sm leading-6 text-stone-600">
                  {t("slideArt.importedVisualPlaceholder")}
                </p>
              )}
            </div>
          </div>

          <div className={cn("grid grid-cols-2", compact ? "gap-1" : "gap-2")}>
            {statusItems.map((item, index) => {
              const Icon = item.icon;

              return (
                <div
                  className={cn(
                    "flex min-w-0 items-center justify-center gap-1 rounded border font-semibold",
                    compact ? "px-1 py-0.5 text-[5px]" : "px-2 py-1.5 text-xs",
                    item.ready
                      ? "border-stone-300 bg-white/72 text-stone-700"
                      : "border-stone-200 bg-white/35 text-stone-400",
                  )}
                  key={`${item.label}-${index}`}
                >
                  <Icon className={cn("shrink-0", compact ? "h-2 w-2" : "h-3.5 w-3.5")} />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "relative aspect-[16/10] overflow-hidden rounded-md border border-stone-200 bg-[#fbfaf6] text-stone-950 shadow-sm [container-type:inline-size]",
        compact ? "p-2" : "p-4 sm:p-6 xl:p-8",
        className,
      )}
      style={{ ["--slide-accent" as string]: `hsl(${slide.accent})` }}
    >
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[var(--slide-accent)]" />
      <div
        className={cn(
          "grid h-full grid-cols-[1.08fr_0.92fr] gap-3 sm:gap-4 xl:gap-5",
          compact && "gap-2",
        )}
      >
        <div className="flex min-w-0 flex-col justify-between">
          <div className="min-w-0">
            <div
              className={cn(
                "mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-500 sm:mb-3 sm:gap-2 sm:text-[11px] sm:tracking-[0.16em]",
                compact && "mb-1 text-[6px] tracking-normal",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--slide-accent)]" />
              <span className="truncate">{renderedKicker}</span>
            </div>
            <h2
              className={cn(
                "line-clamp-3 max-w-full break-words text-[clamp(1.35rem,7.2cqw,3rem)] font-semibold leading-[1.02] tracking-normal text-stone-950 [text-wrap:balance]",
                compact && "text-[11px] leading-[1.05]",
              )}
            >
              {renderedTitle}
            </h2>
          </div>
          <div className={cn("space-y-1.5 sm:space-y-2", compact && "space-y-1")}>
            {displayBullets.slice(0, 3).map((bullet, index) => (
              <div
                className={cn(
                  "flex items-center gap-1.5 text-[11px] font-medium leading-snug text-stone-700 sm:gap-2 sm:text-sm",
                  compact && "gap-1 text-[6px]",
                )}
                key={`${bullet}-${index}`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
                <span className="line-clamp-2">{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 grid-rows-[auto_1fr] gap-2 sm:gap-3 xl:gap-4">
          <div className={cn("grid grid-cols-2 gap-2 sm:gap-3", compact && "gap-1")}>
            {displayMetrics.slice(0, 2).map((metric, index) => (
              <div
                className={cn(
                  "min-w-0 rounded-md p-2 shadow-sm sm:p-2.5 xl:p-3",
                  toneClass[metric.tone],
                  compact && "rounded-[3px] p-1",
                )}
                key={`${metric.label}-${metric.value}-${index}`}
              >
                <div className={cn("truncate text-[9px] uppercase opacity-75 sm:text-[11px]", compact && "text-[5px]")}>
                  {getRenderedMetricLabel(metric.label)}
                </div>
                <div
                  className={cn(
                    "mt-1 truncate text-[clamp(1rem,4.6cqw,1.75rem)] font-semibold sm:mt-1.5",
                    compact && "mt-0 text-[clamp(0.5rem,5.8cqw,0.75rem)]",
                  )}
                >
                  {metric.value}
                </div>
              </div>
            ))}
          </div>

          <div
            className={cn(
              "flex items-end gap-1.5 rounded-md border border-stone-200 bg-white/[0.78] p-3 sm:gap-2 sm:p-4 xl:gap-3 xl:p-5",
              compact && "gap-1 rounded-[3px] p-1.5",
            )}
          >
            {slide.chart.map((value, index) => (
              <div className="flex h-full flex-1 items-end" key={`${slide.id}-${value}-${index}`}>
                <div
                  className="w-full rounded-t-sm bg-[var(--slide-accent)] opacity-[0.78]"
                  style={{ height: `${value}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
