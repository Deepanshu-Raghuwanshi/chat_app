import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { ThemePreferenceSection } from "../../src/features/profile/components/ThemePreferenceSection";
import { renderWithIntl } from "../utils/render";
import { simulate } from "../utils/simulate";
import { useThemeStore } from "../../src/shared/store/useThemeStore";
import { useProfile } from "../../src/features/profile/hooks/useProfile";

vi.mock("../../src/shared/store/useThemeStore");
vi.mock("../../src/features/profile/hooks/useProfile");

describe("ThemePreferenceSection", () => {
  const mockSetTheme = vi.fn();
  const mockUpdateTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useProfile).mockReturnValue({
      updateTheme: mockUpdateTheme,
    } as unknown as ReturnType<typeof useProfile>);
  });

  it("applies border-primary class to the currently active mode button only", () => {
    vi.mocked(useThemeStore).mockReturnValue({
      theme: "dark",
      setTheme: mockSetTheme,
    } as unknown as ReturnType<typeof useThemeStore>);

    renderWithIntl(<ThemePreferenceSection />);

    const darkButton = screen.getByRole("button", { name: /dark/i });
    const lightButton = screen.getByRole("button", { name: /light/i });

    // Active button gets bg-primary/10; inactive button gets bg-secondary
    expect(darkButton.className).toContain("bg-primary/10");
    expect(lightButton.className).toContain("bg-secondary");
  });

  it("clicking the already-active mode is a no-op — no setTheme or updateTheme called", async () => {
    vi.mocked(useThemeStore).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    } as unknown as ReturnType<typeof useThemeStore>);

    renderWithIntl(<ThemePreferenceSection />);

    await simulate.click(screen.getByRole("button", { name: /light/i }));

    expect(mockSetTheme).not.toHaveBeenCalled();
    expect(mockUpdateTheme).not.toHaveBeenCalled();
  });

  it("clicking the opposite mode calls setTheme and updateTheme with the new mode", async () => {
    vi.mocked(useThemeStore).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    } as unknown as ReturnType<typeof useThemeStore>);

    renderWithIntl(<ThemePreferenceSection />);

    await simulate.click(screen.getByRole("button", { name: /dark/i }));

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
    expect(mockUpdateTheme).toHaveBeenCalledWith("dark");
  });
});
