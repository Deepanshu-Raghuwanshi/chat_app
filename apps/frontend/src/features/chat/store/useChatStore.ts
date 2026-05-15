import { create } from "zustand";
import type { Message } from "@shared-types";

interface ChatState {
  activeConversationId: string | null;
  draftMessages: Record<string, string>;
  replyTargets: Record<string, Message | null>;
  setActiveConversation: (id: string | null) => void;
  setDraft: (conversationId: string, text: string) => void;
  setReplyTarget: (conversationId: string, message: Message | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  draftMessages: {},
  replyTargets: {},
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setDraft: (conversationId, text) =>
    set((state) => ({
      draftMessages: { ...state.draftMessages, [conversationId]: text },
    })),
  setReplyTarget: (conversationId, message) =>
    set((state) => ({
      replyTargets: { ...state.replyTargets, [conversationId]: message },
    })),
}));
