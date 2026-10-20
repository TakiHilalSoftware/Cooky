import { afterEach, describe, expect, it, vi } from "vitest";

import { haptic } from "./haptics";

afterEach(() => vi.unstubAllGlobals());

describe("haptic", () => {
  it("buzzes briefly for a tap and twice for a success", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    haptic();
    haptic("success");
    expect(vibrate).toHaveBeenNthCalledWith(1, 10);
    expect(vibrate).toHaveBeenNthCalledWith(2, [12, 60, 24]);
  });

  it("does nothing where vibration is missing or refused", () => {
    vi.stubGlobal("navigator", {});
    expect(() => haptic()).not.toThrow();
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("not allowed");
      },
    });
    expect(() => haptic("success")).not.toThrow();
  });
});
