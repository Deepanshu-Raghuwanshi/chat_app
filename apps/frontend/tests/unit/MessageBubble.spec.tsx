import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageBubble } from "../../src/features/chat/components/MessageBubble";
import { Message } from "@shared-types";
import { renderWithIntl } from "../utils/render";
import { simulate } from "../utils/simulate";
import {
  useEditMessage,
  useDeleteMessage,
  useToggleReaction,
} from "../../src/features/chat/hooks/useChat";

vi.mock("../../src/features/chat/hooks/useChat", () => ({
  useEditMessage: vi.fn(),
  useDeleteMessage: vi.fn(),
  useToggleReaction: vi.fn(),
}));

const mockMessage: Message = {
  id: "msg-1",
  conversationId: "conv-1",
  senderId: "user-1",
  content: "Hello world",
  type: "TEXT",
  status: "SENT",
  isDeleted: false,
  isEdited: false,
  reactions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function setupMocks() {
  vi.mocked(useEditMessage).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useEditMessage>);
  vi.mocked(useDeleteMessage).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteMessage>);
}

describe("MessageBubble", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
    vi.mocked(useEditMessage).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useEditMessage>);
    vi.mocked(useDeleteMessage).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteMessage>);
    vi.mocked(useToggleReaction).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useToggleReaction>);
  });

  it("shows edit/delete menu only when isMine is true", async () => {
    const { unmount } = renderWithIntl(
      <MessageBubble
        message={mockMessage}
        isMine={false}
        conversationId="conv-1"
      />,
    );
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.queryByText("Delete")).toBeNull();
    unmount();

    renderWithIntl(
      <MessageBubble
        message={mockMessage}
        isMine={true}
        conversationId="conv-1"
      />,
    );
    const menuTrigger = screen.getAllByRole("button")[1];
    await simulate.click(menuTrigger);
    expect(screen.getByText("Edit")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("renders [deleted] tombstone when isDeleted is true and hides edit/delete", () => {
    const deletedMessage = { ...mockMessage, isDeleted: true };
    renderWithIntl(
      <MessageBubble
        message={deletedMessage}
        isMine={true}
        conversationId="conv-1"
      />,
    );
    expect(screen.getByText("[deleted]")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows (edited) label when isEdited is true", () => {
    const editedMessage = {
      ...mockMessage,
      isEdited: true,
      reactions: [
        { emoji: "👍", userId: "user-2", createdAt: new Date().toISOString() },
      ],
    };
    renderWithIntl(
      <MessageBubble
        message={editedMessage}
        isMine={false}
        conversationId="conv-1"
      />,
    );
    expect(screen.getByText("(edited)")).toBeTruthy();
  });
});

describe("MessageBubble status indicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("renders single Check icon when isMine is true and status is SENT", () => {
    const { container } = renderWithIntl(
      <MessageBubble
        message={{ ...mockMessage, status: "SENT" }}
        isMine={true}
        conversationId="conv-1"
      />,
    );
    // CheckCheck must be absent; Check must be present
    expect(container.querySelector("svg.lucide-check-check")).toBeNull();
    expect(container.querySelector("svg.lucide-check")).toBeTruthy();
  });

  it("renders double CheckCheck icon with grey color when isMine is true and status is DELIVERED", () => {
    const { container } = renderWithIntl(
      <MessageBubble
        message={{ ...mockMessage, status: "DELIVERED" }}
        isMine={true}
        conversationId="conv-1"
      />,
    );
    const icon = container.querySelector("svg.lucide-check-check");
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("class")).toContain("text-foreground/40");
  });

  it("renders double CheckCheck icon with blue color when isMine is true and status is READ", () => {
    const { container } = renderWithIntl(
      <MessageBubble
        message={{ ...mockMessage, status: "READ" }}
        isMine={true}
        conversationId="conv-1"
      />,
    );
    const icon = container.querySelector("svg.lucide-check-check");
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("class")).toContain("text-blue-500");
  });

  it("renders no status indicator when isMine is false", () => {
    const { container } = renderWithIntl(
      <MessageBubble message={mockMessage} isMine={false} conversationId="conv-1" />,
    );
    expect(container.querySelector("svg.lucide-check")).toBeNull();
    expect(container.querySelector("svg.lucide-check-check")).toBeNull();
  });

  it("renders no status indicator when message is deleted", () => {
    const { container } = renderWithIntl(
      <MessageBubble
        message={{ ...mockMessage, isDeleted: true }}
        isMine={true}
        conversationId="conv-1"
      />,
    );
    expect(container.querySelector("svg.lucide-check")).toBeNull();
    expect(container.querySelector("svg.lucide-check-check")).toBeNull();
  });
});
