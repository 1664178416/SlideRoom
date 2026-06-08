"use client";

import { AnimatePresence, motion } from "motion/react";
import { Languages, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

type PreferencesControlsProps = {
  compact?: boolean;
  className?: string;
};

export function PreferencesControls({
  compact = true,
  className,
}: PreferencesControlsProps) {
  const { language, setLanguage, setTheme, theme, toggleLanguage, toggleTheme, t } = usePreferences();
  const ThemeIcon = theme === "light" ? Moon : Sun;

  if (!compact) {
    return (
      <div className={cn("grid w-full gap-2", className)}>
        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {theme === "light" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {t("common.theme")}
          </div>
          <div className="grid grid-cols-2 rounded-md border border-border bg-background/[0.54] p-1 dark:bg-background/[0.14]">
            {[
              ["light", t("common.day"), Sun],
              ["dark", t("common.night"), Moon],
            ].map(([value, label, Icon]) => {
              const active = theme === value;
              const SegmentIcon = Icon as typeof Sun;

              return (
                <button
                  aria-pressed={active}
                  className={cn(
                    "flex h-7 items-center justify-center gap-1.5 rounded-[5px] text-xs font-medium transition",
                    active
                      ? "bg-foreground text-background shadow-[0_1px_0_rgba(255,255,255,0.28)_inset]"
                      : "text-muted-foreground hover:bg-white/[0.54] hover:text-foreground dark:hover:bg-secondary/50",
                  )}
                  data-preference-theme-option={value as string}
                  key={value as string}
                  onClick={() => setTheme(value as "light" | "dark")}
                  type="button"
                >
                  <SegmentIcon className="h-3.5 w-3.5" />
                  {label as string}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Languages className="h-3.5 w-3.5" />
            {t("common.languageLabel")}
          </div>
          <div className="grid grid-cols-2 rounded-md border border-border bg-background/[0.54] p-1 dark:bg-background/[0.14]">
            {[
              ["zh", t("common.chineseFull")],
              ["en", t("common.englishFull")],
            ].map(([value, label]) => {
              const active = language === value;

              return (
                <button
                  aria-pressed={active}
                  className={cn(
                    "flex h-7 items-center justify-center rounded-[5px] text-xs font-medium transition",
                    active
                      ? "bg-foreground text-background shadow-[0_1px_0_rgba(255,255,255,0.28)_inset]"
                      : "text-muted-foreground hover:bg-white/[0.54] hover:text-foreground dark:hover:bg-secondary/50",
                  )}
                  data-preference-language-option={value}
                  key={value}
                  onClick={() => setLanguage(value as "zh" | "en")}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        aria-label={theme === "light" ? t("common.themeDark") : t("common.themeLight")}
        data-preference-theme-toggle="true"
        onClick={toggleTheme}
        size={compact ? "icon" : "sm"}
        title={theme === "light" ? t("common.themeDark") : t("common.themeLight")}
        type="button"
        variant="ghost"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: theme === "light" ? -32 : 32, scale: 0.82 }}
            initial={{ opacity: 0, rotate: theme === "light" ? 32 : -32, scale: 0.82 }}
            key={theme}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <ThemeIcon className="h-4 w-4" />
          </motion.span>
        </AnimatePresence>
        {!compact && <span>{theme === "light" ? t("common.night") : t("common.day")}</span>}
      </Button>

      <Button
        aria-label={t("common.language")}
        className={compact ? "w-auto px-2.5" : undefined}
        data-preference-language-toggle="true"
        onClick={toggleLanguage}
        size={compact ? "sm" : "sm"}
        title={t("common.language")}
        type="button"
        variant="ghost"
      >
        <Languages className="h-4 w-4" />
        <span className="min-w-5 text-xs font-semibold">
          {language === "zh" ? t("common.english") : t("common.chinese")}
        </span>
      </Button>
    </div>
  );
}
