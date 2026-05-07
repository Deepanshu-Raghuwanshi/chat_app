"use client";

import React, { useRef, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "../../../shared/utils/cn";
import { useTranslations } from "next-intl";
import { useSendMessage } from "../hooks/useChat";
import { useChatStore } from "../store/useChatStore";

interface MessageComposerProps {
  conversationId: string;
}

export const MessageComposer = ({ conversationId }: MessageComposerProps) => {
  const t = useTranslations("features.chat.composer");
  const draft = useChatStore(
    (state) => state.draftMessages[conversationId] ?? "",
  );
  const setDraft = useChatStore((state) => state.setDraft);
  const { mutate: sendMessage, isPending } = useSendMessage(conversationId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const content = draft.trim();
    if (!content || isPending) return;
    sendMessage(content, {
      onSuccess: () => {
        setDraft(conversationId, "");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      },
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(conversationId, e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="shrink-0 px-4 py-3 bg-white border-t border-border">
      <div className="flex items-end gap-2 bg-secondary rounded-2xl px-4 py-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          rows={1}
          disabled={isPending}
          className={cn(
            "flex-1 bg-transparent resize-none outline-none text-sm text-foreground",
            "placeholder:text-foreground/40 max-h-30 leading-relaxed py-1 disabled:opacity-50",
          )}
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || isPending}
          className={cn(
            "shrink-0 p-2 rounded-xl transition-all duration-200",
            draft.trim() && !isPending
              ? "bg-primary text-white hover:bg-primary/90 shadow-sm"
              : "bg-foreground/10 text-foreground/30 cursor-not-allowed",
          )}
          aria-label={t("send")}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
