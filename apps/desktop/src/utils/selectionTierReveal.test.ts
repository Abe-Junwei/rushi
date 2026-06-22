import { describe, expect, it } from "vitest";
import { computeViewportFitScrollPx } from "./pxPerSecFit";
import { computeTimelineWidthPx } from "./segmentLayout";
import { shouldSkipTierRevealForSegment, tierRevealScrollDeltaPx } from "./selectionTierReveal";

describe("selectionTierReveal", () => {
  it("returns Infinity when tier viewport is not ready", () => {
    expect(
      tierRevealScrollDeltaPx({
        seg: { start_sec: 10, end_sec: 12 },
        scrollLeftPx: 0,
        viewportWidthPx: 0,
        pxPerSec: 50,
        durationSec: 100,
      }),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it("skips reveal when scroll is already at target", () => {
    const seg = { start_sec: 10, end_sec: 12 };
    const viewportWidthPx = 800;
    const pxPerSec = 50;
    const durationSec = 100;
    const timelineWidthPx = computeTimelineWidthPx(durationSec, pxPerSec);
    const targetScrollLeft = computeViewportFitScrollPx({
      intent: { startSec: seg.start_sec, endSec: seg.end_sec },
      viewportWidthPx,
      timelineWidthPx,
      durationSec,
    });

    expect(
      shouldSkipTierRevealForSegment({
        seg,
        scrollLeftPx: targetScrollLeft,
        viewportWidthPx,
        pxPerSec,
        durationSec,
      }),
    ).toBe(true);
  });

  it("does not skip when segment is outside viewport", () => {
    expect(
      shouldSkipTierRevealForSegment({
        seg: { start_sec: 80, end_sec: 82 },
        scrollLeftPx: 0,
        viewportWidthPx: 800,
        pxPerSec: 50,
        durationSec: 100,
      }),
    ).toBe(false);
  });
});
