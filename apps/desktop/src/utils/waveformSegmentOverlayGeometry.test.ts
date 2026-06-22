import { describe, expect, it } from "vitest";
import {
  boundsForOverlayDrag,
  computeCreatePreviewStyle,
  resolveSegmentBoundsAt,
} from "./waveformSegmentOverlayGeometry";

describe("waveformSegmentOverlayGeometry", () => {
  it("resolveSegmentBoundsAt prefers draft over segment", () => {
    const bounds = resolveSegmentBoundsAt(
      0,
      [{ idx: 0, start_sec: 1, end_sec: 2, text: "a" }],
      { idx: 0, startSec: 1.5, endSec: 2.5 },
    );
    expect(bounds).toEqual({ startSec: 1.5, endSec: 2.5 });
  });

  it("computeCreatePreviewStyle uses timeline coordinates", () => {
    const style = computeCreatePreviewStyle({
      createPreview: { startSec: 0, endSec: 3 },
      timelineWidthPx: 1000,
      durationSec: 10,
    });
    expect(style.left).toBe(0);
    expect(style.width).toBe(300);
  });

  it("boundsForOverlayDrag returns null for lasso mode", () => {
    expect(
      boundsForOverlayDrag(
        {
          mode: "lasso",
          pointerId: 1,
          segmentIdx: -1,
          anchorTimeSec: 0,
          anchorClientX: 0,
          initialStartSec: 0,
          initialEndSec: 0,
          moved: false,
          selectedIdxAtPointerDown: 0,
        },
        1,
        10,
      ),
    ).toBeNull();
  });
});
