"use client";

import Image from "next/image";
import { useState } from "react";
import { FileText, StickyNote } from "lucide-react";
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
  const isImportedCompact = compact && slide.section === "imported";
  const getRenderedMetricLabel = (label: string) => getGeneratedMetricLabel(label, language);

  if (renderedImageUrl) {
    return (
      <div
        className={cn(
          "relative aspect-[var(--slide-aspect-ratio,1.6)] overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm",
          className,
        )}
        style={{ ["--slide-aspect-ratio" as string]: String(slide.aspectRatio ?? 16 / 10) }}
      >
        <Image
          alt={`${formatSlideLabel(slide.pageNumber, language)} · ${renderedTitle}`}
          className="h-full w-full object-contain"
          draggable={false}
          fill
          loading={compact && !priority ? "lazy" : "eager"}
          onError={() => setFailedRenderedImage({ slideId: slide.id, url: renderedImageUrl })}
          preload={!compact}
          sizes={compact ? "238px" : "1024px"}
          src={renderedImageUrl}
        />
      </div>
    );
  }

  if (isImportedCompact) {
    const textReady = slide.extractedText.trim().length > 0;
    const notesReady = slide.speakerNotes.trim().length > 0;
    const previewLines = displayBullets.filter(Boolean).slice(0, 2);

    return (
      <div
        className={cn(
          "relative aspect-[16/10] overflow-hidden rounded-md border border-stone-200 bg-[#fbfaf6] p-2.5 text-stone-950 shadow-sm",
          className,
        )}
        style={{ ["--slide-accent" as string]: `hsl(${slide.accent})` }}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-[var(--slide-accent)]" />
        <div className="flex h-full min-w-0 flex-col justify-between gap-1.5">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[6px] font-semibold uppercase text-stone-500">
              <span className="truncate">{formatSlideLabel(slide.pageNumber, language)}</span>
              <span className="rounded-[3px] border border-stone-200 bg-white/70 px-1 py-0.5 text-[5px] text-stone-500">
                PPT
              </span>
            </div>
            <h2 className="line-clamp-2 text-[12px] font-semibold leading-[1.08] tracking-normal text-stone-950">
              {renderedTitle}
            </h2>
          </div>

          <div className="space-y-1">
            {previewLines.length > 0 ? (
              previewLines.map((line, index) => (
                <div
                  className="grid min-w-0 grid-cols-[6px_minmax(0,1fr)] items-start gap-1 text-[6px] font-medium leading-[1.25] text-stone-600"
                  key={`${line}-${index}`}
                >
                  <span className="mt-1 h-1 w-1 rounded-full bg-[var(--slide-accent)] opacity-75" />
                  <span className="line-clamp-2">{line}</span>
                </div>
              ))
            ) : (
              <div className="h-5 rounded-[3px] border border-dashed border-stone-300 bg-white/45" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-1">
            {[
              { icon: FileText, ready: textReady, label: t("slideArt.text") },
              { icon: StickyNote, ready: notesReady, label: t("slideArt.notes") },
            ].map((item, index) => {
              const Icon = item.icon;

              return (
                <div
                  className={cn(
                    "flex min-w-0 items-center gap-1 rounded-[3px] border px-1 py-0.5 text-[5px] font-semibold",
                    item.ready
                      ? "border-stone-300 bg-white/70 text-stone-700"
                      : "border-stone-200 bg-white/35 text-stone-400",
                  )}
                  key={`${item.label}-${index}`}
                >
                  <Icon className="h-2 w-2 shrink-0" />
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
