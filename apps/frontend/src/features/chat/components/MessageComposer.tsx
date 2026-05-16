"use client";

import React, { useRef, useState, useEffect, useCallback, KeyboardEvent } from "react";
import { Send, Smile, Reply, X } from "lucide-react";
import { cn } from "../../../shared/utils/cn";
import { useTranslations } from "next-intl";
import { useSendMessage } from "../hooks/useChat";
import { useChatStore } from "../store/useChatStore";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import type { ConversationParticipant } from "@shared-types";
import { resolveParticipantName } from "../utils/resolveParticipantName";
import {
  emitTypingStart,
  emitTypingStop,
} from "../../friends/hooks/usePresence";

interface MessageComposerProps {
  conversationId: string;
  participants: ConversationParticipant[];
}

export const MessageComposer = ({
  conversationId,
  participants,
}: MessageComposerProps) => {
  const t = useTranslations("features.chat.composer");
  const draft = useChatStore(
    (state) => state.draftMessages[conversationId] ?? "",
  );
  const setDraft = useChatStore((state) => state.setDraft);
  const replyTarget = useChatStore(
    (state) => state.replyTargets[conversationId] ?? null,
  );
  const setReplyTarget = useChatStore((state) => state.setReplyTarget);
  const { mutate: sendMessage, isPending } = useSendMessage(conversationId);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiAreaRef = useRef<HTMLDivElement>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (replyTarget) textareaRef.current?.focus();
  }, [replyTarget]);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiAreaRef.current &&
        !emojiAreaRef.current.contains(e.target as Node)
      ) {
        setEmojiPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiPickerOpen]);

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;
    if (isTypingRef.current) {
      emitTypingStop(conversationId);
      isTypingRef.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    return () => stopTyping();
  }, [stopTyping]);

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? draft.length;
    const newValue = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(conversationId, newValue);
    setEmojiPickerOpen(false);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const handleSend = () => {
    const content = draft.trim();
    if (!content || isPending) return;
    stopTyping();
    sendMessage(
      { content, quotedMessageId: replyTarget?.id },
      {
        onSuccess: () => {
          setDraft(conversationId, "");
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
        },
      },
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(conversationId, e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
    if (e.target.value.trim()) {
      if (!isTypingRef.current) {
        emitTypingStart(conversationId);
        isTypingRef.current = true;
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(stopTyping, 3000);
    } else {
      stopTyping();
    }
  };

  return (
    <div className="shrink-0 px-4 py-3 bg-white border-t border-border">
      <div
        className={cn(
          "flex flex-col bg-secondary rounded-2xl",
          replyTarget ? "pt-0" : "",
        )}
      >
        {replyTarget && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 text-xs rounded-t-2xl">
            <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              {participants.length > 2 && (
                <p className="font-medium text-primary truncate">
                  {resolveParticipantName(replyTarget.senderId, participants)}
                </p>
              )}
              <p className="text-foreground/60 truncate">
                {replyTarget.content.slice(0, 80)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTarget(conversationId, null)}
              aria-label={t("cancel_reply")}
              className="p-1 rounded-full hover:bg-foreground/10 text-foreground/40 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 px-4 py-2">
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
          <div ref={emojiAreaRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setEmojiPickerOpen((v) => !v)}
              aria-label={t("emoji_button_label")}
              className={cn(
                "p-2 rounded-xl transition-all duration-200",
                emojiPickerOpen
                  ? "text-primary bg-primary/10"
                  : "text-foreground/40 hover:text-foreground hover:bg-foreground/5",
              )}
            >
              <Smile className="w-4 h-4" />
            </button>
            {emojiPickerOpen && (
              <EmojiPickerPopover onEmojiSelect={handleEmojiSelect} />
            )}
          </div>
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
    </div>
  );
};
