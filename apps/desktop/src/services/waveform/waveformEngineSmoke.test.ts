import { describe, expect, it } from "vitest";
import { resolveWaveformMountDeferred } from "../../utils/waveformMountPolicy";
import { pickVisibleSegmentIndices } from "../../utils/waveformSegmentOverlayVisibility";
import { resolveWaveformSegmentContextMenuIndex } from "../../utils/waveformSegmentContextMenu";
import { shouldForcePeaksRegenerate } from "../../utils/peakMediaDuration";

/** Automated smoke chain for waveform engine utilities (B10 vitest substitute until Tauri E2E). */
describe("waveform engine smoke", () => {
  it("defers mount while peaks load, then times out to decode", () => {
    expect(
      resolveWaveformMountDeferred({
        backgroundPeaksEnabled: true,
        peaksLoading: true,
        peakCache: null,
        peaksUnavailable: false,
      }),
    ).toBe(true);
    expect(
      resolveWaveformMountDeferred({
        backgroundPeaksEnabled: true,
        peaksLoading: true,
        peakCache: null,
        peaksUnavailable: false,
        deferTimedOut: true,
      }),
    ).toBe(false);
  });

  it("virtualizes segment overlay to viewport window", () => {
    const segments = [
      { idx: 0, uid: "a", start_sec: 0, end_sec: 10, text: "a" },
      { idx: 1, uid: "b", start_sec: 90, end_sec: 100, text: "b" },
    ];
    const picked = pickVisibleSegmentIndices({
      segments,
      durationSec: 120,
      timelineWidthPx: 1200,
      scrollLeftPx: 850,
      viewportWidthPx: 300,
      selectedIdx: -1,
    });
    expect(picked).toEqual([1]);
  });

  it("resolves segment context menu hit at pointer", () => {
    const idx = resolveWaveformSegmentContextMenuIndex({
      segments: [{ idx: 0, start_sec: 1, end_sec: 4, text: "a" }],
      timeSec: 2,
      pointerClientY: 140,
      overlayClientTop: 100,
      layoutHeightPx: 96,
      layoutYScale: 1,
      laneByIndex: [0],
      laneCount: 1,
      selectedIdx: 0,
    });
    expect(idx).toBe(0);
  });

  it("skips force regenerate for long audio with sufficient peak coverage", () => {
    expect(shouldForcePeaksRegenerate(3500, 3600)).toBe(false);
    expect(shouldForcePeaksRegenerate(1000, 3600)).toBe(true);
  });
});
