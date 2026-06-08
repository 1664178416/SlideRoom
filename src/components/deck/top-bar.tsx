"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bot,
  CheckCircle2,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PreferencesControls } from "@/components/preferences-controls";
import {
  defaultAIProviderConfig,
  clearAIProviderConfig,
  readAIProviderConfig,
  writeAIProviderConfig,
  type AIProviderConfig,
  type TokenPolicyMode,
} from "@/lib/ai-provider-config";
import { contextQualityLabelKeys, getContextQualityTone } from "@/lib/context-quality";
import { type TranslationKey, usePreferences } from "@/lib/preferences";
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

const tokenPolicyOptions: Array<{
  descriptionKey: TranslationKey;
  labelKey: TranslationKey;
  value: TokenPolicyMode;
}> = [
  {
    descriptionKey: "settings.policyOnDemandHint",
    labelKey: "settings.policyOnDemand",
    value: "on-demand",
  },
  {
    descriptionKey: "settings.policyWarmCurrentHint",
    labelKey: "settings.policyWarmCurrent",
    value: "warm-current",
  },
  {
    descriptionKey: "settings.policyFullDeckHint",
    labelKey: "settings.policyFullDeck",
    value: "full-deck",
  },
];

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
  const saveFeedbackTimerRef = useRef<number | null>(null);
  const [aiProviderConfig, setAIProviderConfig] = useState<AIProviderConfig>(defaultAIProviderConfig);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [saveFeedbackVisible, setSaveFeedbackVisible] = useState(false);
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
  const aiConfigured = aiProviderConfig.apiKey.length > 0 && aiProviderConfig.baseUrl.length > 0;

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

  useEffect(() => {
    const restoreTimerId = window.setTimeout(() => {
      setAIProviderConfig(readAIProviderConfig());
    }, 0);

    return () => {
      window.clearTimeout(restoreTimerId);
      if (saveFeedbackTimerRef.current !== null) {
        window.clearTimeout(saveFeedbackTimerRef.current);
      }
    };
  }, []);

  function updateAIProviderConfig<K extends keyof AIProviderConfig>(
    key: K,
    value: AIProviderConfig[K],
  ) {
    setSaveFeedbackVisible(false);
    setAIProviderConfig((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveAISettings() {
    const savedConfig = writeAIProviderConfig(aiProviderConfig);

    setAIProviderConfig(savedConfig);
    setSaveFeedbackVisible(true);
    if (saveFeedbackTimerRef.current !== null) {
      window.clearTimeout(saveFeedbackTimerRef.current);
    }

    saveFeedbackTimerRef.current = window.setTimeout(() => {
      setSaveFeedbackVisible(false);
      saveFeedbackTimerRef.current = null;
    }, 1600);
  }

  function clearAISettings() {
    const clearedConfig = clearAIProviderConfig();

    setAIProviderConfig(clearedConfig);
    setApiKeyVisible(false);
    setSaveFeedbackVisible(true);
    if (saveFeedbackTimerRef.current !== null) {
      window.clearTimeout(saveFeedbackTimerRef.current);
    }

    saveFeedbackTimerRef.current = window.setTimeout(() => {
      setSaveFeedbackVisible(false);
      saveFeedbackTimerRef.current = null;
    }, 1600);
  }

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
          aria-label={t("settings.aiProvider")}
          data-ai-provider-settings="true"
          onClick={onToggleSettings}
          size="sm"
          title={t("settings.aiProvider")}
          type="button"
          variant={settingsOpen ? "secondary" : "ghost"}
        >
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">{t("settings.aiShort")}</span>
          <span
            aria-hidden="true"
            className={[
              "h-1.5 w-1.5 rounded-full",
              aiConfigured ? "bg-primary" : "bg-muted-foreground/50",
            ].join(" ")}
          />
        </Button>
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
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-[calc(100vh-5rem)] w-full overflow-y-auto rounded-md border border-border bg-background shadow-[0_22px_60px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:bg-secondary sm:right-3 sm:w-[min(430px,calc(100vw-1.5rem))]"
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
                <div className="rounded-md border border-border bg-background/[0.54] p-3 dark:bg-background/[0.14]">
                  <div className="mb-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-muted-foreground">
                        <KeyRound className="h-3.5 w-3.5" />
                        {t("settings.aiProvider")}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("settings.aiProviderHint")}
                      </p>
                    </div>
                    <Badge tone={aiConfigured ? "success" : "neutral"}>
                      {aiConfigured ? t("settings.configured") : t("settings.notConfigured")}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-muted-foreground">
                        {t("settings.apiKey")}
                      </span>
                      <span className="grid grid-cols-[minmax(0,1fr)_32px] overflow-hidden rounded-md border border-border bg-white/[0.42] dark:bg-background/[0.12]">
                        <input
                          autoComplete="off"
                          className="h-9 min-w-0 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground/70"
                          onChange={(event) => updateAIProviderConfig("apiKey", event.target.value)}
                          placeholder={t("settings.apiKeyPlaceholder")}
                          spellCheck={false}
                          type={apiKeyVisible ? "text" : "password"}
                          value={aiProviderConfig.apiKey}
                        />
                        <button
                          aria-label={apiKeyVisible ? t("settings.hideKey") : t("settings.showKey")}
                          className="flex h-9 w-8 items-center justify-center border-l border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setApiKeyVisible((current) => !current)}
                          title={apiKeyVisible ? t("settings.hideKey") : t("settings.showKey")}
                          type="button"
                        >
                          {apiKeyVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </span>
                    </label>

                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
                      <label className="block">
                        <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
                          <Link2 className="h-3.5 w-3.5" />
                          {t("settings.baseUrl")}
                        </span>
                        <input
                          className="h-9 w-full rounded-md border border-border bg-white/[0.42] px-2.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/[0.42] focus:ring-2 focus:ring-primary/[0.12] dark:bg-background/[0.12]"
                          onChange={(event) => updateAIProviderConfig("baseUrl", event.target.value)}
                          placeholder={t("settings.baseUrlPlaceholder")}
                          spellCheck={false}
                          type="url"
                          value={aiProviderConfig.baseUrl}
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase text-muted-foreground">
                          {t("settings.model")}
                        </span>
                        <input
                          className="h-9 w-full rounded-md border border-border bg-white/[0.42] px-2.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/[0.42] focus:ring-2 focus:ring-primary/[0.12] dark:bg-background/[0.12]"
                          onChange={(event) => updateAIProviderConfig("model", event.target.value)}
                          placeholder={t("settings.modelPlaceholder")}
                          spellCheck={false}
                          type="text"
                          value={aiProviderConfig.model}
                        />
                      </label>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="min-w-0 text-xs font-medium text-primary">
                        {saveFeedbackVisible ? t("settings.saved") : ""}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button onClick={clearAISettings} size="sm" type="button" variant="ghost">
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("settings.clearAISettings")}
                        </Button>
                        <Button onClick={saveAISettings} size="sm" type="button">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t("settings.saveAISettings")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background/[0.54] p-3 dark:bg-background/[0.14]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5" />
                        {t("settings.tokenPolicy")}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("settings.tokenPolicyHint")}
                      </p>
                    </div>
                    <Badge tone="accent">{t("processing.index")}</Badge>
                  </div>

                  <div className="mt-3 grid gap-1.5">
                    {tokenPolicyOptions.map((option) => {
                      const selected = aiProviderConfig.tokenPolicy === option.value;

                      return (
                        <button
                          aria-pressed={selected}
                          className={[
                            "grid w-full grid-cols-[20px_minmax(0,1fr)] gap-2 rounded-md border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                              ? "border-primary/[0.30] bg-primary/10 text-foreground"
                              : "border-border/70 bg-white/[0.26] text-muted-foreground hover:bg-white/[0.48] hover:text-foreground dark:bg-background/[0.10] dark:hover:bg-secondary/[0.32]",
                          ].join(" ")}
                          data-token-policy-option={option.value}
                          key={option.value}
                          onClick={() => updateAIProviderConfig("tokenPolicy", option.value)}
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className={[
                              "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border",
                              selected ? "border-primary bg-primary" : "border-border bg-background/[0.42]",
                            ].join(" ")}
                          >
                            {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold">{t(option.labelKey)}</span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                              {t(option.descriptionKey)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-primary/[0.18] bg-primary/[0.07] px-2.5 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-primary">
                        <FileText className="h-3.5 w-3.5" />
                        {t("settings.requiredNow")}
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {t("settings.requiredNowHint")}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-white/[0.26] px-2.5 py-2 dark:bg-background/[0.10]">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
                        <Database className="h-3.5 w-3.5" />
                        {t("settings.deferredAI")}
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {t("settings.deferredAIHint")}
                      </p>
                    </div>
                  </div>
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
