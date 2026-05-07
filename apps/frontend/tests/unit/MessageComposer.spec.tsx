import React from "react";
import { screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageComposer } from "../../src/features/chat/components/MessageComposer";
import { renderWithIntl } from "../utils/render";
import { simulate } from "../utils/simulate";
import { useSendMessage } from "../../src/features/chat/hooks/useChat";
import { useChatStore } from "../../src/features/chat/store/useChatStore";

vi.mock("../../src/features/chat/hooks/useChat", () => ({
  useSendMessage: vi.fn(),
}));

describe("MessageComposer", () => {
  const mockSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({ draftMessages: {}, activeConversationId: null });
    vi.mocked(useSendMessage).mockReturnValue({
      mutate: mockSendMessage,
      isPending: false,
    } as unknown as ReturnType<typeof useSendMessage>);
  });

  it("send button is disabled when textarea is empty", () => {
    renderWithIntl(<MessageComposer conversationId="conv-1" />);
    const sendButton = screen.getByRole("button", { name: /send/i });
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls useSendMessage with trimmed content on submit", async () => {
    renderWithIntl(<MessageComposer conversationId="conv-2" />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    await simulate.type(textarea, "hello world");
    const sendButton = screen.getByRole("button", { name: /send/i });
    await simulate.click(sendButton);
    expect(mockSendMessage).toHaveBeenCalledWith(
      "hello world",
      expect.any(Object),
    );
  });

  it("clears input after successful send", async () => {
    let capturedOnSuccess: (() => void) | undefined;
    mockSendMessage.mockImplementation(
      (_content: string, options?: { onSuccess?: () => void }) => {
        capturedOnSuccess = options?.onSuccess;
      },
    );

    renderWithIntl(<MessageComposer conversationId="conv-3" />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    await simulate.type(textarea, "hello");

    const sendButton = screen.getByRole("button", { name: /send/i });
    await simulate.click(sendButton);

    expect(mockSendMessage).toHaveBeenCalled();

    act(() => {
      capturedOnSuccess?.();
    });

    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe("");
    });
  });
});
