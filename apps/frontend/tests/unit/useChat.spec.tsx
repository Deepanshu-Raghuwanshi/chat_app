import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
  InfiniteData,
} from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../messages/en.json";
import { chatService } from "../../src/features/chat/services/chat.service";
import {
  useConversations,
  useSendMessage,
  useMarkRead,
} from "../../src/features/chat/hooks/useChat";
import { Conversation, Message, MessageListResponse } from "@shared-types";

vi.mock("../../src/features/chat/services/chat.service", () => ({
  chatService: {
    listConversations: vi.fn(),
    createOrGetConversation: vi.fn(),
    getConversation: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    markRead: vi.fn(),
  },
}));

vi.mock("../../src/shared/utils/toast", () => ({
  showToast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("../../src/features/auth/store/useAuthStore", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: vi.fn((selector: any) => selector({ user: { id: "user-1" } })),
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
  return { queryClient, Wrapper };
}

const mockConversation: Conversation = {
  id: "conv-1",
  participants: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockMessage: Message = {
  id: "msg-1",
  conversationId: "conv-1",
  senderId: "user-2",
  content: "Hello",
  type: "TEXT",
  status: "SENT",
  isDeleted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const emptyMessagesCache: InfiniteData<MessageListResponse> = {
  pages: [{ data: [], hasMore: false, nextCursor: undefined }],
  pageParams: [undefined],
};

const populatedMessagesCache: InfiniteData<MessageListResponse> = {
  pages: [{ data: [mockMessage], hasMore: false, nextCursor: undefined }],
  pageParams: [undefined],
};

describe("useConversations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated list and exposes fetchNextPage", async () => {
    vi.mocked(chatService.listConversations).mockResolvedValue({
      data: [mockConversation],
      hasMore: true,
      nextCursor: "cursor-123",
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useConversations(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages[0].data).toHaveLength(1);
    expect(result.current.data?.pages[0].data[0].id).toBe("conv-1");
    expect(typeof result.current.fetchNextPage).toBe("function");
  });
});

describe("useSendMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("optimistically appends message before request resolves", async () => {
    let resolveMessage!: (msg: Message) => void;
    vi.mocked(chatService.sendMessage).mockReturnValue(
      new Promise<Message>((resolve) => {
        resolveMessage = resolve;
      }),
    );

    const { queryClient, Wrapper } = makeWrapper();
    queryClient.setQueryData<InfiniteData<MessageListResponse>>(
      ["messages", "conv-1"],
      emptyMessagesCache,
    );

    const { result } = renderHook(() => useSendMessage("conv-1"), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate("hello optimistic");
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<
        InfiniteData<MessageListResponse>
      >(["messages", "conv-1"]);
      expect(cached?.pages[0].data).toHaveLength(1);
    });

    const cached = queryClient.getQueryData<InfiniteData<MessageListResponse>>([
      "messages",
      "conv-1",
    ]);
    expect(cached?.pages[0].data[0].content).toBe("hello optimistic");
    expect(cached?.pages[0].data[0].id).toMatch(/^optimistic-/);

    resolveMessage(mockMessage);
  });

  it("rolls back optimistic update on request failure", async () => {
    vi.mocked(chatService.sendMessage).mockRejectedValue(
      new Error("Network error"),
    );

    const { queryClient, Wrapper } = makeWrapper();
    queryClient.setQueryData<InfiniteData<MessageListResponse>>(
      ["messages", "conv-1"],
      populatedMessagesCache,
    );

    const { result } = renderHook(() => useSendMessage("conv-1"), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate("this will fail");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = queryClient.getQueryData<InfiniteData<MessageListResponse>>([
      "messages",
      "conv-1",
    ]);
    expect(cached?.pages[0].data).toHaveLength(1);
    expect(cached?.pages[0].data[0].id).toBe("msg-1");
  });

  it("invalidates conversations on success", async () => {
    vi.mocked(chatService.sendMessage).mockResolvedValue(mockMessage);

    const { queryClient, Wrapper } = makeWrapper();
    queryClient.setQueryData<InfiniteData<MessageListResponse>>(
      ["messages", "conv-1"],
      emptyMessagesCache,
    );

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSendMessage("conv-1"), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate("hello");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["conversations"] });
  });
});

describe("useMarkRead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalidates conversation and conversations on success", async () => {
    vi.mocked(chatService.markRead).mockResolvedValue({
      lastReadAt: new Date().toISOString(),
    });

    const { queryClient, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useMarkRead("conv-1"), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["conversation", "conv-1"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["conversations"] });
  });
});
