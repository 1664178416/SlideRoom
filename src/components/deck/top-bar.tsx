"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle2,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Settings,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PreferencesControls } from "@/components/preferences-controls";
import { contextQualityLabelKeys, getContextQualityTone } from "@/lib/context-quality";
import { usePreferences } from "@/lib/preferences";
import type { DeckContextQuality, SlideContextStats } from "@/lib/upload-contract";

type TopBarProps = {
  contextQuality: DeckContextQuality;
  contextStats: SlideContextStats;
  deckFileName: string;
  deckTitle: string;
  exportReady: boolean;
  inspectorOpen: boolean;
  pageCount: number;
  railOpen: boolean;
  settingsOpen: boolean;
  onExport: () => void;
  onCloseSettings: () => void;
  onOpenCommandMenu: () => void;
  onToggleInspector: () => void;
  onToggleRail: () => void;
  onToggleSettings: () => void;
};

function getCommandShortcutLabel() {
  if (typeof window === "undefined") return "Ctrl K";

  const platformText = `${window.navigator.platform} ${window.navigator.userAgent}`.toLowerCase();
  return /mac|iphone|ipad|ipod/.test(platformText) ? "⌘K" : "Ctrl K";
}

function subscribeCommandShortcut() {
  return () => {};
}

export function TopBar({
  contextQuality,
  contextStats,
  deckFileName,
  deckTitle,
  exportReady,
  inspectorOpen,
  onCloseSettings,
  onExport,
  onOpenCommandMenu,
  onToggleInspector,
  onToggleRail,
  onToggleSettings,
  pageCount,
  railOpen,
  settingsOpen,
}: TopBarProps) {
  const { t } = usePreferences();
  const controlsRef = useRef<HTMLDivElement>(null);
  const commandShortcutLabel = useSyncExternalStore(
    subscribeCommandShortcut,
    getCommandShortcutLabel,
    () => "Ctrl K",
  );
  const RailIcon = railOpen ? PanelLeftClose : PanelLeftOpen;
  const InspectorIcon = inspectorOpen ? PanelRightClose : PanelRightOpen;
  const ExportIcon = exportReady ? CheckCircle2 : Download;
  const railLabel = railOpen ? t("workspace.hideSlideRail") : t("workspace.showSlideRail");
  const inspectorLabel = inspectorOpen ? t("workspace.hideInspector") : t("workspace.showInspector");
  const exportLabel = exportReady ? t("workspace.exported") : t("common.export");

  useEffect(() => {
    if (!settingsOpen) return;

    function handleDocumentClick(event: MouseEvent) {
      const eventPath = event.composedPath();
      const clickedInsideControls = controlsRef.current
        ? eventPath.includes(controlsRef.current)
        : false;

      if (!clickedInsideControls) {
        onCloseSettings();
      }
    }

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [onCloseSettings, settingsOpen]);

  return (
    <header className="glass-panel relative z-40 flex h-14 shrink-0 items-center justify-between rounded-md px-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-background">
          SR
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{deckTitle}</div>
          <div className="hidden truncate text-xs text-muted-foreground sm:block">{deckFileName}</div>
        </div>
        <Badge tone="success" className="hidden sm:inline-flex">
          {pageCount} {t("common.slides")}
        </Badge>
        <Badge tone={getContextQualityTone(contextQuality)} className="hidden lg:inline-flex">
          {t(contextQualityLabelKeys[contextQuality])}
        </Badge>
      </div>

      <div
        className="flex items-center gap-1.5"
        onClick={(event) => event.stopPropagation()}
        ref={controlsRef}
      >
        <div className="flex items-center gap-1 rounded-md border border-border bg-background/[0.44] p-1 dark:bg-background/[0.14]">
          <Button
            aria-label={railLabel}
            aria-pressed={railOpen}
            data-workspace-toggle-rail="true"
            onClick={onToggleRail}
            size="icon"
            title={railLabel}
            type="button"
            variant={railOpen ? "secondary" : "ghost"}
          >
            <RailIcon className="h-4 w-4" />
          </Button>
          <Button
            aria-label={inspectorLabel}
            aria-pressed={inspectorOpen}
            data-workspace-toggle-inspector="true"
            onClick={onToggleInspector}
            size="icon"
            title={inspectorLabel}
            type="button"
            variant={inspectorOpen ? "secondary" : "ghost"}
          >
            <InspectorIcon className="h-4 w-4" />
          </Button>
        </div>
        <Button
          aria-label={t("command.title")}
          data-workspace-search="true"
          onClick={onOpenCommandMenu}
          size="sm"
          title={`${t("command.title")} (${commandShortcutLabel})`}
          type="button"
          variant="ghost"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">{t("common.search")}</span>
          <kbd
            aria-hidden="true"
            className="ml-1 hidden rounded-[4px] border border-border bg-background/[0.52] px-1 py-0.5 text-[10px] font-semibold text-muted-foreground dark:bg-background/[0.14] md:inline"
          >
            {commandShortcutLabel}
          </kbd>
        </Button>
        <PreferencesControls className="hidden rounded-md border border-border bg-background/[0.44] p-1 dark:bg-background/[0.14] xl:flex" />
        <Button
          aria-label={exportLabel}
          data-workspace-export="true"
          onClick={onExport}
          size="sm"
          title={exportLabel}
          type="button"
          variant={exportReady ? "secondary" : "ghost"}
        >
          <ExportIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{exportLabel}</span>
        </Button>
        <Button
          aria-controls={settingsOpen ? "workspace-settings-panel" : undefined}
          aria-expanded={settingsOpen}
          aria-haspopup="dialog"
          aria-label={t("common.settings")}
          data-workspace-settings="true"
          onClick={onToggleSettings}
          size="icon"
          title={t("common.settings")}
          type="button"
          variant={settingsOpen ? "secondary" : "ghost"}
        >
          <Settings className="h-4 w-4" />
        </Button>

        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              animate={{ opacity: 1, y: 0, scale: 1 }}
              aria-label={t("common.settings")}
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-[calc(100vh-5rem)] w-full overflow-y-auto rounded-md border border-border bg-background shadow-[0_22px_60px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:bg-secondary sm:right-3 sm:w-[min(300px,calc(100vw-1.5rem))]"
              data-settings-panel="true"
              exit={{ opacity: 0, y: -4, scale: 0.985 }}
              id="workspace-settings-panel"
              initial={{ opacity: 0, y: -4, scale: 0.985 }}
              role="dialog"
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border/[0.72] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                    {t("common.settings")}
                  </div>
                  <div className="truncate text-sm font-semibold">{deckTitle}</div>
                </div>
                <Button
                  aria-label={t("common.close")}
                  onClick={onCloseSettings}
                  size="icon"
                  title={t("common.close")}
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2.5 p-3">
                <div className="rounded-md border border-border bg-background/[0.54] px-3 py-2 dark:bg-background/[0.14]">
                  <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
                    {t("workspace.appearance")}
                  </div>
                  <PreferencesControls compact={false} className="justify-between" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border bg-background/[0.54] px-3 py-2 dark:bg-background/[0.14]">
                    <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                      {t("common.totalSlides")}
                    </div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">{pageCount}</div>
                  </div>
                  <div className="rounded-md border border-border bg-background/[0.54] px-3 py-2 dark:bg-background/[0.14]">
                    <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                      {t("workspace.deckStatus")}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold">{t("workspace.readyForQuestions")}</div>
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background/[0.54] px-3 py-2 dark:bg-background/[0.14]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                      {t("workspace.contextQuality")}
                    </div>
                    <Badge tone={getContextQualityTone(contextQuality)}>
                      {t(contextQualityLabelKeys[contextQuality])}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[5px] border border-border/70 bg-background/[0.42] px-2 py-1.5 dark:bg-background/[0.12]">
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t("common.textSlides")}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums">
                        {contextStats.textSlideCount}/{pageCount}
                      </div>
                    </div>
                    <div className="rounded-[5px] border border-border/70 bg-background/[0.42] px-2 py-1.5 dark:bg-background/[0.12]">
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t("common.noteSlides")}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums">
                        {contextStats.speakerNotesSlideCount}/{pageCount}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
