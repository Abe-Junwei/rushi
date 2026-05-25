import { describe, expect, it } from "vitest";
import { resolveWaveformRulerView } from "./waveformViewport";

describe("resolveWaveformRulerView", () => {
  it("returns the initial visible window at scroll origin", () => {
    expect(
      resolveWaveformRulerView({
        durationSec: 20,
        scrollLeftPx: 0,
        clientWidthPx: 400,
        pxPerSec: 50,
      }),
    ).toEqual({ start: 0, end: 8 });
  });

  it("converts scroll offset into the matching visible time window", () => {
    expect(
      resolveWaveformRulerView({
        durationSec: 20,
        scrollLeftPx: 250,
        clientWidthPx: 400,
        pxPerSec: 50,
      }),
    ).toEqual({ start: 5, end: 13 });
  });
});
