"use client";

import React from "react";
import {
  SpellCheck,
  Briefcase,
  MessageCircle,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { cn } from "../../../shared/utils/cn";
import { useTranslations } from "next-intl";
import type { RewriteTone } from "../types";

export type { RewriteTone };

type ToneLabelKey =
  | "ai_tone_fix_grammar"
  | "ai_tone_professional"
  | "ai_tone_casual"
  | "ai_tone_shorter"
  | "ai_tone_longer";

interface ToneOption {
  tone: RewriteTone;
  labelKey: ToneLabelKey;
  icon: React.ElementType;
}

const TONE_OPTIONS: ToneOption[] = [
  { tone: "fix-grammar", labelKey: "ai_tone_fix_grammar", icon: SpellCheck },
  { tone: "professional", labelKey: "ai_tone_professional", icon: Briefcase },
  { tone: "casual", labelKey: "ai_tone_casual", icon: MessageCircle },
  { tone: "shorter", labelKey: "ai_tone_shorter", icon: Minimize2 },
  { tone: "longer", labelKey: "ai_tone_longer", icon: Maximize2 },
];

interface AiTonePickerProps {
  onSelect: (tone: RewriteTone) => void;
  isLoading: boolean;
}

export const AiTonePicker = ({ onSelect, isLoading }: AiTonePickerProps) => {
  const t = useTranslations("features.chat.composer");

  return (
    <div className="absolute bottom-full right-0 mb-2 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px]">
      {TONE_OPTIONS.map(({ tone, labelKey, icon: Icon }) => (
        <button
          key={tone}
          type="button"
          disabled={isLoading}
          onClick={() => onSelect(tone)}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 text-sm text-left",
            "transition-colors duration-150",
            isLoading
              ? "text-foreground/30 cursor-wait"
              : "text-foreground/70 hover:text-foreground hover:bg-foreground/5",
          )}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span>{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
};
