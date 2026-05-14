import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ReactionPicker } from "../../src/features/chat/components/ReactionPicker";
import { renderWithIntl } from "../utils/render";
import { simulate } from "../utils/simulate";

vi.mock("../../src/features/chat/components/EmojiPickerPopover", () => ({
  EmojiPickerPopover: ({
    onEmojiSelect,
  }: {
    onEmojiSelect: (emoji: string) => void;
  }) => (
    <button
      data-testid="mock-emoji-popover"
      onClick={() => onEmojiSelect("🎉")}
    >
      Full Picker
    </button>
  ),
}));

const PRESET_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

describe("ReactionPicker", () => {
  it("renders all 6 preset emoji buttons", () => {
    renderWithIntl(<ReactionPicker onSelect={vi.fn()} />);

    for (const emoji of PRESET_EMOJIS) {
      expect(screen.getByText(emoji)).toBeTruthy();
    }
  });

  it("calls onSelect with the clicked preset emoji", async () => {
    const onSelect = vi.fn();
    renderWithIntl(<ReactionPicker onSelect={onSelect} />);

    const thumbsButton = screen.getByText("👍");
    await simulate.click(thumbsButton);

    expect(onSelect).toHaveBeenCalledWith("👍");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("full picker is hidden by default", () => {
    renderWithIntl(<ReactionPicker onSelect={vi.fn()} />);
    expect(screen.queryByTestId("mock-emoji-popover")).toBeNull();
  });

  it("clicking the + button reveals the full emoji picker", async () => {
    renderWithIntl(<ReactionPicker onSelect={vi.fn()} />);

    const moreButton = screen.getByRole("button", { name: /more/i });
    await simulate.click(moreButton);

    expect(screen.getByTestId("mock-emoji-popover")).toBeTruthy();
  });

  it("selecting from the full picker calls onSelect and closes the picker", async () => {
    const onSelect = vi.fn();
    renderWithIntl(<ReactionPicker onSelect={onSelect} />);

    const moreButton = screen.getByRole("button", { name: /more/i });
    await simulate.click(moreButton);

    const fullPickerButton = screen.getByTestId("mock-emoji-popover");
    await simulate.click(fullPickerButton);

    expect(onSelect).toHaveBeenCalledWith("🎉");
    expect(screen.queryByTestId("mock-emoji-popover")).toBeNull();
  });
});
