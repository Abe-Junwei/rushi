import { describe, expect, it, vi } from "vitest";
import {
  resetWaveSurferRendererClockSilenceForTests,
  silenceWaveSurferRendererClock,
} from "./silenceWaveSurferRendererClock";

describe("silenceWaveSurferRendererClock", () => {
  it("stops timer, noops start/updateProgress/renderProgress", () => {
    const stop = vi.fn();
    const start = vi.fn();
    const renderProgress = vi.fn();
    const renderer = { renderProgress };
    const ws = {
      getCurrentTime: () => 12.5,
      getRenderer: () => renderer,
      timer: { start, stop },
      updateProgress: vi.fn(() => 1),
    };
    expect(silenceWaveSurferRendererClock(ws as never)).toBe(true);
    expect(stop).toHaveBeenCalledTimes(1);
    ws.timer.start();
    expect(start).not.toHaveBeenCalled();
    const updateProgress = ws.updateProgress as (timeSec?: number) => number;
    expect(updateProgress(3)).toBe(3);
    expect(updateProgress()).toBe(12.5);
    renderer.renderProgress(0.5, true);
    expect(renderProgress).not.toHaveBeenCalled();
  });

  it("is idempotent per instance", () => {
    const stop = vi.fn();
    const ws = {
      getCurrentTime: () => 0,
      getRenderer: () => ({ renderProgress: vi.fn() }),
      timer: { start: vi.fn(), stop },
      updateProgress: vi.fn(),
    };
    expect(silenceWaveSurferRendererClock(ws as never)).toBe(true);
    expect(silenceWaveSurferRendererClock(ws as never)).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
    resetWaveSurferRendererClockSilenceForTests(ws as never);
    expect(silenceWaveSurferRendererClock(ws as never)).toBe(true);
    expect(stop).toHaveBeenCalledTimes(2);
  });
});
