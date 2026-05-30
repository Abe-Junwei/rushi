import { describe, expect, it } from "vitest";
import { resolveTierViewportWidthPx } from "./waveformViewport";

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
