// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWaveformTimeRulerMetrics } from "./useWaveformTimeRulerMetrics";
import { flushTierScrollFrameForTests, resetTierScrollFrameCoordinatorForTests } from "../utils/tierScrollFrameCoordinator";

function makeTierScrollRef(input: { scrollLeft: number; clientWidth: number }) {
  const el = document.createElement("div");
  let scrollLeft = input.scrollLeft;
  Object.defineProperty(el, "scrollLeft", {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: input.clientWidth });
  return { current: el };
}

describe("useWaveformTimeRulerMetrics", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      return window.setTimeout(() => cb(0), 0);
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      window.clearTimeout(id);
    });
  });

  afterEach(() => {
    resetTierScrollFrameCoordinatorForTests();
    vi.unstubAllGlobals();
  });

  it("freezes tickLayerBaseScrollLeftPx until scroll window rebuilds", async () => {
    const tierScrollRef = makeTierScrollRef({ scrollLeft: 1000, clientWidth: 500 });

    const { result, rerender } = renderHook(
      (props: { currentTimeSec: number }) =>
        useWaveformTimeRulerMetrics({
          durationSec: 100,
          timelineWidthPx: 2000,
          tierScrollLayout: { scrollLeftPx: 1000, clientWidthPx: 500 },
          tierScrollRef,
          appearance: "embedded",
          coordinateSpace: "viewport",
          overlayOnWaveform: true,
          currentTimeSec: props.currentTimeSec,
        }),
      { initialProps: { currentTimeSec: 50 } },
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.tickLayerBaseScrollLeftPx).toBe(1000);
    expect(result.current.timelineToDisplayPx(50)).toBe(0);

    tierScrollRef.current.scrollLeft = 1020;
    flushTierScrollFrameForTests();

    expect(result.current.tickLayerBaseScrollLeftPx).toBe(1000);
    expect(result.current.timelineToDisplayPx(50)).toBe(0);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.tickLayerBaseScrollLeftPx).toBe(1020);
    expect(result.current.timelineToDisplayPx(50)).toBe(-20);

    rerender({ currentTimeSec: 51 });
    expect(result.current.tickLayerBaseScrollLeftPx).toBe(1020);
  });
});
