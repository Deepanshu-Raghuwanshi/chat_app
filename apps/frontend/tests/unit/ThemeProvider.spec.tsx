import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ThemeProvider } from "../../src/shared/providers/ThemeProvider";
import { useAuthStore } from "../../src/features/auth/store/useAuthStore";
import { useThemeStore } from "../../src/shared/store/useThemeStore";

vi.mock("../../src/features/auth/store/useAuthStore");
vi.mock("../../src/shared/store/useThemeStore");

describe("ThemeProvider", () => {
  const mockSetTheme = vi.fn();

  const mockStoreWith = (theme: "light" | "dark") => {
    const state = { theme, setTheme: mockSetTheme };
    // Apply the selector so useThemeStore((s) => s.setTheme) returns the function, not the whole object
    vi.mocked(useThemeStore).mockImplementation(
      (selector?: (s: typeof state) => unknown) =>
        selector ? selector(state) : (state as unknown),
    );
    Object.assign(vi.mocked(useThemeStore), {
      getState: vi.fn().mockReturnValue(state),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls setTheme with dark when user.theme is dark and current store theme is light", () => {
    vi.mocked(useAuthStore).mockReturnValue({
      theme: "dark",
      id: "user-1",
    } as unknown as ReturnType<typeof useAuthStore>);
    mockStoreWith("light");

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("does not call setTheme when user.theme matches the current store theme", () => {
    vi.mocked(useAuthStore).mockReturnValue({
      theme: "light",
      id: "user-1",
    } as unknown as ReturnType<typeof useAuthStore>);
    mockStoreWith("light");

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    expect(mockSetTheme).not.toHaveBeenCalled();
  });

  it("does not call setTheme when user is null (logout)", () => {
    vi.mocked(useAuthStore).mockReturnValue(
      null as unknown as ReturnType<typeof useAuthStore>,
    );
    mockStoreWith("dark");

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    expect(mockSetTheme).not.toHaveBeenCalled();
  });
});
