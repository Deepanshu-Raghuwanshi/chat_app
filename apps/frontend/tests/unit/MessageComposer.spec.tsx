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

vi.mock("../../src/features/chat/components/EmojiPickerPopover", () => ({
  EmojiPickerPopover: ({
    onEmojiSelect,
  }: {
    onEmojiSelect: (emoji: string) => void;
  }) => (
    <button data-testid="mock-emoji-picker" onClick={() => onEmojiSelect("👍")}>
      Mock Picker
    </button>
  ),
}));

describe("MessageComposer", () => {
  const mockSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      draftMessages: {},
      activeConversationId: null,
      replyTargets: {},
    });
    vi.mocked(useSendMessage).mockReturnValue({
      mutate: mockSendMessage,
      isPending: false,
    } as unknown as ReturnType<typeof useSendMessage>);
  });

  it("send button is disabled when textarea is empty", () => {
    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-1" />,
    );
    const sendButton = screen.getByRole("button", { name: /send/i });
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls useSendMessage with trimmed content on submit", async () => {
    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-2" />,
    );
    const textarea = screen.getByPlaceholderText("Type a message...");
    await simulate.type(textarea, "hello world");
    const sendButton = screen.getByRole("button", { name: /send/i });
    await simulate.click(sendButton);
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: "hello world" }),
      expect.any(Object),
    );
  });

  it("clears input after successful send", async () => {
    let capturedOnSuccess: (() => void) | undefined;
    mockSendMessage.mockImplementation(
      (
        _vars: { content: string; quotedMessageId?: string },
        options?: { onSuccess?: () => void },
      ) => {
        capturedOnSuccess = options?.onSuccess;
      },
    );

    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-3" />,
    );
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

  it("emoji button renders and is accessible via aria-label", () => {
    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-1" />,
    );
    expect(
      screen.queryByRole("button", { name: /open emoji picker/i }),
    ).toBeTruthy();
  });

  it("clicking the emoji button opens the picker", async () => {
    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-1" />,
    );
    const emojiButton = screen.getByRole("button", {
      name: /open emoji picker/i,
    });
    await simulate.click(emojiButton);
    expect(screen.queryByTestId("mock-emoji-picker")).toBeTruthy();
  });

  it("clicking the emoji button again closes the picker", async () => {
    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-1" />,
    );
    const emojiButton = screen.getByRole("button", {
      name: /open emoji picker/i,
    });
    await simulate.click(emojiButton);
    expect(screen.queryByTestId("mock-emoji-picker")).toBeTruthy();
    await simulate.click(emojiButton);
    expect(screen.queryByTestId("mock-emoji-picker")).toBeNull();
  });

  it("selecting an emoji appends it to the draft when the composer is empty", async () => {
    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-emoji" />,
    );
    const emojiButton = screen.getByRole("button", {
      name: /open emoji picker/i,
    });
    await simulate.click(emojiButton);
    await simulate.click(screen.getByTestId("mock-emoji-picker"));

    const draft = useChatStore.getState().draftMessages["conv-emoji"];
    expect(draft).toBe("👍");
  });

  it("selecting an emoji inserts it at the cursor position when cursor is mid-text", async () => {
    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-cursor" />,
    );
    const textarea = screen.getByPlaceholderText("Type a message...");

    await simulate.type(textarea, "helloworld");

    act(() => {
      (textarea as HTMLTextAreaElement).setSelectionRange(5, 5);
    });

    const emojiButton = screen.getByRole("button", {
      name: /open emoji picker/i,
    });
    await simulate.click(emojiButton);
    await simulate.click(screen.getByTestId("mock-emoji-picker"));

    const draft = useChatStore.getState().draftMessages["conv-cursor"];
    expect(draft).toBe("hello👍world");
  });

  it("closes the emoji picker when clicking outside the emoji area", async () => {
    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-1" />,
    );
    const emojiButton = screen.getByRole("button", {
      name: /open emoji picker/i,
    });
    await simulate.click(emojiButton);
    expect(screen.queryByTestId("mock-emoji-picker")).toBeTruthy();

    await simulate.click(document.body);
    expect(screen.queryByTestId("mock-emoji-picker")).toBeNull();
  });
});

describe("MessageComposer reply strip", () => {
  const mockReplyTarget = {
    id: "msg-quoted-1",
    conversationId: "conv-1",
    senderId: "user-2",
    content: "The message being quoted",
    type: "TEXT" as const,
    status: "SENT" as const,
    isDeleted: false,
    isEdited: false,
    reactions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      draftMessages: {},
      activeConversationId: null,
      replyTargets: {},
    });
    vi.mocked(useSendMessage).mockReturnValue({
      mutate: mockSendMessage,
      isPending: false,
    } as unknown as ReturnType<typeof useSendMessage>);
  });

  it("shows reply strip when replyTarget is set in store", () => {
    useChatStore.setState({ replyTargets: { "conv-strip": mockReplyTarget } });
    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-strip" />,
    );
    expect(screen.getByText("The message being quoted")).toBeTruthy();
    expect(screen.getByRole("button", { name: /cancel reply/i })).toBeTruthy();
  });

  it("does not show reply strip when replyTarget is null", () => {
    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-no-strip" />,
    );
    expect(screen.queryByRole("button", { name: /cancel reply/i })).toBeNull();
  });

  it("cancel button clears replyTarget in store", async () => {
    useChatStore.setState({ replyTargets: { "conv-cancel": mockReplyTarget } });
    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-cancel" />,
    );
    const cancelButton = screen.getByRole("button", { name: /cancel reply/i });
    await simulate.click(cancelButton);
    expect(useChatStore.getState().replyTargets["conv-cancel"]).toBeNull();
  });

  it("send includes quotedMessageId when replyTarget is set", async () => {
    useChatStore.setState({ replyTargets: { "conv-qid": mockReplyTarget } });
    renderWithIntl(
      <MessageComposer participants={[]} conversationId="conv-qid" />,
    );
    const textarea = screen.getByPlaceholderText("Type a message...");
    await simulate.type(textarea, "my reply");
    const sendButton = screen.getByRole("button", { name: /send/i });
    await simulate.click(sendButton);
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "my reply",
        quotedMessageId: "msg-quoted-1",
      }),
      expect.any(Object),
    );
  });
});
