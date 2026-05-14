import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserProfile } from "../services/friends.service";
import { Message, MessageListResponse } from "@shared-types";
import { InfiniteData } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { chatService } from "../../chat/services/chat.service";
import { useChatStore } from "../../chat/store/useChatStore";

interface PresenceUpdate {
  userId: string;
  status: "ONLINE" | "OFFLINE";
}

// Shape emitted by ChatGateway (mirrors MessageSentEventV1 from kafka-events)
interface MessageNewPayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: string;
  sentAt: string;
}

interface MessageDeliveredPayload {
  conversationId: string;
  senderId: string;
  recipientId: string; // mirrors server payload; not needed client-side
  deliveredAt: string;
}

interface MessageReadPayload {
  conversationId: string;
  senderId: string;
  lastReadAt: string;
}

let socket: Socket | null = null;

export const usePresence = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) {
      const CHAT_SERVICE_URL =
        process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || "http://localhost:3003";
      socket = io(`${CHAT_SERVICE_URL}/presence`, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });

      socket.on("presence.updated", (data: PresenceUpdate) => {
        queryClient.setQueryData<UserProfile[]>(["friends"], (oldFriends) => {
          if (!oldFriends) return oldFriends;

          return oldFriends.map((friend) => {
            if (friend.id === data.userId) {
              return {
                ...friend,
                isOnline: data.status === "ONLINE",
              };
            }
            return friend;
          });
        });
      });

      socket.on("friendship.removed", () => {
        // Invalidate the conversation list for both the remover and the removed user
        // so neither sees the stale conversation in their sidebar.
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({ queryKey: ["friends"] });
      });

      socket.on("friend.request.received", () => {
        queryClient.invalidateQueries({
          queryKey: ["friend-requests", "incoming"],
        });
      });

      socket.on("message.new", (data: MessageNewPayload) => {
        // Map the Kafka event shape to the Message schema shape
        const newMessage: Message = {
          id: data.messageId,
          conversationId: data.conversationId,
          senderId: data.senderId,
          content: data.content,
          type: data.type as "TEXT",
          status: "SENT",
          isDeleted: false,
          isEdited: false,
          reactions: [],
          createdAt: data.sentAt,
          updatedAt: data.sentAt,
        };

        // Prepend to the first page of messages cache for that conversation.
        // If the conversation was never opened, seed a first page so messages
        // appear instantly when the user clicks it (useInfiniteQuery will
        // refetch in background once mounted, since staleTime defaults to 0).
        queryClient.setQueryData<InfiniteData<MessageListResponse>>(
          ["messages", data.conversationId],
          (old) => {
            if (!old || !old.pages.length) {
              return {
                pages: [
                  { data: [newMessage], hasMore: false, nextCursor: undefined },
                ],
                pageParams: [undefined],
              };
            }
            // Guard against duplicates: the backend refetch may have already
            // placed this message in cache before the socket event arrives.
            const alreadyExists = old.pages.some((page) =>
              page.data?.some((msg) => msg.id === newMessage.id),
            );
            if (alreadyExists) return old;

            const newPages = [...old.pages];
            const firstPage = newPages[0];
            newPages[0] = {
              ...firstPage,
              data: [newMessage, ...(firstPage.data ?? [])],
            };
            return { ...old, pages: newPages };
          },
        );
        // Refresh conversation list to update order and unread counts
        queryClient.invalidateQueries({ queryKey: ["conversations"] });

        // Auto-read: if the conversation is currently open, mark it read immediately.
        // .getState() is used instead of the useChatStore hook because this runs
        // inside a socket event handler, not a component render cycle.
        const { activeConversationId } = useChatStore.getState();
        if (data.conversationId === activeConversationId) {
          chatService.markRead(data.conversationId).catch(() => {});
        }
      });

      socket.on("message.delivered", (data: MessageDeliveredPayload) => {
        queryClient.setQueryData<InfiniteData<MessageListResponse>>(
          ["messages", data.conversationId],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                data: (page.data ?? []).map((msg) =>
                  msg.senderId === data.senderId && msg.status === "SENT"
                    ? { ...msg, status: "DELIVERED" as const }
                    : msg,
                ),
              })),
            };
          },
        );
      });

      socket.on("message.read", (data: MessageReadPayload) => {
        queryClient.setQueryData<InfiniteData<MessageListResponse>>(
          ["messages", data.conversationId],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                data: (page.data ?? []).map((msg) =>
                  msg.senderId === data.senderId && msg.status !== "READ"
                    ? { ...msg, status: "READ" as const }
                    : msg,
                ),
              })),
            };
          },
        );
      });
    }

    return () => {
      // Socket stays alive across components — no disconnect on unmount
    };
  }, [queryClient]);
};
