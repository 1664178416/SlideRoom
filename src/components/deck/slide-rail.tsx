import { CheckCircle2, Images, ListTree, Search, X } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState, type KeyboardEvent, type RefObject } from "react";
import { type Slide } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { SlideArt } from "@/components/deck/slide-art";
import {
  formatSlideLabel,
  getGeneratedKickerLabel,
  getGeneratedMetricLabel,
  getGeneratedSlideTitle,
  getGeneratedSlideSummary,
  getGeneratedVisualSummary,
  getSlideSectionLabel,
  getSlideSectionKey,
  usePreferences,
} from "@/lib/preferences";

type SlideRailProps = {
  currentSlide: Slide;
  onSelect: (slide: Slide) => void;
  query: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  slides: Slide[];
  onQueryChange: (query: string) => void;
};

type RailViewMode = "thumbnails" | "outline";

export function SlideRail({ currentSlide, onSelect, onQueryChange, query, searchInputRef, slides }: SlideRailProps) {
  const { language, t } = usePreferences();
  const [viewMode, setViewMode] = useState<RailViewMode>("thumbnails");
  const hasQuery = query.trim().length > 0;

  const filteredSlides = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return slides;

    return slides.filter((slide) => {
      const paddedPageNumber = String(slide.pageNumber).padStart(2, "0");
      const haystack = [
        String(slide.pageNumber),
        paddedPageNumber,
        formatSlideLabel(slide.pageNumber, language),
        formatSlideLabel(slide.pageNumber, "zh"),
        formatSlideLabel(slide.pageNumber, "en"),
        slide.title,
        getGeneratedSlideTitle(slide.title, slide.pageNumber, language),
        getGeneratedSlideTitle(slide.title, slide.pageNumber, "zh"),
        getGeneratedSlideTitle(slide.title, slide.pageNumber, "en"),
        slide.section,
        `section.${slide.section}`,
        t(getSlideSectionKey(slide.section)),
        getSlideSectionLabel(slide.section, "zh"),
        getSlideSectionLabel(slide.section, "en"),
        slide.kicker,
        getGeneratedKickerLabel(slide.kicker, language),
        getGeneratedKickerLabel(slide.kicker, "zh"),
        getGeneratedKickerLabel(slide.kicker, "en"),
        slide.summary,
        getGeneratedSlideSummary(slide.summary, slide.pageNumber, language),
        getGeneratedSlideSummary(slide.summary, slide.pageNumber, "zh"),
        getGeneratedSlideSummary(slide.summary, slide.pageNumber, "en"),
        slide.extractedText,
        slide.visualSummary,
        getGeneratedVisualSummary(slide.visualSummary, language),
        getGeneratedVisualSummary(slide.visualSummary, "zh"),
        getGeneratedVisualSummary(slide.visualSummary, "en"),
        slide.speakerNotes,
        slide.bullets.join(" "),
        slide.metrics
          .map(
            (metric) =>
              `${metric.label} ${getGeneratedMetricLabel(metric.label, language)} ${getGeneratedMetricLabel(metric.label, "zh")} ${getGeneratedMetricLabel(metric.label, "en")} ${metric.value}`,
          )
          .join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [language, query, slides, t]);

  const outlineGroups = useMemo(() => {
    return filteredSlides.reduce<Array<{ section: Slide["section"]; slides: Slide[] }>>((groups, slide) => {
      const existingGroup = groups.find((group) => group.section === slide.section);

      if (existingGroup) {
        existingGroup.slides.push(slide);
      } else {
        groups.push({
          section: slide.section,
          slides: [slide],
        });
      }

      return groups;
    }, []);
  }, [filteredSlides]);

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Escape") {
      event.preventDefault();

      if (query) {
        onQueryChange("");
      } else {
        event.currentTarget.blur();
      }

      return;
    }

    if (event.key === "Enter" && filteredSlides[0]) {
      event.preventDefault();
      onSelect(filteredSlides[0]);
    }
  }

  return (
    <aside className="glass-panel flex max-h-[720px] min-h-[420px] flex-col overflow-hidden rounded-md p-2 lg:h-full lg:max-h-none lg:min-h-0">
      <div className="flex h-9 items-center justify-between px-2">
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">{t("rail.slides")}</div>
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          {hasQuery
            ? `${filteredSlides.length} ${t("rail.matches")}`
            : viewMode === "outline"
              ? `${outlineGroups.length} ${t("rail.sectionCount")}`
              : `${currentSlide.pageNumber}/${slides.length}`}
        </div>
      </div>

      <div className="mx-1 mb-2 grid grid-cols-2 rounded-md border border-border bg-background/[0.52] p-1 dark:bg-background/[0.14]">
        {[
          ["thumbnails", t("rail.thumbnails"), Images],
          ["outline", t("rail.outline"), ListTree],
        ].map(([value, label, Icon]) => {
          const active = viewMode === value;
          const ModeIcon = Icon as typeof Images;

          return (
            <button
              aria-pressed={active}
              className={cn(
                "flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-[5px] px-2 text-xs font-medium transition",
                active
                  ? "bg-foreground text-background shadow-[0_1px_0_rgba(255,255,255,0.28)_inset]"
                  : "text-muted-foreground hover:bg-white/[0.54] hover:text-foreground dark:hover:bg-secondary/50",
              )}
              key={value as string}
              onClick={() => setViewMode(value as RailViewMode)}
              type="button"
            >
              <ModeIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label as string}</span>
            </button>
          );
        })}
      </div>

      <div className="relative mx-1 mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          aria-label={t("rail.search")}
          className="h-8 w-full rounded-md border border-border bg-background/[0.58] pl-8 pr-8 text-xs outline-none transition placeholder:text-muted-foreground focus:border-primary/[0.58] focus:ring-2 focus:ring-primary/[0.16] dark:bg-secondary/[0.36]"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={t("rail.search")}
          ref={searchInputRef}
          value={query}
        />
        {query && (
          <button
            aria-label={t("common.clearSearch")}
            className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={() => onQueryChange("")}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mt-1 min-h-0 flex-1 overflow-y-auto pr-1">
        {viewMode === "thumbnails" ? (
          <div className="space-y-2">
            {filteredSlides.map((slide, index) => {
              const active = slide.id === currentSlide.id;
              const displayTitle = getGeneratedSlideTitle(slide.title, slide.pageNumber, language);
              const showSectionMeta = slide.section !== "imported";

              return (
                <motion.button
                  aria-current={active ? "true" : undefined}
                  aria-label={
                    showSectionMeta
                      ? `${formatSlideLabel(slide.pageNumber, language)} · ${displayTitle} · ${t("common.section")}: ${t(getSlideSectionKey(slide.section))}`
                      : `${formatSlideLabel(slide.pageNumber, language)} · ${displayTitle}`
                  }
                  className={cn(
                    "group w-full rounded-md border p-1.5 text-left transition",
                    active
                      ? "deck-accent-ring border-transparent bg-white text-foreground dark:bg-secondary/[0.82]"
                      : "border-transparent bg-transparent hover:border-border hover:bg-white/[0.42] dark:hover:bg-secondary/[0.48]",
                  )}
                  data-slide-id={slide.id}
                  key={slide.id}
                  onClick={() => onSelect(slide)}
                  whileTap={{ scale: 0.98 }}
                >
                  <SlideArt slide={slide} compact priority={index < 4} />
                  <div className="mt-2 flex min-w-0 items-center justify-between gap-2 px-0.5">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">
                        {formatSlideLabel(slide.pageNumber, language)} · {displayTitle}
                      </div>
                      {showSectionMeta && (
                        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="shrink-0 rounded-[4px] border border-border/70 bg-background/[0.48] px-1.5 py-0.5 leading-none dark:bg-background/[0.14]">
                            {t("common.section")}
                          </span>
                          <span className="truncate">{t(getSlideSectionKey(slide.section))}</span>
                        </div>
                      )}
                    </div>
                    {active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary/[0.76]" />}
                  </div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {outlineGroups.map((group) => (
              <section
                className="rounded-md border border-border/[0.72] bg-background/[0.34] p-1.5 dark:bg-background/[0.12]"
                key={group.section}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                  <div className="min-w-0">
                    {group.section !== "imported" && (
                      <div className="truncate text-[11px] font-semibold uppercase text-muted-foreground">
                        {t("common.section")}
                      </div>
                    )}
                    <div className="truncate text-xs font-semibold text-foreground">
                      {group.section === "imported" ? t("rail.slides") : t(getSlideSectionKey(group.section))}
                    </div>
                  </div>
                  <span className="rounded-[5px] border border-border bg-background/[0.52] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {group.slides.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.slides.map((slide) => {
                    const active = slide.id === currentSlide.id;
                    const summary = getGeneratedSlideSummary(slide.summary, slide.pageNumber, language);
                    const displayTitle = getGeneratedSlideTitle(slide.title, slide.pageNumber, language);

                    return (
                      <motion.button
                        aria-current={active ? "true" : undefined}
                        aria-label={`${formatSlideLabel(slide.pageNumber, language)} · ${displayTitle}`}
                        className={cn(
                          "group grid w-full grid-cols-[34px_minmax(0,1fr)] items-start gap-2 rounded-[5px] border px-2 py-1.5 text-left transition",
                          active
                            ? "border-primary/[0.34] bg-primary/10 text-foreground"
                            : "border-transparent text-muted-foreground hover:border-border hover:bg-white/[0.42] hover:text-foreground dark:hover:bg-secondary/[0.44]",
                        )}
                        key={slide.id}
                        onClick={() => onSelect(slide)}
                        whileTap={{ scale: 0.99 }}
                      >
                          <span
                            className={cn(
                              "mt-0.5 flex h-6 items-center justify-center rounded-[5px] border text-[10px] font-semibold tabular-nums",
                            active
                              ? "border-primary/[0.24] bg-primary text-primary-foreground"
                              : "border-border bg-background/[0.54]",
                        )}
                      >
                          {String(slide.pageNumber).padStart(2, "0")}
                        </span>
                        <span className="min-w-0">
                          <span className={cn("block truncate text-xs font-semibold", active && "text-foreground")}>
                            {displayTitle}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">
                            {summary}
                          </span>
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {filteredSlides.length === 0 && (
          <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {t("rail.noResults")}
          </div>
        )}
      </div>
    </aside>
  );
}
