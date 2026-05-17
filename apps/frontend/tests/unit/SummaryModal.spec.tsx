import React from "react";
import { screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SummaryModal } from "../../src/features/chat/components/SummaryModal";
import { renderWithIntl } from "../utils/render";

const baseProps = {
  isOpen: true,
  isLoading: false,
  isError: false,
  summary: undefined,
  onClose: vi.fn(),
  onRetry: vi.fn(),
};

describe("SummaryModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("visibility", () => {
    it("renders null when isOpen is false", () => {
      const { container } = renderWithIntl(
        <SummaryModal {...baseProps} isOpen={false} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders the modal when isOpen is true", () => {
      renderWithIntl(<SummaryModal {...baseProps} isLoading={true} />);
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
  });

  describe("loading state", () => {
    it("shows the loading label while isLoading is true", () => {
      renderWithIntl(<SummaryModal {...baseProps} isLoading={true} />);
      expect(screen.getByText("Summarizing…")).toBeTruthy();
    });
  });

  describe("error state", () => {
    it("shows the error message when isError is true", () => {
      renderWithIntl(<SummaryModal {...baseProps} isError={true} />);
      expect(
        screen.getByText("Could not generate summary. Please try again."),
      ).toBeTruthy();
    });

    it("shows the retry button when isError is true", () => {
      renderWithIntl(<SummaryModal {...baseProps} isError={true} />);
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    });

    it("calls onRetry when the retry button is clicked", () => {
      const onRetry = vi.fn();
      renderWithIntl(
        <SummaryModal {...baseProps} isError={true} onRetry={onRetry} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("success state", () => {
    const multiLineSummary =
      "• Bob asked if Alice is free this weekend.\n• Alice confirmed Saturday works.\n• They agreed to meet at 2 PM.";

    it("renders each bullet as a separate paragraph", () => {
      renderWithIntl(
        <SummaryModal {...baseProps} summary={multiLineSummary} />,
      );
      expect(
        screen.getByText("• Bob asked if Alice is free this weekend."),
      ).toBeTruthy();
      expect(
        screen.getByText("• Alice confirmed Saturday works."),
      ).toBeTruthy();
      expect(screen.getByText("• They agreed to meet at 2 PM.")).toBeTruthy();
    });

    it("filters out empty lines from the summary", () => {
      renderWithIntl(
        <SummaryModal
          {...baseProps}
          summary={"• First bullet.\n\n• Second bullet."}
        />,
      );
      const paragraphs = screen.getAllByText(/^•/);
      expect(paragraphs.length).toBe(2);
    });

    it("shows the Copy button in the success state", () => {
      renderWithIntl(
        <SummaryModal {...baseProps} summary="• A single bullet." />,
      );
      expect(screen.getByRole("button", { name: /copy/i })).toBeTruthy();
    });

    it("calls navigator.clipboard.writeText with the full summary on Copy click", async () => {
      const summary = "• First.\n• Second.";
      renderWithIntl(<SummaryModal {...baseProps} summary={summary} />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /copy/i }));
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(summary);
    });

    it("shows 'Copied!' for 2 seconds after copying, then reverts", async () => {
      // Only fake setTimeout so async act / Promise chains are unaffected
      vi.useFakeTimers({ toFake: ["setTimeout"] });

      renderWithIntl(<SummaryModal {...baseProps} summary="• A bullet." />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /copy/i }));
        await Promise.resolve();
      });

      expect(screen.getByText("Copied!")).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByText("Copied!")).toBeNull();
    });
  });

  describe("dismissal", () => {
    it("calls onClose when the X button is clicked", () => {
      const onClose = vi.fn();
      renderWithIntl(
        <SummaryModal {...baseProps} isLoading={true} onClose={onClose} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the backdrop is clicked", () => {
      const onClose = vi.fn();
      renderWithIntl(
        <SummaryModal {...baseProps} isLoading={true} onClose={onClose} />,
      );
      fireEvent.click(screen.getByRole("dialog"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when clicking inside the panel", () => {
      const onClose = vi.fn();
      renderWithIntl(
        <SummaryModal {...baseProps} summary="• A bullet." onClose={onClose} />,
      );
      fireEvent.click(screen.getByText("Chat Summary"));
      expect(onClose).not.toHaveBeenCalled();
    });

    it("calls onClose when Escape key is pressed", () => {
      const onClose = vi.fn();
      renderWithIntl(
        <SummaryModal {...baseProps} isLoading={true} onClose={onClose} />,
      );
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose on Escape when modal is closed", () => {
      const onClose = vi.fn();
      renderWithIntl(
        <SummaryModal {...baseProps} isOpen={false} onClose={onClose} />,
      );
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
