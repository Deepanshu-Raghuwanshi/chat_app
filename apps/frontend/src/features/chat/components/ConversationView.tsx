"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ConversationHeader } from "./ConversationHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { Spinner } from "../../../shared/components/ui/spinner";
import { useConversation, useMessages, useMarkRead } from "../hooks/useChat";
import { useChatStore } from "../store/useChatStore";
import { usePresence } from "../../friends/hooks/usePresence";
import { cn } from "../../../shared/utils/cn";
import type { Message } from "@shared-types";

interface ConversationViewProps {
  conversationId: string;
}

export const ConversationView = ({ conversationId }: ConversationViewProps) => {
  const t = useTranslations("features.chat.errors");
  const router = useRouter();

  // Keep socket alive and receiving message.new events
  usePresence();

  const setActiveConversation = useChatStore(
    (state) => state.setActiveConversation,
  );
  const { data: conversation, isLoading: isLoadingConv } =
    useConversation(conversationId);
  const {
    data: messagesData,
    isLoading: isLoadingMsgs,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(conversationId);
  const { mutate: markRead } = useMarkRead(conversationId);

  // Sync store with current route
  useEffect(() => {
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, setActiveConversation]);

  // Mark as read on open and whenever new messages arrive while viewing
  const latestMessageId = messagesData?.pages[0]?.data[0]?.id;
  useEffect(() => {
    markRead();
  }, [conversationId, latestMessageId, markRead]);

  if (isLoadingConv || isLoadingMsgs) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div
        className={cn("flex flex-col items-center justify-center h-full gap-3")}
      >
        <p className="text-foreground/60 text-sm">{t("not_found")}</p>
        <button
          onClick={() => router.push("/chat")}
          className="text-primary text-sm hover:underline"
        >
          {t("back_to_chats")}
        </button>
      </div>
    );
  }

  // Flatten pages, filter undefined slots, deduplicate by id, reverse for display (oldest at top)
  const seen = new Set<string>();
  const allMessages = (
    messagesData?.pages.flatMap((page) => page.data) ?? []
  ).filter((m): m is Message => {
    if (m == null || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
  const displayMessages = [...allMessages].reverse();

  return (
    <div className={cn("flex flex-col h-full")}>
      <ConversationHeader conversation={conversation} />
      <MessageList
        key={conversationId}
        messages={displayMessages}
        onLoadMore={fetchNextPage}
        hasMore={!!hasNextPage}
        isFetchingMore={isFetchingNextPage}
      />
      <MessageComposer conversationId={conversationId} />
    </div>
  );
};
