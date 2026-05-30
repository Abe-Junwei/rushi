import { describe, expect, it } from "vitest";
import {
  resolveTierScrollLeftPx,
  resolveTierViewportMetrics,
  resolveTierViewportWidthPx,
} from "./waveformViewport";

describe("resolveTierViewportWidthPx", () => {
  it("returns the largest known viewport width", () => {
    expect(
      resolveTierViewportWidthPx({
        tierScrollEl: { clientWidth: 1200 } as HTMLElement,
        layoutClientWidthPx: 1100,
        liveClientWidthPx: 1400,
      }),
    ).toBe(1400);
  });

  it("falls back to layout width when live ref is unset", () => {
    expect(
      resolveTierViewportWidthPx({
        layoutClientWidthPx: 960,
      }),
    ).toBe(960);
  });
});

describe("resolveTierScrollLeftPx", () => {
  it("prefers live scroll ref over committed layout", () => {
    expect(
      resolveTierScrollLeftPx({
        layoutScrollLeftPx: 40,
        liveScrollLeftRef: { current: 120 },
      }),
    ).toBe(120);
  });
});

describe("resolveTierViewportMetrics", () => {
  it("combines live scroll and viewport width reads", () => {
    const metrics = resolveTierViewportMetrics({
      tierScrollEl: { clientWidth: 800 } as HTMLElement,
      tierScrollLive: {
        scrollLeftRef: { current: 240 },
        clientWidthRef: { current: 820 },
      },
      tierScrollLayout: { scrollLeftPx: 200, clientWidthPx: 780 },
    });
    expect(metrics.scrollLeftPx).toBe(240);
    expect(metrics.viewportWidthPx).toBe(820);
  });
});
