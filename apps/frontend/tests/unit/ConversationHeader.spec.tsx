import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConversationHeader } from "../../src/features/chat/components/ConversationHeader";
import { renderWithIntl } from "../utils/render";
import { useChatStore } from "../../src/features/chat/store/useChatStore";
import { useAuthStore } from "../../src/features/auth/store/useAuthStore";
import type { Conversation, UserProfile } from "@shared-types";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

const currentUserId = "user-me";
const otherUserId = "user-other";

const conversation: Conversation = {
  id: "conv-1",
  participants: [
    { userId: currentUserId, username: "me" },
    {
      userId: otherUserId,
      username: "other",
      fullName: "Other User",
      isOnline: true,
    },
  ],
  unreadCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const offlineConversation: Conversation = {
  ...conversation,
  participants: [
    { userId: currentUserId, username: "me" },
    {
      userId: otherUserId,
      username: "other",
      fullName: "Other User",
      isOnline: false,
    },
  ],
};

describe("ConversationHeader — typing indicator", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: currentUserId } as UserProfile });
    useChatStore.setState({ typingUsers: {} });
  });

  it("renders 'typing…' when the other participant is typing", () => {
    useChatStore.setState({ typingUsers: { "conv-1": [otherUserId] } });
    renderWithIntl(
      <ConversationHeader
        conversation={conversation}
        conversationId="conv-1"
      />,
    );
    expect(screen.getByText("typing…")).toBeTruthy();
  });

  it("does not render 'typing…' when typingUsers is empty", () => {
    renderWithIntl(
      <ConversationHeader
        conversation={conversation}
        conversationId="conv-1"
      />,
    );
    expect(screen.queryByText("typing…")).toBeNull();
  });

  it("renders 'Online' when the other participant is online and not typing", () => {
    renderWithIntl(
      <ConversationHeader
        conversation={conversation}
        conversationId="conv-1"
      />,
    );
    expect(screen.getByText("Online")).toBeTruthy();
  });

  it("renders 'Offline' when the other participant is offline and not typing", () => {
    renderWithIntl(
      <ConversationHeader
        conversation={offlineConversation}
        conversationId="conv-1"
      />,
    );
    expect(screen.getByText("Offline")).toBeTruthy();
  });

  it("shows 'typing…' instead of 'Online' even when the other participant is online", () => {
    useChatStore.setState({ typingUsers: { "conv-1": [otherUserId] } });
    renderWithIntl(
      <ConversationHeader
        conversation={conversation}
        conversationId="conv-1"
      />,
    );
    expect(screen.getByText("typing…")).toBeTruthy();
    expect(screen.queryByText("Online")).toBeNull();
  });

  it("does not show typing indicator for a different conversation", () => {
    useChatStore.setState({ typingUsers: { "conv-other": [otherUserId] } });
    renderWithIntl(
      <ConversationHeader
        conversation={conversation}
        conversationId="conv-1"
      />,
    );
    expect(screen.queryByText("typing…")).toBeNull();
  });
});
