"use client";

import React, { useState } from "react";
import { cn } from "../../../shared/utils/cn";
import { useTranslations } from "next-intl";
import { EmojiPickerPopover } from "./EmojiPickerPopover";

const PRESET_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
}

export const ReactionPicker = ({ onSelect }: ReactionPickerProps) => {
  const t = useTranslations("features.chat.message");
  const [showFullPicker, setShowFullPicker] = useState(false);

  const handlePreset = (emoji: string) => {
    onSelect(emoji);
  };

  const handleFullPickerSelect = (emoji: string) => {
    setShowFullPicker(false);
    onSelect(emoji);
  };

  return (
    <div className="relative flex items-center gap-0.5 bg-white border border-border rounded-full px-1.5 py-1 shadow-md">
      {PRESET_EMOJI.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handlePreset(emoji)}
          aria-label={`React with ${emoji}`}
          className={cn(
            "text-base w-7 h-7 flex items-center justify-center rounded-full",
            "hover:bg-secondary transition-colors duration-100",
          )}
        >
          {emoji}
        </button>
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowFullPicker((v) => !v)}
          aria-label={t("more_reactions")}
          className={cn(
            "text-xs font-medium w-7 h-7 flex items-center justify-center rounded-full",
            "text-foreground/50 hover:bg-secondary hover:text-foreground transition-colors duration-100",
          )}
        >
          +
        </button>
        {showFullPicker && (
          <EmojiPickerPopover onEmojiSelect={handleFullPickerSelect} />
        )}
      </div>
    </div>
  );
};
