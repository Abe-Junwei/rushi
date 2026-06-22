import { describe, expect, it } from "vitest";
import {
  resolveBlankOverlayShellDragMode,
  resolveOverlayPointerUpIntent,
} from "./waveformSegmentOverlayGestures";

describe("resolveBlankOverlayShellDragMode", () => {
  it("uses lasso when create range is enabled", () => {
    expect(
      resolveBlankOverlayShellDragMode({
        enableCreateRange: true,
        hasOnCreateRange: true,
      }),
    ).toBe("lasso");
  });

  it("seeks when create range is disabled", () => {
    expect(
      resolveBlankOverlayShellDragMode({
        enableCreateRange: false,
        hasOnCreateRange: false,
      }),
    ).toBe("seek");
  });
});

describe("resolveOverlayPointerUpIntent", () => {
  it("uses anchor time for segment tap when pointerup drifted", () => {
    expect(
      resolveOverlayPointerUpIntent({
        mode: "move",
        moved: false,
        segmentIdx: 2,
        pointerTimeSec: 5.2,
        anchorTimeSec: 5,
        initialStartSec: 4,
        initialEndSec: 6,
        clampedStartSec: 4,
        clampedEndSec: 6,
      }),
    ).toEqual({ kind: "select-segment", segmentIdx: 2, pointerTimeSec: 5 });
  });

  it("treats segment tap as select", () => {
    expect(
      resolveOverlayPointerUpIntent({
        mode: "move",
        moved: false,
        segmentIdx: 2,
        pointerTimeSec: 5,
        anchorTimeSec: 5,
        initialStartSec: 4,
        initialEndSec: 6,
        clampedStartSec: 4,
        clampedEndSec: 6,
      }),
    ).toEqual({ kind: "select-segment", segmentIdx: 2, pointerTimeSec: 5 });
  });

  it("seeks on blank short tap during lasso", () => {
    expect(
      resolveOverlayPointerUpIntent({
        mode: "lasso",
        moved: false,
        segmentIdx: -1,
        pointerTimeSec: 12.5,
        anchorTimeSec: 12.5,
        initialStartSec: 12.5,
        initialEndSec: 12.5,
        clampedStartSec: 12.5,
        clampedEndSec: 12.5,
      }),
    ).toEqual({ kind: "seek-blank", timeSec: 12.5 });
  });
});
