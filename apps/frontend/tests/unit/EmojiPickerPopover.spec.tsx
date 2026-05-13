import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EmojiPickerPopover } from "../../src/features/chat/components/EmojiPickerPopover";
import { renderWithIntl } from "../utils/render";
import { simulate } from "../utils/simulate";

vi.mock("next/dynamic", () => ({
  default: () => {
    function MockEmojiMartPicker({
      onEmojiSelect,
    }: {
      onEmojiSelect: (emoji: { native: string }) => void;
    }) {
      return (
        <button
          data-testid="emoji-mart-picker"
          onClick={() => onEmojiSelect({ native: "👍" })}
        >
          Select 👍
        </button>
      );
    }
    return MockEmojiMartPicker;
  },
}));

vi.mock("@emoji-mart/data", () => ({ default: { emojis: {} } }));

describe("EmojiPickerPopover", () => {
  it("calls onEmojiSelect with the correct emoji string when an emoji is clicked", async () => {
    const onEmojiSelect = vi.fn();
    renderWithIntl(<EmojiPickerPopover onEmojiSelect={onEmojiSelect} />);

    await waitFor(() =>
      expect(screen.queryByTestId("emoji-mart-picker")).toBeTruthy(),
    );

    await simulate.click(screen.getByTestId("emoji-mart-picker"));

    expect(onEmojiSelect).toHaveBeenCalledTimes(1);
    expect(onEmojiSelect).toHaveBeenCalledWith("👍");
  });
});
