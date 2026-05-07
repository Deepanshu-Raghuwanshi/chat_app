import { create } from "zustand";

interface ChatState {
  activeConversationId: string | null;
  draftMessages: Record<string, string>;
  setActiveConversation: (id: string | null) => void;
  setDraft: (conversationId: string, text: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  draftMessages: {},
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setDraft: (conversationId, text) =>
    set((state) => ({
      draftMessages: { ...state.draftMessages, [conversationId]: text },
    })),
}));
