import { afterEach, describe, expect, it, vi } from "vitest";
import {
  flushTierScrollFrame,
  flushTierScrollFrameForTests,
  registerTierScrollFrameMetricsSupplier,
  resetTierScrollFrameCoordinatorForTests,
  schedulePlaybackViewportFrame,
  scheduleTierScrollFrame,
  subscribePlaybackFrame,
  subscribeTierScrollFrame,
} from "./tierScrollFrameCoordinator";

describe("tierScrollFrameCoordinator", () => {
  afterEach(() => {
    resetTierScrollFrameCoordinatorForTests();
    vi.unstubAllGlobals();
  });

  it("runs playback subscribers before scroll subscribers in one frame", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    const order: string[] = [];
    subscribePlaybackFrame(() => order.push("playback"));
    subscribeTierScrollFrame(() => order.push("scroll"));

    schedulePlaybackViewportFrame(3.5);
    expect(order).toEqual(["playback", "scroll"]);
  });

  it("does not coalesce away playback viewport frames when scroll is unchanged", () => {
    const rafQueue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    registerTierScrollFrameMetricsSupplier(() => ({
      scrollLeftPx: 100,
      viewportWidthPx: 800,
    }));

    const playback = vi.fn();
    subscribePlaybackFrame(playback);

    scheduleTierScrollFrame();
    schedulePlaybackViewportFrame(4.2);
    for (const cb of rafQueue) cb(0);

    expect(playback).toHaveBeenCalledTimes(1);
    expect(playback).toHaveBeenCalledWith(4.2);
  });

  it("coalesces multiple schedule calls into one rAF frame", () => {
    const rafQueue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });

    const a = vi.fn();
    const b = vi.fn();
    subscribeTierScrollFrame(a);
    subscribeTierScrollFrame(b);

    scheduleTierScrollFrame();
    scheduleTierScrollFrame();
    scheduleTierScrollFrame();
    for (const cb of rafQueue) cb(0);

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

  it("flushTierScrollFrame force bypasses 12ms scroll coalesce", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    registerTierScrollFrameMetricsSupplier(() => ({
      scrollLeftPx: 100,
      viewportWidthPx: 800,
    }));

    const paint = vi.fn();
    subscribeTierScrollFrame(paint);
    scheduleTierScrollFrame();
    expect(paint).toHaveBeenCalledTimes(1);

    scheduleTierScrollFrame();
    expect(paint).toHaveBeenCalledTimes(1);

    flushTierScrollFrame({ force: true });
    expect(paint).toHaveBeenCalledTimes(2);
  });
});
