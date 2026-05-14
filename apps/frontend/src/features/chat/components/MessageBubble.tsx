"use client";

import React, { useEffect, useRef, useState } from "react";
import { Message } from "@shared-types";
import {
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  X,
  Smile,
  CheckCheck,
} from "lucide-react";
import { cn } from "../../../shared/utils/cn";
import { useTranslations } from "next-intl";
import {
  useEditMessage,
  useDeleteMessage,
  useToggleReaction,
} from "../hooks/useChat";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { ReactionBar } from "./ReactionBar";
import { ReactionPicker } from "./ReactionPicker";

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  conversationId: string;
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const MessageBubble = ({
  message,
  isMine,
  conversationId,
}: MessageBubbleProps) => {
  const t = useTranslations("features.chat.message");
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const reactionPickerAreaRef = useRef<HTMLDivElement>(null);

  const currentUserId = useAuthStore((state) => state.user?.id ?? "");

  useEffect(() => {
    if (!showReactionPicker) return;
    const handler = (e: MouseEvent) => {
      if (!reactionPickerAreaRef.current?.contains(e.target as Node)) {
        setShowReactionPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showReactionPicker]);

  const { mutate: editMessage, isPending: isEditPending } = useEditMessage(
    message.conversationId,
  );
  const { mutate: deleteMessage, isPending: isDeletePending } =
    useDeleteMessage(message.conversationId);
  const { mutate: toggleReaction } = useToggleReaction(conversationId);

  const handleEdit = () => {
    if (!editContent.trim() || editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    editMessage(
      { messageId: message.id, content: editContent.trim() },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  const handleDelete = () => {
    setShowMenu(false);
    deleteMessage(message.id);
  };

  const handleReactionSelect = (emoji: string) => {
    setShowReactionPicker(false);
    toggleReaction({ messageId: message.id, emoji });
  };

  const reactions = message.reactions ?? [];

  if (message.isDeleted) {
    return (
      <div
        className={cn("flex mb-2", isMine ? "justify-end" : "justify-start")}
      >
        <span className="text-xs italic text-foreground/40 px-3 py-1.5 bg-secondary rounded-2xl">
          {t("deleted")}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex mb-2 group",
        isMine ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "flex flex-col max-w-xs lg:max-w-md",
          isMine ? "items-end" : "items-start",
        )}
      >
        {isEditing ? (
          <div className="flex items-center gap-2 bg-white border border-border rounded-2xl px-3 py-2 shadow-sm">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEdit();
                if (e.key === "Escape") setIsEditing(false);
              }}
              className="text-sm outline-none w-48"
              autoFocus
              disabled={isEditPending}
            />
            <button
              onClick={handleEdit}
              disabled={isEditPending}
              className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="p-1 text-red-500 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative flex items-end gap-1">
            {/* Reaction picker — left of mine, between content and menu for others */}
            {isMine && (
              <div className="relative opacity-0 group-hover:opacity-100 transition-opacity mb-1 flex items-center gap-1">
                <div ref={reactionPickerAreaRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowReactionPicker((v) => !v)}
                    aria-label={t("react")}
                    className="p-1 rounded-full hover:bg-secondary text-foreground/40 hover:text-foreground transition-colors"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                  {showReactionPicker && (
                    <div className="absolute bottom-8 right-0 z-20">
                      <ReactionPicker onSelect={handleReactionSelect} />
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowMenu((v) => !v)}
                    disabled={isDeletePending}
                    aria-label={t("message_menu")}
                    className="p-1 rounded-full hover:bg-secondary text-foreground/40 hover:text-foreground transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {showMenu && (
                    <div className="absolute bottom-7 right-0 bg-white border border-border rounded-xl shadow-lg py-1 z-10 min-w-28">
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setEditContent(message.content);
                          setShowMenu(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {t("edit")}
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t("delete")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div
              className={cn(
                "px-4 py-2 rounded-2xl text-sm leading-relaxed",
                isMine
                  ? "bg-primary text-white rounded-br-sm"
                  : "bg-white border border-border text-foreground rounded-bl-sm shadow-sm",
              )}
            >
              {message.content}
            </div>

            {/* Reaction picker for other's messages — right side */}
            {!isMine && (
              <div
                ref={reactionPickerAreaRef}
                className="relative opacity-0 group-hover:opacity-100 transition-opacity mb-1"
              >
                <button
                  type="button"
                  onClick={() => setShowReactionPicker((v) => !v)}
                  aria-label={t("react")}
                  className="p-1 rounded-full hover:bg-secondary text-foreground/40 hover:text-foreground transition-colors"
                >
                  <Smile className="w-4 h-4" />
                </button>
                {showReactionPicker && (
                  <div className="absolute bottom-8 left-0 z-20">
                    <ReactionPicker onSelect={handleReactionSelect} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reaction bar below bubble */}
        {reactions.length > 0 && (
          <ReactionBar
            reactions={reactions}
            currentUserId={currentUserId}
            onToggle={(emoji) =>
              toggleReaction({ messageId: message.id, emoji })
            }
          />
        )}

        <div className="flex items-center gap-1.5 mt-0.5 px-1">
          <span className="text-xs text-foreground/40">
            {formatTime(message.createdAt)}
          </span>
          {message.isEdited && (
            <span className="text-xs text-foreground/30 italic">
              ({t("edited")})
            </span>
          )}
          {isMine && (
            <span className="flex items-center">
              {message.status === "READ" ? (
                <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
              ) : message.status === "DELIVERED" ? (
                <CheckCheck className="w-3.5 h-3.5 text-foreground/40" />
              ) : (
                <Check className="w-3.5 h-3.5 text-foreground/40" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
