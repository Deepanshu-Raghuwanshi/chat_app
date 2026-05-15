"use client";

import React from "react";
import type { ConversationParticipant, QuotedMessage } from "@shared-types";
import { cn } from "../../../shared/utils/cn";
import { resolveParticipantName } from "../utils/resolveParticipantName";

interface QuotedPreviewProps {
  replyTo: QuotedMessage;
  isMine: boolean;
  participants: ConversationParticipant[];
  showSenderName: boolean;
  onJumpToMessage?: () => void;
}

export const QuotedPreview = ({
  replyTo,
  isMine,
  participants,
  showSenderName,
  onJumpToMessage,
}: QuotedPreviewProps) => (
  <div
    onClick={onJumpToMessage}
    className={cn(
      "mb-1 px-3 py-1.5 rounded-xl text-xs border-l-2 border-primary/50 bg-primary/5",
      "max-w-full overflow-hidden",
      isMine ? "self-end" : "self-start",
      onJumpToMessage &&
        "cursor-pointer hover:bg-primary/10 transition-colors duration-150",
    )}
  >
    {showSenderName && (
      <p className="font-medium text-primary/70 truncate">
        {resolveParticipantName(replyTo.senderId, participants)}
      </p>
    )}
    <p className="truncate text-foreground/60">{replyTo.content}</p>
  </div>
);
