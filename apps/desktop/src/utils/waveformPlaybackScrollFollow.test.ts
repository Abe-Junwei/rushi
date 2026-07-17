import { describe, expect, it } from "vitest";
import {
  resolvePlaybackScrollFollowTargetPx,
  resolveEdgeSeekAnchorScrollPx,
  shouldSkipInteractiveSeekViewportSnap,
  WAVEFORM_EDGE_FOLLOW,
} from "./waveformPlaybackScrollFollow";

describe("shouldSkipInteractiveSeekViewportSnap", () => {
  it("skips the anchor snap for an edge-mode interactive seek (paused click)", () => {
    expect(
      shouldSkipInteractiveSeekViewportSnap({ suppressFollow: true, followMode: "edge" }),
    ).toBe(true);
  });

  it("keeps the snap for center mode so the playhead stays centered", () => {
    expect(
      shouldSkipInteractiveSeekViewportSnap({ suppressFollow: true, followMode: "center" }),
    ).toBe(false);
  });

  it("keeps the snap when the seek does not suppress follow (e.g. keyboard nudge)", () => {
    expect(
      shouldSkipInteractiveSeekViewportSnap({ suppressFollow: false, followMode: "edge" }),
    ).toBe(false);
  });
});

describe("resolvePlaybackScrollFollowTargetPx", () => {
  const base = {
    timelineWidthPx: 3000,
    durationSec: 30,
    viewportWidthPx: 400,
  };

  it("center mode keeps playhead centered every frame", () => {
    expect(
      resolvePlaybackScrollFollowTargetPx({
        ...base,
        mode: "center",
        timeSec: 15,
        currentScrollLeftPx: 0,
      }),
    ).toBe(1300);
    expect(
      resolvePlaybackScrollFollowTargetPx({
        ...base,
        mode: "center",
        timeSec: 15.006,
        currentScrollLeftPx: 1300,
      }),
    ).toBeCloseTo(1300.6, 5);
  });

  it("edge mode keeps scroll when playhead stays in the middle band", () => {
    const scrollLeft = 1200;
    const timeSec = 15;
    expect(
      resolvePlaybackScrollFollowTargetPx({
        ...base,
        mode: "edge",
        timeSec,
        currentScrollLeftPx: scrollLeft,
      }),
    ).toBe(scrollLeft);
  });

  it("edge mode scrolls forward when playhead nears the right edge", () => {
    const anchor = base.viewportWidthPx * WAVEFORM_EDGE_FOLLOW.anchorFrac;
    expect(
      resolvePlaybackScrollFollowTargetPx({
        ...base,
        mode: "edge",
        timeSec: 15,
        currentScrollLeftPx: 1100,
      }),
    ).toBe(1500 - anchor);
  });

  it("edge mode scrolls backward when playhead nears the left edge", () => {
    const anchor = base.viewportWidthPx * WAVEFORM_EDGE_FOLLOW.anchorFrac;
    expect(
      resolvePlaybackScrollFollowTargetPx({
        ...base,
        mode: "edge",
        timeSec: 2,
        currentScrollLeftPx: 250,
      }),
    ).toBe(200 - anchor);
  });
});

describe("resolveEdgeSeekAnchorScrollPx", () => {
  it("always lands playhead at anchorFrac regardless of current scroll mid-band", () => {
    const anchor = 400 * WAVEFORM_EDGE_FOLLOW.anchorFrac;
    // Mid-band hysteresis would keep scroll=1200 for t=15; seek land forces anchor.
    expect(
      resolveEdgeSeekAnchorScrollPx({
        timeSec: 15,
        timelineWidthPx: 3000,
        durationSec: 30,
        viewportWidthPx: 400,
      }),
    ).toBe(1500 - anchor);
  });
});
