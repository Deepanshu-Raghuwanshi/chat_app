"use client";

import React, { useEffect, useRef } from "react";
import { Conversation } from "@shared-types";
import { ConversationItem } from "./ConversationItem";
import { Spinner } from "../../../shared/components/ui/spinner";
import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (conversationId: string) => void;
  onLoadMore?: () => void;
  hasMore: boolean;
  isFetchingMore?: boolean;
}

export const ConversationList = ({
  conversations,
  activeId,
  onSelect,
  onLoadMore,
  hasMore,
  isFetchingMore,
}: ConversationListProps) => {
  const t = useTranslations("features.chat.sidebar");
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          onLoadMore?.();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <MessageSquare className="w-10 h-10 text-foreground/20 mb-3" />
        <p className="text-sm text-foreground/40">{t("no_conversations")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isActive={conv.id === activeId}
          onClick={() => onSelect(conv.id)}
        />
      ))}

      <div ref={bottomSentinelRef} className="h-1" />

      {isFetchingMore && (
        <div className="flex justify-center py-3">
          <Spinner className="w-5 h-5 text-primary/60" />
        </div>
      )}
    </div>
  );
};
