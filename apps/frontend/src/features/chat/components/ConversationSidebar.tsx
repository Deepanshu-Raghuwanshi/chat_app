"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageSquare, Search, X } from "lucide-react";
import { ConversationList } from "./ConversationList";
import { Spinner } from "../../../shared/components/ui/spinner";
import { useConversations, useSearchConversations } from "../hooks/useChat";
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

  const [searchQuery, setSearchQuery] = useState("");
  const isSearchMode = searchQuery.trim().length >= 1;

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversations();

  const { data: searchData, isLoading: isSearchLoading } =
    useSearchConversations(searchQuery);

  const conversations = isSearchMode
    ? (searchData?.data ?? [])
    : (data?.pages.flatMap((page) => page.data) ?? []);

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
              conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv,
            ),
          })),
        };
      },
    );
    setActiveConversation(conversationId);
    router.push(`/chat/${conversationId}`);
  };

  const showSpinner = isSearchMode
    ? isSearchLoading || searchData === undefined
    : isLoading;
  const showNoResults =
    isSearchMode &&
    !isSearchLoading &&
    conversations.length === 0 &&
    searchData !== undefined;

  return (
    <div
      className={cn(
        "flex flex-col w-80 shrink-0 bg-card border-r border-border h-full",
      )}
    >
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border shrink-0">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
      </div>

      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("search_placeholder")}
            aria-label={t("search_placeholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {/* length > 0 (not trimmed) matches spec — spaces show ×, but don't activate search mode */}
          {searchQuery.length > 0 && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label={t("clear_search")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {showSpinner ? (
        <div className="flex justify-center items-center flex-1">
          <Spinner className="w-6 h-6 text-primary" />
        </div>
      ) : showNoResults ? (
        <div className="flex justify-center items-center flex-1 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t("search_no_results", { query: searchQuery })}
          </p>
        </div>
      ) : (
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelect}
          onLoadMore={isSearchMode ? undefined : fetchNextPage}
          hasMore={isSearchMode ? false : !!hasNextPage}
          isFetchingMore={isSearchMode ? false : isFetchingNextPage}
        />
      )}
    </div>
  );
};
