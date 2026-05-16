"use client";

import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";
import { cn } from "../utils/cn";
import { useTranslations } from "next-intl";

interface ThemeToggleProps {
  onToggle?: (newTheme: "light" | "dark") => void;
  className?: string;
}

export const ThemeToggle = ({ onToggle, className }: ThemeToggleProps) => {
  const { theme, setTheme } = useThemeStore();
  const t = useTranslations("features.navbar.theme");
  const isDark = theme === "dark";

  const handleClick = () => {
    const next: "light" | "dark" = isDark ? "light" : "dark";
    setTheme(next);
    onToggle?.(next);
  };

  return (
    <button
      onClick={handleClick}
      aria-label={isDark ? t("switch_to_light") : t("switch_to_dark")}
      title={isDark ? t("switch_to_light") : t("switch_to_dark")}
      className={cn(
        "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200",
        "text-muted-foreground hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
};
