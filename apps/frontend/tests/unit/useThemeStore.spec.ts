import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore } from "../../src/shared/store/useThemeStore";

describe("useThemeStore", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "light" });
    document.documentElement.classList.remove("dark");
  });

  it("has initial state of light", () => {
    expect(useThemeStore.getState().theme).toBe("light");
  });

  it('setTheme("dark") sets state to dark and adds .dark class to documentElement', () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it('setTheme("light") sets state to light and removes .dark class from documentElement', () => {
    document.documentElement.classList.add("dark");
    useThemeStore.getState().setTheme("light");
    expect(useThemeStore.getState().theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
