import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../../src/features/chat/store/useChatStore";

describe("useChatStore — setTyping", () => {
  beforeEach(() => {
    useChatStore.setState({ typingUsers: {} });
  });

  it("adds userId to typingUsers when isTyping is true", () => {
    useChatStore.getState().setTyping("conv-1", "user-a", true);
    expect(useChatStore.getState().typingUsers["conv-1"]).toEqual(["user-a"]);
  });

  it("does not add duplicate userId when setTyping(true) is called twice", () => {
    useChatStore.getState().setTyping("conv-1", "user-a", true);
    useChatStore.getState().setTyping("conv-1", "user-a", true);
    expect(useChatStore.getState().typingUsers["conv-1"]).toEqual(["user-a"]);
  });

  it("removes userId from typingUsers when isTyping is false", () => {
    useChatStore.getState().setTyping("conv-1", "user-a", true);
    useChatStore.getState().setTyping("conv-1", "user-a", false);
    expect(useChatStore.getState().typingUsers["conv-1"]).toEqual([]);
  });

  it("is a no-op (no error) when removing a userId that is not present", () => {
    useChatStore.getState().setTyping("conv-1", "user-a", false);
    expect(useChatStore.getState().typingUsers["conv-1"]).toEqual([]);
  });

  it("tracks multiple users typing in the same conversation", () => {
    useChatStore.getState().setTyping("conv-1", "user-a", true);
    useChatStore.getState().setTyping("conv-1", "user-b", true);
    expect(useChatStore.getState().typingUsers["conv-1"]).toEqual([
      "user-a",
      "user-b",
    ]);
  });

  it("keeps other conversations' typingUsers untouched when updating one", () => {
    useChatStore.getState().setTyping("conv-1", "user-a", true);
    useChatStore.getState().setTyping("conv-2", "user-b", true);
    expect(useChatStore.getState().typingUsers["conv-1"]).toEqual(["user-a"]);
    expect(useChatStore.getState().typingUsers["conv-2"]).toEqual(["user-b"]);
  });
});
