import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
  InfiniteData,
} from "@tanstack/react-query";
import { usePresence } from "../../src/features/friends/hooks/usePresence";
import { Message, MessageListResponse } from "@shared-types";
import { chatService } from "../../src/features/chat/services/chat.service";
import { useChatStore } from "../../src/features/chat/store/useChatStore";

// Capture socket event handlers as they are registered so tests can trigger them
const socketHandlers: Record<string, (data: unknown) => void> = {};

const mockSocket = {
  on: vi.fn((event: string, handler: (data: unknown) => void) => {
    socketHandlers[event] = handler;
  }),
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

vi.mock("../../src/features/chat/services/chat.service", () => ({
  chatService: {
    markRead: vi
      .fn()
      .mockResolvedValue({ lastReadAt: new Date().toISOString() }),
  },
}));

vi.mock("../../src/features/chat/store/useChatStore", () => {
  const getState = vi.fn(() => ({
    activeConversationId: null as string | null,
    draftMessages: {} as Record<string, string>,
    setActiveConversation: vi.fn(),
    setDraft: vi.fn(),
  }));
  return { useChatStore: Object.assign(vi.fn(), { getState }) };
});

// Shared QueryClient — the hook's useEffect closure captures it on first mount.
// All tests set/read data on this same instance.
let sharedQueryClient: QueryClient;

function makeMessage(overrides: Partial<Message>): Message {
  return {
    id: "msg-1",
    conversationId: "conv-1",
    senderId: "user-a",
    content: "Hello",
    type: "TEXT",
    status: "SENT",
    isDeleted: false,
    reactions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function seedCache(messages: Message[], conversationId = "conv-1") {
  const data: InfiniteData<MessageListResponse> = {
    pages: [{ data: messages, hasMore: false, nextCursor: undefined }],
    pageParams: [undefined],
  };
  sharedQueryClient.setQueryData(["messages", conversationId], data);
}

function getCache(conversationId = "conv-1") {
  return sharedQueryClient.getQueryData<InfiniteData<MessageListResponse>>([
    "messages",
    conversationId,
  ]);
}

// Mount the hook once so the module-level socket singleton is created and all
// socket.on handlers are registered. Subsequent tests reuse the same handlers.
beforeAll(() => {
  sharedQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={sharedQueryClient}>
      {children}
    </QueryClientProvider>
  );
  renderHook(() => usePresence(), { wrapper: Wrapper });
});

beforeEach(() => {
  vi.clearAllMocks();
  sharedQueryClient.clear();
  // Reset useChatStore.getState to default (no active conversation) so tests
  // that don't override it get a clean baseline.
  vi.mocked(useChatStore.getState).mockReturnValue({
    activeConversationId: null,
    draftMessages: {},
    setActiveConversation: vi.fn(),
    setDraft: vi.fn(),
  });
  vi.mocked(chatService.markRead).mockResolvedValue({
    lastReadAt: new Date().toISOString(),
  });
});

describe("usePresence — message.delivered", () => {
  it("updates SENT messages from senderId to DELIVERED in the messages cache", () => {
    seedCache([makeMessage({ senderId: "user-a", status: "SENT" })]);

    act(() => {
      socketHandlers["message.delivered"]?.({
        conversationId: "conv-1",
        senderId: "user-a",
        recipientId: "user-b",
        deliveredAt: new Date().toISOString(),
      });
    });

    expect(getCache()?.pages[0].data[0].status).toBe("DELIVERED");
  });

  it("does not update messages that are already DELIVERED or READ", () => {
    seedCache([
      makeMessage({ id: "msg-1", senderId: "user-a", status: "DELIVERED" }),
      makeMessage({ id: "msg-2", senderId: "user-a", status: "READ" }),
    ]);

    act(() => {
      socketHandlers["message.delivered"]?.({
        conversationId: "conv-1",
        senderId: "user-a",
        recipientId: "user-b",
        deliveredAt: new Date().toISOString(),
      });
    });

    const updated = getCache();
    expect(updated?.pages[0].data[0].status).toBe("DELIVERED");
    expect(updated?.pages[0].data[1].status).toBe("READ");
  });
});

describe("usePresence — message.read", () => {
  it("updates both SENT and DELIVERED messages from senderId to READ in the messages cache", () => {
    seedCache([
      makeMessage({ id: "msg-1", senderId: "user-a", status: "SENT" }),
      makeMessage({ id: "msg-2", senderId: "user-a", status: "DELIVERED" }),
    ]);

    act(() => {
      socketHandlers["message.read"]?.({
        conversationId: "conv-1",
        senderId: "user-a",
        lastReadAt: new Date().toISOString(),
      });
    });

    const updated = getCache();
    expect(updated?.pages[0].data[0].status).toBe("READ");
    expect(updated?.pages[0].data[1].status).toBe("READ");
  });
});

describe("usePresence — message.new auto-read", () => {
  const newMessagePayload = {
    messageId: "msg-new",
    conversationId: "conv-1",
    senderId: "user-b",
    receiverId: "user-a",
    content: "Hi",
    type: "TEXT",
    sentAt: new Date().toISOString(),
  };

  it("calls chatService.markRead when the message arrives for the active conversation", () => {
    vi.mocked(useChatStore.getState).mockReturnValue({
      activeConversationId: "conv-1",
      draftMessages: {},
      setActiveConversation: vi.fn(),
      setDraft: vi.fn(),
    });

    act(() => {
      socketHandlers["message.new"]?.(newMessagePayload);
    });

    expect(chatService.markRead).toHaveBeenCalledWith("conv-1");
  });

  it("does not call chatService.markRead when the message arrives for an inactive conversation", () => {
    vi.mocked(useChatStore.getState).mockReturnValue({
      activeConversationId: "conv-2",
      draftMessages: {},
      setActiveConversation: vi.fn(),
      setDraft: vi.fn(),
    });

    act(() => {
      socketHandlers["message.new"]?.(newMessagePayload);
    });

    expect(chatService.markRead).not.toHaveBeenCalled();
  });
});
