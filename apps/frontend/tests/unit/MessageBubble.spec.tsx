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
} from "../../src/features/chat/hooks/useChat";

vi.mock("../../src/features/chat/hooks/useChat", () => ({
  useEditMessage: vi.fn(),
  useDeleteMessage: vi.fn(),
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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("MessageBubble", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useEditMessage).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useEditMessage>);
    vi.mocked(useDeleteMessage).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteMessage>);
  });

  it("shows edit/delete menu only when isMine is true", async () => {
    const { unmount } = renderWithIntl(
      <MessageBubble message={mockMessage} isMine={false} />,
    );
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.queryByText("Delete")).toBeNull();
    unmount();

    renderWithIntl(<MessageBubble message={mockMessage} isMine={true} />);
    const menuTrigger = screen.getAllByRole("button")[0];
    await simulate.click(menuTrigger);
    expect(screen.getByText("Edit")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("renders [deleted] tombstone when isDeleted is true and hides edit/delete", () => {
    const deletedMessage = { ...mockMessage, isDeleted: true };
    renderWithIntl(<MessageBubble message={deletedMessage} isMine={true} />);
    expect(screen.getByText("[deleted]")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows (edited) label when isEdited is true", () => {
    const editedMessage = { ...mockMessage, isEdited: true };
    renderWithIntl(<MessageBubble message={editedMessage} isMine={false} />);
    expect(screen.getByText("(edited)")).toBeTruthy();
  });
});
