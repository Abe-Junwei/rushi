import { afterEach, describe, expect, it, vi } from "vitest";
import {
  flushTierScrollFrameForTests,
  resetTierScrollFrameCoordinatorForTests,
  scheduleTierScrollFrame,
  subscribeTierScrollFrame,
} from "./tierScrollFrameCoordinator";

describe("tierScrollFrameCoordinator", () => {
  afterEach(() => {
    resetTierScrollFrameCoordinatorForTests();
    vi.unstubAllGlobals();
  });

  it("coalesces multiple schedule calls into one rAF frame", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    const a = vi.fn();
    const b = vi.fn();
    subscribeTierScrollFrame(a);
    subscribeTierScrollFrame(b);

    scheduleTierScrollFrame();
    scheduleTierScrollFrame();
    scheduleTierScrollFrame();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("flushTierScrollFrameForTests runs pending subscribers synchronously", () => {
    let rafCb: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 7;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const paint = vi.fn();
    subscribeTierScrollFrame(paint);
    scheduleTierScrollFrame();
    expect(paint).not.toHaveBeenCalled();

    flushTierScrollFrameForTests();
    expect(paint).toHaveBeenCalledTimes(1);
    expect(rafCb).not.toBeNull();
  });
});
