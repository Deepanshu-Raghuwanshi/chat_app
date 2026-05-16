import { describe, it, expect, vi } from "vitest";
import {
  emitTypingStart,
  emitTypingStop,
} from "../../src/features/friends/hooks/usePresence";

// Prevent real network connections — socket.io-client is mocked but usePresence
// is never mounted, so the module-level `socket` variable stays null.
vi.mock("socket.io-client", () => ({ io: vi.fn() }));

describe("emitTypingStart / emitTypingStop — null socket (pre-mount)", () => {
  it("emitTypingStart is a no-op and does not throw when socket is null", () => {
    expect(() => emitTypingStart("conv-1")).not.toThrow();
  });

  it("emitTypingStop is a no-op and does not throw when socket is null", () => {
    expect(() => emitTypingStop("conv-1")).not.toThrow();
  });
});
