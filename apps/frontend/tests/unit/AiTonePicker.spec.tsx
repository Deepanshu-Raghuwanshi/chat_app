import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AiTonePicker } from "../../src/features/chat/components/AiTonePicker";
import { renderWithIntl } from "../utils/render";

describe("AiTonePicker", () => {
  it("renders all 5 tone buttons", () => {
    renderWithIntl(<AiTonePicker onSelect={vi.fn()} isLoading={false} />);
    expect(screen.getByRole("button", { name: /fix grammar/i })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /professional/i }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /casual/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /shorter/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /longer/i })).toBeTruthy();
  });

  it("disables all buttons while isLoading is true", () => {
    renderWithIntl(<AiTonePicker onSelect={vi.fn()} isLoading={true} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
    buttons.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it("calls onSelect with fix-grammar when Fix Grammar is clicked", () => {
    const onSelect = vi.fn();
    renderWithIntl(<AiTonePicker onSelect={onSelect} isLoading={false} />);
    fireEvent.click(screen.getByRole("button", { name: /fix grammar/i }));
    expect(onSelect).toHaveBeenCalledWith("fix-grammar");
  });

  it("calls onSelect with professional when Professional is clicked", () => {
    const onSelect = vi.fn();
    renderWithIntl(<AiTonePicker onSelect={onSelect} isLoading={false} />);
    fireEvent.click(screen.getByRole("button", { name: /professional/i }));
    expect(onSelect).toHaveBeenCalledWith("professional");
  });

  it("calls onSelect with casual when Casual is clicked", () => {
    const onSelect = vi.fn();
    renderWithIntl(<AiTonePicker onSelect={onSelect} isLoading={false} />);
    fireEvent.click(screen.getByRole("button", { name: /casual/i }));
    expect(onSelect).toHaveBeenCalledWith("casual");
  });

  it("calls onSelect with shorter when Shorter is clicked", () => {
    const onSelect = vi.fn();
    renderWithIntl(<AiTonePicker onSelect={onSelect} isLoading={false} />);
    fireEvent.click(screen.getByRole("button", { name: /shorter/i }));
    expect(onSelect).toHaveBeenCalledWith("shorter");
  });

  it("calls onSelect with longer when Longer is clicked", () => {
    const onSelect = vi.fn();
    renderWithIntl(<AiTonePicker onSelect={onSelect} isLoading={false} />);
    fireEvent.click(screen.getByRole("button", { name: /longer/i }));
    expect(onSelect).toHaveBeenCalledWith("longer");
  });

  it("does not call onSelect when a button is clicked while isLoading", () => {
    const onSelect = vi.fn();
    renderWithIntl(<AiTonePicker onSelect={onSelect} isLoading={true} />);
    fireEvent.click(screen.getByRole("button", { name: /professional/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
