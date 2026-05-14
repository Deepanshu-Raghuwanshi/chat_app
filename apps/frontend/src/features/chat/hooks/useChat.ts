"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useState, useEffect } from "react";
import { chatService } from "../services/chat.service";
import {
  Conversation,
  ConversationListResponse,
  Message,
  MessageListResponse,
} from "@shared-types";
import { showToast } from "../../../shared/utils/toast";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useTranslations } from "next-intl";

export const useConversations = () => {
  return useInfiniteQuery({
    queryKey: ["conversations"],
    queryFn: ({ pageParam }) =>
      chatService.listConversations({
        before: pageParam as string | undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
  });
};

export const useConversation = (conversationId: string) => {
  return useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => chatService.getConversation(conversationId),
    enabled: !!conversationId,
  });
};

export const useMessages = (conversationId: string) => {
  return useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) =>
      chatService.getMessages(conversationId, {
        before: pageParam as string | undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!conversationId,
  });
};

export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  const t = useTranslations("features.chat.errors");

  return useMutation({
    mutationFn: (
      dto: Parameters<typeof chatService.createOrGetConversation>[0],
    ) => chatService.createOrGetConversation(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: () => {
      showToast.error(t("open_failed"));
    },
  });
};

export const useSendMessage = (conversationId: string) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const t = useTranslations("features.chat.errors");

  return useMutation({
    mutationFn: (content: string) =>
      chatService.sendMessage(conversationId, content),
    onMutate: async (content) => {
      await queryClient.cancelQueries({
        queryKey: ["messages", conversationId],
      });
      const snapshot = queryClient.getQueryData<
        InfiniteData<MessageListResponse>
      >(["messages", conversationId]);

      const optimisticMessage: Message = {
        id: `optimistic-${Date.now()}`,
        conversationId,
        senderId: user?.id ?? "",
        content,
        type: "TEXT",
        status: "SENT",
        isDeleted: false,
        isEdited: false,
        reactions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        ["messages", conversationId],
        (old) => {
          if (!old) return old;
          const newPages = [...old.pages];
          newPages[0] = {
            ...newPages[0],
            data: [optimisticMessage, ...newPages[0].data],
          };
          return { ...old, pages: newPages };
        },
      );

      return { snapshot };
    },
    onError: (err, _content, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(
          ["messages", conversationId],
          context.snapshot,
        );
      }
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        showToast.error(t("no_longer_friends"));
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        router.push("/chat");
      } else {
        showToast.error(t("send_failed"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    },
  });
};

export const useEditMessage = (conversationId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("features.chat.errors");

  return useMutation({
    mutationFn: ({
      messageId,
      content,
    }: {
      messageId: string;
      content: string;
    }) => chatService.editMessage(conversationId, messageId, content),
    onSuccess: (updatedMessage) => {
      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        ["messages", conversationId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((msg) =>
                msg.id === updatedMessage.id ? updatedMessage : msg,
              ),
            })),
          };
        },
      );
    },
    onError: () => {
      showToast.error(t("edit_failed"));
    },
  });
};

export const useDeleteMessage = (conversationId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("features.chat.errors");

  return useMutation({
    mutationFn: (messageId: string) =>
      chatService.deleteMessage(conversationId, messageId),
    onSuccess: (updatedMessage) => {
      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        ["messages", conversationId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((msg) =>
                msg.id === updatedMessage.id ? updatedMessage : msg,
              ),
            })),
          };
        },
      );
    },
    onError: () => {
      showToast.error(t("delete_failed"));
    },
  });
};

export const useMarkRead = (conversationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => chatService.markRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["conversation", conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
};

export const useSearchConversations = (query: string) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  return useQuery<ConversationListResponse>({
    queryKey: ["conversation-search", debouncedQuery],
    queryFn: () => chatService.searchConversations(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 1,
    staleTime: 30_000,
  });
};

export const useToggleReaction = (conversationId: string) => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const t = useTranslations("features.chat.errors");

  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      chatService.toggleReaction(conversationId, messageId, emoji),

    onMutate: async ({ messageId, emoji }) => {
      await queryClient.cancelQueries({
        queryKey: ["messages", conversationId],
      });
      const snapshot = queryClient.getQueryData<
        InfiniteData<MessageListResponse>
      >(["messages", conversationId]);

      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        ["messages", conversationId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((msg) => {
                if (msg.id !== messageId) return msg;
                const reactions = msg.reactions ?? [];
                const existingIdx = reactions.findIndex(
                  (r) => r.emoji === emoji && r.userId === user?.id,
                );
                const updatedReactions =
                  existingIdx >= 0
                    ? reactions.filter((_, i) => i !== existingIdx)
                    : [
                        ...reactions,
                        {
                          emoji,
                          userId: user?.id ?? "",
                          createdAt: new Date().toISOString(),
                        },
                      ];
                return { ...msg, reactions: updatedReactions };
              }),
            })),
          };
        },
      );

      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(
          ["messages", conversationId],
          context.snapshot,
        );
      }
      showToast.error(t("react_failed"));
    },
    onSuccess: (updatedMessage) => {
      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        ["messages", conversationId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((msg) =>
                msg.id === updatedMessage.id ? updatedMessage : msg,
              ),
            })),
          };
        },
      );
    },
  });
};

export const useGetOtherParticipant = (
  conversation: Conversation | undefined,
) => {
  const userId = useAuthStore((state) => state.user?.id);
  if (!conversation) return undefined;
  return conversation.participants.find((p) => p.userId !== userId);
};
