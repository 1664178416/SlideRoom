"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Download,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  type LucideIcon,
} from "lucide-react";
import { type Slide } from "@/lib/mock-data";
import { buildSlideSearchText, getImportedSlidePreview } from "@/lib/deck-search";
import { getSlideDisplayHeading } from "@/lib/slide-derived";
import { getSlideSectionKey, usePreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

type WorkspaceCommandMenuProps = {
  currentSlide: Slide;
  inspectorOpen: boolean;
  open: boolean;
  railOpen: boolean;
  slides: Slide[];
  onClose: () => void;
  onExport: () => void;
  onFocusRailSearch: (query: string) => void;
  onSelectSlide: (slide: Slide) => void;
  onToggleInspector: () => void;
  onToggleRail: () => void;
};

type CommandItem = {
  id: string;
  icon: LucideIcon;
  keywords?: string[];
  label: string;
  meta: string;
  run: () => void;
  section: "slides" | "actions";
};
type IndexedCommandSlide = {
  searchText: string;
  slide: Slide;
};

const maxCommandSlides = 7;
const maxImportedCommandPreviewLength = 96;

function matchesQuery(query: string, values: string[]) {
  if (!query) return true;

  const normalizedQuery = query.toLowerCase();
  return values.join(" ").toLowerCase().includes(normalizedQuery);
}

export function WorkspaceCommandMenu({
  open,
  ...dialogProps
}: WorkspaceCommandMenuProps) {
  return (
    <AnimatePresence>
      {open && <WorkspaceCommandMenuDialog {...dialogProps} />}
    </AnimatePresence>
  );
}

function WorkspaceCommandMenuDialog({
  currentSlide,
  inspectorOpen,
  onClose,
  onExport,
  onFocusRailSearch,
  onSelectSlide,
  onToggleInspector,
  onToggleRail,
  railOpen,
  slides,
}: Omit<WorkspaceCommandMenuProps, "open">) {
  const { language, t } = usePreferences();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const indexedSlides = useMemo<IndexedCommandSlide[]>(() => {
    return slides.map((slide) => {
      return {
        slide,
        searchText: buildSlideSearchText(slide, { language, t }),
      };
    });
  }, [language, slides, t]);
  const indexedSlideSearchById = useMemo(() => {
    return new Map(indexedSlides.map((item) => [item.slide.id, item.searchText]));
  }, [indexedSlides]);

  const slideItems = useMemo<CommandItem[]>(() => {
    const normalizedQuery = deferredQuery.trim();
    const normalizedQueryLower = normalizedQuery.toLowerCase();
    const orderedSlides = normalizedQuery
      ? indexedSlides.map(({ slide }) => slide)
      : [
          currentSlide,
          ...slides.filter((slide) => slide.id !== currentSlide.id),
        ];

    return orderedSlides
      .filter((slide) => {
        if (!normalizedQuery) return true;

        return indexedSlideSearchById.get(slide.id)?.includes(normalizedQueryLower) ?? false;
      })
      .slice(0, maxCommandSlides)
      .map((slide) => {
        const importedPreview =
          slide.section === "imported" ? getImportedSlidePreview(slide, maxImportedCommandPreviewLength) : null;
        const slideMeta = importedPreview
          ? `${t(importedPreview.key)}${importedPreview.value ? ` · ${importedPreview.value}` : ""}`
          : t(getSlideSectionKey(slide.section));

        return {
          id: `slide-${slide.id}`,
          icon: FileText,
          label: getSlideDisplayHeading(slide, language),
          meta: slideMeta,
          run: () => {
            onSelectSlide(slide);
            onClose();
          },
          section: "slides",
        };
      });
  }, [currentSlide, deferredQuery, indexedSlideSearchById, indexedSlides, language, onClose, onSelectSlide, slides, t]);

  const actionItems = useMemo<CommandItem[]>(() => {
    const normalizedQuery = deferredQuery.trim();
    const items: CommandItem[] = [
      {
        id: "action-rail-search",
        icon: Search,
        keywords: ["search", "find", "slide rail", "rail", "搜索", "查找", "幻灯片栏"],
        label: t("command.searchRail"),
        meta: normalizedQuery ? `${t("rail.search")} · ${normalizedQuery}` : t("rail.search"),
        run: () => {
          onFocusRailSearch(normalizedQuery);
          onClose();
        },
        section: "actions",
      },
      {
        id: "action-toggle-rail",
        icon: railOpen ? PanelLeftClose : PanelLeftOpen,
        keywords: ["slide rail", "sidebar", "toggle rail", "show rail", "hide rail", "幻灯片栏", "侧边栏", "显示", "隐藏"],
        label: railOpen ? t("workspace.hideSlideRail") : t("workspace.showSlideRail"),
        meta: t("rail.slides"),
        run: () => {
          onToggleRail();
          onClose();
        },
        section: "actions",
      },
      {
        id: "action-toggle-inspector",
        icon: inspectorOpen ? PanelRightClose : PanelRightOpen,
        keywords: ["ai inspector", "inspector", "right panel", "toggle inspector", "AI 面板", "右侧面板", "显示", "隐藏"],
        label: inspectorOpen ? t("workspace.hideInspector") : t("workspace.showInspector"),
        meta: t("ai.inspector"),
        run: () => {
          onToggleInspector();
          onClose();
        },
        section: "actions",
      },
      {
        id: "action-export",
        icon: Download,
        keywords: ["export", "download", "deck context", "reading context", "speaker notes", "manual AI", "markdown", "导出", "下载", "阅读上下文", "整份上下文", "备注", "手动 AI"],
        label: t("command.exportDeck"),
        meta: t("command.exportDeckMeta"),
        run: () => {
          onExport();
          onClose();
        },
        section: "actions",
      },
    ];

    return items.filter((item) => {
      if (item.id === "action-rail-search" && normalizedQuery) return true;
      return matchesQuery(normalizedQuery, [item.id, item.label, item.meta, ...(item.keywords ?? [])]);
    });
  }, [deferredQuery, inspectorOpen, onClose, onExport, onFocusRailSearch, onToggleInspector, onToggleRail, railOpen, t]);

  const commandItems = useMemo(() => [...slideItems, ...actionItems], [actionItems, slideItems]);
  const resolvedActiveItem = commandItems.find((item) => item.id === activeItemId) ?? commandItems[0];
  const activeIndex = Math.max(
    0,
    commandItems.findIndex((item) => item.id === resolvedActiveItem?.id),
  );

  useEffect(() => {
    const focusTimerId = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(focusTimerId);
  }, []);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (commandItems.length === 0) return;

      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (activeIndex + direction + commandItems.length) % commandItems.length;
      setActiveItemId(commandItems[nextIndex]?.id ?? null);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      resolvedActiveItem?.run();
    }
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[80] flex items-start justify-center bg-background/58 px-3 pt-[11vh] backdrop-blur-sm"
      data-command-menu-backdrop="true"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={onClose}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        aria-modal="true"
        aria-label={t("command.title")}
        className="w-full max-w-[640px] overflow-hidden rounded-md border border-border bg-background shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:bg-secondary"
        data-command-menu="true"
        exit={{ opacity: 0, scale: 0.985, y: -6 }}
        initial={{ opacity: 0, scale: 0.985, y: -6 }}
        onKeyDown={handleMenuKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b border-border/[0.72] px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            aria-activedescendant={resolvedActiveItem ? `command-item-${resolvedActiveItem.id}` : undefined}
            aria-controls="workspace-command-results"
            aria-label={t("command.placeholder")}
            className="h-8 min-w-0 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            data-command-menu-input="true"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("command.placeholder")}
            ref={inputRef}
            value={query}
          />
        </div>

        <div className="max-h-[min(62vh,520px)] overflow-y-auto p-2" id="workspace-command-results">
          {slideItems.length > 0 && (
            <CommandSection
              activeItemId={resolvedActiveItem?.id}
              items={slideItems}
              onActiveItemChange={setActiveItemId}
              title={t("command.slides")}
            />
          )}
          {actionItems.length > 0 && (
            <CommandSection
              activeItemId={resolvedActiveItem?.id}
              items={actionItems}
              onActiveItemChange={setActiveItemId}
              title={t("command.actions")}
            />
          )}
          {commandItems.length === 0 && (
            <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
              {t("command.empty")}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function CommandSection({
  activeItemId,
  items,
  onActiveItemChange,
  title,
}: {
  activeItemId?: string;
  items: CommandItem[];
  onActiveItemChange: (itemId: string) => void;
  title: string;
}) {
  return (
    <section className="mb-2 last:mb-0">
      <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{title}</div>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeItemId;

          return (
            <button
              className={cn(
                "grid w-full grid-cols-[30px_minmax(0,1fr)] items-center gap-2 rounded-[5px] border px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary/[0.28] bg-primary/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-white/[0.44] hover:text-foreground dark:hover:bg-background/[0.14]",
              )}
              data-command-item={item.id}
              id={`command-item-${item.id}`}
              key={item.id}
              onClick={item.run}
              onFocus={() => onActiveItemChange(item.id)}
              onMouseEnter={() => onActiveItemChange(item.id)}
              type="button"
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-[5px] border",
                  active
                    ? "border-primary/[0.24] bg-primary text-primary-foreground"
                    : "border-border bg-background/[0.54] dark:bg-background/[0.14]",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate text-sm font-semibold", active && "text-foreground")}>
                  {item.label}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{item.meta}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
