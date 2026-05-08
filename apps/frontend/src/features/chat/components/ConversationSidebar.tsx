"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageSquare } from "lucide-react";
import { ConversationList } from "./ConversationList";
import { Spinner } from "../../../shared/components/ui/spinner";
import { useConversations } from "../hooks/useChat";
import { useChatStore } from "../store/useChatStore";
import { cn } from "../../../shared/utils/cn";
import { useQueryClient, InfiniteData } from "@tanstack/react-query";
import type { ConversationListResponse } from "@shared-types";

export const ConversationSidebar = () => {
  const t = useTranslations("features.chat.sidebar");
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeConversationId = useChatStore(
    (state) => state.activeConversationId,
  );
  const setActiveConversation = useChatStore(
    (state) => state.setActiveConversation,
  );

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversations();

  const conversations = data?.pages.flatMap((page) => page.data) ?? [];

  const handleSelect = (conversationId: string) => {
    // Optimistically clear the unread badge immediately — markRead will confirm server-side
    queryClient.setQueryData<InfiniteData<ConversationListResponse>>(
      ["conversations"],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((conv) =>
              conv.id === conversationId
                ? { ...conv, unreadCount: 0 }
                : conv,
            ),
          })),
        };
      },
    );
    setActiveConversation(conversationId);
    router.push(`/chat/${conversationId}`);
  };

  return (
    <div
      className={cn(
        "flex flex-col w-80 shrink-0 bg-white border-r border-border h-full",
      )}
    >
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border shrink-0">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center flex-1">
          <Spinner className="w-6 h-6 text-primary" />
        </div>
      ) : (
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelect}
          onLoadMore={fetchNextPage}
          hasMore={!!hasNextPage}
          isFetchingMore={isFetchingNextPage}
        />
      )}
    </div>
  );
};
