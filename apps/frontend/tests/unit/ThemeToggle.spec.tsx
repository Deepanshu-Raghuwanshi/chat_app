import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { ThemeToggle } from "../../src/shared/components/ThemeToggle";
import { renderWithIntl } from "../utils/render";
import { simulate } from "../utils/simulate";
import { useThemeStore } from "../../src/shared/store/useThemeStore";

vi.mock("../../src/shared/store/useThemeStore");

describe("ThemeToggle", () => {
  const mockSetTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Moon icon (switch to dark mode) when theme is light", () => {
    vi.mocked(useThemeStore).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    } as unknown as ReturnType<typeof useThemeStore>);

    renderWithIntl(<ThemeToggle />);

    expect(
      screen.getByRole("button", { name: /switch to dark mode/i }),
    ).toBeTruthy();
  });

  it("renders Sun icon (switch to light mode) when theme is dark", () => {
    vi.mocked(useThemeStore).mockReturnValue({
      theme: "dark",
      setTheme: mockSetTheme,
    } as unknown as ReturnType<typeof useThemeStore>);

    renderWithIntl(<ThemeToggle />);

    expect(
      screen.getByRole("button", { name: /switch to light mode/i }),
    ).toBeTruthy();
  });

  it("calls setTheme with opposite mode and fires onToggle callback when clicked", async () => {
    vi.mocked(useThemeStore).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    } as unknown as ReturnType<typeof useThemeStore>);
    const onToggle = vi.fn();

    renderWithIntl(<ThemeToggle onToggle={onToggle} />);

    await simulate.click(
      screen.getByRole("button", { name: /switch to dark mode/i }),
    );

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
    expect(onToggle).toHaveBeenCalledWith("dark");
  });
});
