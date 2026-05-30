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
  it("prefers live tier DOM scroll over refs and layout", () => {
    const tier = document.createElement("div");
    Object.defineProperty(tier, "scrollLeft", { value: 480, configurable: true, writable: true });
    expect(
      resolveTierScrollLeftPx({
        tierScrollEl: tier,
        layoutScrollLeftPx: 40,
        liveScrollLeftRef: { current: 120 },
      }),
    ).toBe(480);
  });

  it("prefers live scroll ref over committed layout when DOM is unavailable", () => {
    expect(
      resolveTierScrollLeftPx({
        layoutScrollLeftPx: 40,
        liveScrollLeftRef: { current: 120 },
      }),
    ).toBe(120);
  });
});

describe("resolveTierViewportMetrics", () => {
  it("reads scrollLeft from tier DOM when present", () => {
    const tier = document.createElement("div");
    Object.defineProperty(tier, "scrollLeft", { value: 520, configurable: true, writable: true });
    Object.defineProperty(tier, "clientWidth", { value: 800, configurable: true });
    const metrics = resolveTierViewportMetrics({
      tierScrollEl: tier,
      tierScrollLive: {
        scrollLeftRef: { current: 240 },
        clientWidthRef: { current: 820 },
      },
      tierScrollLayout: { scrollLeftPx: 200, clientWidthPx: 780 },
    });
    expect(metrics.scrollLeftPx).toBe(520);
    expect(metrics.viewportWidthPx).toBe(820);
  });

  it("ignores unreliable DOM clientWidth when layout width is larger", () => {
    const tier = document.createElement("div");
    Object.defineProperty(tier, "scrollLeft", { value: 0, configurable: true, writable: true });
    Object.defineProperty(tier, "clientWidth", { value: 1, configurable: true });
    const metrics = resolveTierViewportMetrics({
      tierScrollEl: tier,
      tierScrollLive: {
        scrollLeftRef: { current: 0 },
        clientWidthRef: { current: 0 },
      },
      tierScrollLayout: { scrollLeftPx: 0, clientWidthPx: 960 },
    });
    expect(metrics.viewportWidthPx).toBe(960);
  });

  it("combines live scroll and viewport width reads when tier DOM is absent", () => {
    const metrics = resolveTierViewportMetrics({
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
