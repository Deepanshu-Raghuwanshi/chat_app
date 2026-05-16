"use client";

import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "../../../shared/store/useThemeStore";
import { useProfile } from "../hooks/useProfile";
import { cn } from "../../../shared/utils/cn";
import { useTranslations } from "next-intl";

export const ThemePreferenceSection = () => {
  const { theme, setTheme } = useThemeStore();
  const { updateTheme } = useProfile();
  const t = useTranslations("features.profile.preferences");

  const handleSelect = (selected: "light" | "dark") => {
    if (selected === theme) return;
    setTheme(selected);
    updateTheme(selected);
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground border-b border-border pb-4">
        {t("title")}
      </h2>
      <div>
        <p className="text-sm font-medium text-foreground mb-3">
          {t("theme_label")}
        </p>
        <div className="flex gap-3">
          {(["light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleSelect(mode)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                theme === mode
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {mode === "light" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
              {mode === "light" ? t("light") : t("dark")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
