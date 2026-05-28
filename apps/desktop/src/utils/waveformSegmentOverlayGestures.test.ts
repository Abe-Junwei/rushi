import { describe, expect, it } from "vitest";
import { resolveOverlayPointerUpIntent } from "./waveformSegmentOverlayGestures";

describe("resolveOverlayPointerUpIntent", () => {
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
    ).toEqual({ kind: "select-segment", segmentIdx: 2 });
  });

  it("commits bounds after drag", () => {
    expect(
      resolveOverlayPointerUpIntent({
        mode: "move",
        moved: true,
        segmentIdx: 1,
        pointerTimeSec: 7,
        anchorTimeSec: 5,
        initialStartSec: 4,
        initialEndSec: 6,
        clampedStartSec: 5,
        clampedEndSec: 7,
      }),
    ).toEqual({ kind: "commit-bounds", segmentIdx: 1, startSec: 5, endSec: 7 });
  });

  it("seeks on blank short tap", () => {
    expect(
      resolveOverlayPointerUpIntent({
        mode: "create",
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

  it("creates range when blank drag span is long enough", () => {
    expect(
      resolveOverlayPointerUpIntent({
        mode: "create",
        moved: true,
        segmentIdx: -1,
        pointerTimeSec: 3,
        anchorTimeSec: 1,
        initialStartSec: 1,
        initialEndSec: 1,
        clampedStartSec: 1,
        clampedEndSec: 3,
      }),
    ).toEqual({ kind: "create-range", startSec: 1, endSec: 3 });
  });
});
