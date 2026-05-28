import { describe, expect, it } from "vitest";
import { clampWaveformScrollLeftPx, readVisibleWaveformScrollPx } from "./waveformZoomScroll";

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

  it("preserves in-range pixel scroll when zoom changes", () => {
    expect(
      clampWaveformScrollLeftPx({
        scrollLeftPx: 400,
        pxPerSec: 56,
        durationSec: 120,
        viewportWidthPx: 800,
      }),
    ).toBe(400);
  });

  it("prefers tier scroll when it is ahead of WS scroll", () => {
    expect(readVisibleWaveformScrollPx(100, 500)).toBe(500);
    expect(readVisibleWaveformScrollPx(500, 100)).toBe(500);
  });
});
