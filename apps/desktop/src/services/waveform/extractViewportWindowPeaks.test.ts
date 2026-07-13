import { describe, expect, it } from "vitest";
import {
  extractViewportWindowPeaks,
  resolveViewportPeaksPxPerSec,
  type ViewportWindowPeaksSource,
} from "./extractViewportWindowPeaks";

function makeLodSource(columns: number, pattern: "flat" | "ramp" = "ramp"): ViewportWindowPeaksSource {
  const mins = new Float32Array(columns);
  const maxs = new Float32Array(columns);
  for (let i = 0; i < columns; i += 1) {
    if (pattern === "flat") {
      mins[i] = -16384;
      maxs[i] = 16384;
    } else {
      // Distinct ramp so downsample preserves identity of ranges.
      mins[i] = -i;
      maxs[i] = i;
    }
  }
  return {
    length: columns,
    channel: () => ({
      min_sample: (i: number) => mins[i] ?? 0,
      max_sample: (i: number) => maxs[i] ?? 0,
    }),
  };
}

describe("extractViewportWindowPeaks", () => {
  it("emits one column per CSS pixel for the window", () => {
    const durationSec = 10_800;
    const pxPerSec = 85;
    const timelineWidthPx = Math.ceil(durationSec * pxPerSec);
    const windowWidthPx = 1_200;
    // L2-like density: 200 pps over full duration.
    const lod = makeLodSource(Math.ceil(durationSec * 200), "flat");
    const peaks = extractViewportWindowPeaks({
      data: lod,
      durationSec,
      timelineWidthPx,
      windowLeftPx: timelineWidthPx * 0.1,
      windowWidthPx,
    });
    expect(peaks.length).toBe(windowWidthPx * 2);
    // Flat LOD → every CSS column has content (not ~53 sparse columns stretched).
    let nonzero = 0;
    for (let i = 0; i < peaks.length; i += 2) {
      if (peaks[i] !== 0 || peaks[i + 1] !== 0) nonzero += 1;
    }
    expect(nonzero).toBe(windowWidthPx);
  });

  it("downsamples dense LOD into the window width", () => {
    const lod = makeLodSource(4_000, "ramp");
    const peaks = extractViewportWindowPeaks({
      data: lod,
      durationSec: 20,
      timelineWidthPx: 2_000,
      windowLeftPx: 0,
      windowWidthPx: 100,
    });
    expect(peaks.length).toBe(200);
    // First pixel aggregates early columns; last aggregates late columns.
    expect(peaks[0]).toBeGreaterThan(peaks[198]);
    expect(peaks[1]).toBeLessThan(peaks[199]);
  });

  it("reuses an into buffer when large enough", () => {
    const lod = makeLodSource(100, "flat");
    const into = new Float32Array(64);
    const peaks = extractViewportWindowPeaks(
      {
        data: lod,
        durationSec: 10,
        timelineWidthPx: 100,
        windowLeftPx: 0,
        windowWidthPx: 20,
      },
      into,
    );
    expect(peaks.buffer).toBe(into.buffer);
    expect(peaks.length).toBe(40);
  });
});

describe("resolveViewportPeaksPxPerSec", () => {
  it("prefers timeline density over fallback draw px/s", () => {
    expect(resolveViewportPeaksPxPerSec(1200, 45, 3.8)).toBeCloseTo(1200 / 45, 6);
  });
});
