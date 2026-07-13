import { describe, expect, it } from "vitest";
import { resolveWaveformSegmentContextMenuIndex } from "./waveformSegmentContextMenu";

const segments = [
  { idx: 0, start_sec: 1, end_sec: 3, text: "one" },
  { idx: 1, start_sec: 2, end_sec: 5, text: "two" },
] as const;

describe("resolveWaveformSegmentContextMenuIndex", () => {
  it("returns segment index at pointer time (full-height overlap bands)", () => {
    const layoutHeightPx = 96;
    const overlayTop = 0;
    const idx = resolveWaveformSegmentContextMenuIndex({
      segments: [...segments],
      timeSec: 2.5,
      pointerClientY: overlayTop + layoutHeightPx * 0.5,
      overlayClientTop: overlayTop,
      layoutHeightPx,
      layoutYScale: 1,
      laneByIndex: [0, 1],
      laneCount: 2,
      selectedIdx: -1,
      durationSec: 10,
    });
    expect(idx).toBe(1);
  });

  it("returns -1 when no segment at pointer", () => {
    const idx = resolveWaveformSegmentContextMenuIndex({
      segments: [...segments],
      timeSec: 0.2,
      pointerClientY: 40,
      overlayClientTop: 0,
      layoutHeightPx: 96,
      layoutYScale: 1,
      laneByIndex: [0, 1],
      laneCount: 2,
      selectedIdx: -1,
      durationSec: 10,
      timelineWidthPx: 1000,
    });
    expect(idx).toBe(-1);
  });

  it("uses timelineWidthPx to expand narrow segment hits", () => {
    const idx = resolveWaveformSegmentContextMenuIndex({
      segments: [{ idx: 0, start_sec: 1.0, end_sec: 1.01, text: "tiny" }],
      timeSec: 1.0,
      pointerClientY: 40,
      overlayClientTop: 0,
      layoutHeightPx: 96,
      layoutYScale: 1,
      laneByIndex: [0],
      laneCount: 1,
      selectedIdx: -1,
      durationSec: 10,
      timelineWidthPx: 10_000,
    });
    expect(idx).toBe(0);
  });
});
