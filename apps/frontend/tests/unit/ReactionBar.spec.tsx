import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ReactionBar } from "../../src/features/chat/components/ReactionBar";
import { renderWithIntl } from "../utils/render";
import { simulate } from "../utils/simulate";
import { Reaction } from "@shared-types";

const makeReaction = (emoji: string, userId: string): Reaction => ({
  emoji,
  userId,
  createdAt: new Date().toISOString(),
});

describe("ReactionBar", () => {
  it("renders null when reactions array is empty", () => {
    const { container } = renderWithIntl(
      <ReactionBar reactions={[]} currentUserId="user-1" onToggle={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders grouped reaction with correct count", () => {
    const reactions = [
      makeReaction("👍", "user-1"),
      makeReaction("👍", "user-2"),
      makeReaction("❤️", "user-3"),
    ];

    renderWithIntl(
      <ReactionBar
        reactions={reactions}
        currentUserId="user-1"
        onToggle={vi.fn()}
      />,
    );

    const thumbsButton = screen.getByText("2");
    expect(thumbsButton).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("calls onToggle with the correct emoji when a reaction button is clicked", async () => {
    const onToggle = vi.fn();
    const reactions = [makeReaction("👍", "user-2")];

    renderWithIntl(
      <ReactionBar
        reactions={reactions}
        currentUserId="user-1"
        onToggle={onToggle}
      />,
    );

    const button = screen.getAllByRole("button")[0];
    await simulate.click(button);
    expect(onToggle).toHaveBeenCalledWith("👍");
  });

  it("applies mine ring styling when currentUserId has reacted with that emoji", () => {
    const reactions = [makeReaction("👍", "user-1")];

    renderWithIntl(
      <ReactionBar
        reactions={reactions}
        currentUserId="user-1"
        onToggle={vi.fn()}
      />,
    );

    const button = screen.getAllByRole("button")[0];
    expect(button.className).toContain("ring-1");
  });

  it("does not apply mine ring styling when currentUserId has not reacted", () => {
    const reactions = [makeReaction("👍", "user-2")];

    renderWithIntl(
      <ReactionBar
        reactions={reactions}
        currentUserId="user-1"
        onToggle={vi.fn()}
      />,
    );

    const button = screen.getAllByRole("button")[0];
    expect(button.className).not.toContain("ring-1");
  });

  it("renders one button per distinct emoji regardless of how many users reacted", () => {
    const reactions = [
      makeReaction("👍", "user-1"),
      makeReaction("👍", "user-2"),
      makeReaction("👍", "user-3"),
    ];

    renderWithIntl(
      <ReactionBar
        reactions={reactions}
        currentUserId="user-1"
        onToggle={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
  });
});
