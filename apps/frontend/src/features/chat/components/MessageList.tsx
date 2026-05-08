"use client";

import React, { useEffect, useRef } from "react";
import { Message } from "@shared-types";
import { MessageBubble } from "./MessageBubble";
import { Spinner } from "../../../shared/components/ui/spinner";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { cn } from "../../../shared/utils/cn";

interface MessageListProps {
  messages: Message[];
  onLoadMore: () => void;
  hasMore: boolean;
  isFetchingMore?: boolean;
}

export const MessageList = ({
  messages,
  onLoadMore,
  hasMore,
  isFetchingMore,
}: MessageListProps) => {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const newestId = messages.at(-1)?.id;

  // Scroll to bottom when the newest message changes (new message received or sent)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [newestId]);

  // Infinite scroll upward to load older messages
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  return (
    <div className={cn("flex-1 overflow-y-auto px-4 py-2 flex flex-col")}>
      {/* Top sentinel for infinite scroll */}
      <div ref={topSentinelRef} className="shrink-0 h-1" />

      {isFetchingMore && (
        <div className="flex justify-center py-2">
          <Spinner className="w-5 h-5 text-primary/60" />
        </div>
      )}

      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isMine={msg.senderId === currentUserId}
        />
      ))}

      {/* Bottom sentinel for auto-scroll */}
      <div ref={bottomRef} className="shrink-0 h-1" />
    </div>
  );
};
