import { describe, expect, it } from "vitest";
import { clampWaveformScrollLeftPx, remapWaveformScrollLeftPx } from "./waveformZoomScroll";

describe("waveformZoomScroll", () => {
  it("clamps scroll to timeline width minus viewport", () => {
    expect(
      clampWaveformScrollLeftPx({
        scrollLeftPx: 5000,
        pxPerSec: 56,
        durationSec: 10,
        viewportWidthPx: 800,
      }),
    ).toBe(0);

    expect(
      clampWaveformScrollLeftPx({
        scrollLeftPx: 5000,
        pxPerSec: 112,
        durationSec: 10,
        viewportWidthPx: 800,
      }),
    ).toBe(320);
  });

  it("remaps scroll to preserve viewport center time when px/s changes", () => {
    expect(
      remapWaveformScrollLeftPx({
        scrollLeftPx: 400,
        oldPxPerSec: 56,
        newPxPerSec: 112,
        durationSec: 120,
        viewportWidthPx: 800,
      }),
    ).toBe(1200);
  });
});
