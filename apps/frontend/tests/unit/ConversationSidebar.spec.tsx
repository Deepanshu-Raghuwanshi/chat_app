import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConversationSidebar } from "../../src/features/chat/components/ConversationSidebar";
import { renderWithIntl } from "../utils/render";
import { simulate } from "../utils/simulate";
import {
  useConversations,
  useSearchConversations,
} from "../../src/features/chat/hooks/useChat";
import { useChatStore } from "../../src/features/chat/store/useChatStore";
import { useAuthStore } from "../../src/features/auth/store/useAuthStore";
import { Conversation } from "@shared-types";

vi.mock("../../src/features/chat/hooks/useChat", () => ({
  useConversations: vi.fn(),
  useSearchConversations: vi.fn(),
}));

vi.mock("../../src/features/chat/store/useChatStore", () => ({
  useChatStore: vi.fn(),
}));

vi.mock("../../src/features/auth/store/useAuthStore", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: vi.fn((selector: any) => selector({ user: { id: "user-1" } })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

const mockConversation: Conversation = {
  id: "conv-1",
  participants: [
    { userId: "user-1", username: "me" },
    {
      userId: "user-2",
      username: "friend",
      fullName: "Friend User",
      isOnline: false,
    },
  ],
  unreadCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const fetchNextPage = vi.fn();

function setupNormalMode() {
  vi.mocked(useConversations).mockReturnValue({
    data: {
      pages: [{ data: [mockConversation], hasMore: false }],
      pageParams: [undefined],
    },
    isLoading: false,
    fetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
  } as unknown as ReturnType<typeof useConversations>);

  vi.mocked(useSearchConversations).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as unknown as ReturnType<typeof useSearchConversations>);
}

describe("ConversationSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useChatStore).mockImplementation((selector: any) =>
      selector({ activeConversationId: null, setActiveConversation: vi.fn() }),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useAuthStore).mockImplementation((selector: any) =>
      selector({ user: { id: "user-1" } }),
    );
  });

  it("renders search input with placeholder text", () => {
    setupNormalMode();
    renderWithIntl(<ConversationSidebar />);
    expect(screen.getByPlaceholderText("Search conversations...")).toBeTruthy();
  });

  it("does not show × button when search input is empty", () => {
    setupNormalMode();
    renderWithIntl(<ConversationSidebar />);
    expect(screen.queryByRole("button", { name: /clear search/i })).toBeNull();
  });

  it("shows × button when input has text and clicking it clears the input", async () => {
    setupNormalMode();
    renderWithIntl(<ConversationSidebar />);

    const input = screen.getByPlaceholderText("Search conversations...");
    await simulate.type(input, "john");

    const clearBtn = screen.getByRole("button", { name: /clear search/i });
    expect(clearBtn).toBeTruthy();

    await simulate.click(clearBtn);
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("button", { name: /clear search/i })).toBeNull();
  });

  it("shows Spinner while useSearchConversations is loading", async () => {
    vi.mocked(useConversations).mockReturnValue({
      data: undefined,
      isLoading: false,
      fetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
    } as unknown as ReturnType<typeof useConversations>);

    vi.mocked(useSearchConversations).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useSearchConversations>);

    renderWithIntl(<ConversationSidebar />);
    const input = screen.getByPlaceholderText("Search conversations...");
    await simulate.type(input, "john");

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeTruthy();
    });
  });

  it("shows no-results message when search returns an empty array", async () => {
    vi.mocked(useConversations).mockReturnValue({
      data: undefined,
      isLoading: false,
      fetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
    } as unknown as ReturnType<typeof useConversations>);

    vi.mocked(useSearchConversations).mockReturnValue({
      data: { data: [], hasMore: false },
      isLoading: false,
    } as unknown as ReturnType<typeof useSearchConversations>);

    renderWithIntl(<ConversationSidebar />);
    const input = screen.getByPlaceholderText("Search conversations...");
    await simulate.type(input, "nobody");

    await waitFor(() => {
      expect(screen.getByText(/No conversations found for/)).toBeTruthy();
    });
  });

  it("renders ConversationList with search results when results are present", async () => {
    vi.mocked(useConversations).mockReturnValue({
      data: undefined,
      isLoading: false,
      fetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
    } as unknown as ReturnType<typeof useConversations>);

    vi.mocked(useSearchConversations).mockReturnValue({
      data: { data: [mockConversation], hasMore: false },
      isLoading: false,
    } as unknown as ReturnType<typeof useSearchConversations>);

    renderWithIntl(<ConversationSidebar />);
    const input = screen.getByPlaceholderText("Search conversations...");
    await simulate.type(input, "friend");

    await waitFor(() => {
      expect(screen.queryByText(/No conversations found for/)).toBeNull();
      expect(screen.queryByText("No conversations yet")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.getByText("Friend User")).toBeTruthy();
    });
  });

  it("does not call fetchNextPage when in search mode", async () => {
    vi.mocked(useConversations).mockReturnValue({
      data: {
        pages: [{ data: [mockConversation], hasMore: false }],
        pageParams: [undefined],
      },
      isLoading: false,
      fetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: false,
    } as unknown as ReturnType<typeof useConversations>);

    vi.mocked(useSearchConversations).mockReturnValue({
      data: { data: [mockConversation], hasMore: false },
      isLoading: false,
    } as unknown as ReturnType<typeof useSearchConversations>);

    renderWithIntl(<ConversationSidebar />);
    const input = screen.getByPlaceholderText("Search conversations...");
    await simulate.type(input, "friend");

    await waitFor(() => {
      expect(fetchNextPage).not.toHaveBeenCalled();
    });
  });
});
