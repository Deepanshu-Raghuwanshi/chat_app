"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Spinner } from "../../../shared/components/ui/spinner";
import { useThemeStore } from "../../../shared/store/useThemeStore";

interface PickerProps {
  data: unknown;
  onEmojiSelect: (emoji: { native: string }) => void;
  theme?: "light" | "dark" | "auto";
  previewPosition?: "top" | "bottom" | "none";
}

const EmojiMartPicker = dynamic<PickerProps>(
  () => import("@emoji-mart/react").then((m) => ({ default: m.default })),
  { ssr: false },
);

interface EmojiPickerPopoverProps {
  onEmojiSelect: (emoji: string) => void;
}

export const EmojiPickerPopover = ({
  onEmojiSelect,
}: EmojiPickerPopoverProps) => {
  const [emojiData, setEmojiData] = useState<unknown>(null);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    import("@emoji-mart/data").then((m) => setEmojiData(m.default));
  }, []);

  return (
    <div className="absolute bottom-full right-0 mb-2 z-50 shadow-xl rounded-xl overflow-hidden">
      {!emojiData ? (
        <div className="flex items-center justify-center w-[352px] h-[435px] bg-card border border-border rounded-xl">
          <Spinner className="w-6 h-6 text-primary" />
        </div>
      ) : (
        <EmojiMartPicker
          data={emojiData}
          onEmojiSelect={(emoji) => onEmojiSelect(emoji.native)}
          theme={theme}
          previewPosition="none"
        />
      )}
    </div>
  );
};
