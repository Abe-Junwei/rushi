import { describe, expect, it, vi } from "vitest";
import { snapPlaybackViewportAfterSeek } from "./snapPlaybackViewportAfterSeek";
import {
  clearPlaybackFollowDriving,
  isCenterFollowDriving,
  isEdgeFollowDriving,
} from "./waveformPlaybackSubpixel";
import { readPlaybackFractionalPx, setPlaybackFractionalPx } from "./tierScrollFrameCoordinator";
import { WAVEFORM_EDGE_FOLLOW } from "./waveformPlaybackScrollFollow";

describe("snapPlaybackViewportAfterSeek", () => {
  it("centers scroll and re-arms center pin for the seek target", () => {
    clearPlaybackFollowDriving();
    setPlaybackFractionalPx(40);
    const tier = document.createElement("div");
    Object.defineProperty(tier, "clientWidth", { value: 800, configurable: true });
    Object.defineProperty(tier, "scrollLeft", { value: 0, writable: true, configurable: true });
    const playbackFollowScroll = vi.fn((px: number) => {
      tier.scrollLeft = px;
    });
    const suppressUntilRef = { current: Number.POSITIVE_INFINITY };

    snapPlaybackViewportAfterSeek({
      timeSec: 50,
      followMode: "center",
      timelineWidthPx: 1000,
      durationSec: 100,
      tierScrollEl: tier,
      playbackFollowScroll,
      suppressUntilRef,
      suppressMs: 0,
    });

    // Ideal center for t=50 / tw=1000 / vw=800 is scrollLeft=100.
    expect(playbackFollowScroll).toHaveBeenCalledWith(100, { deferLayoutCommit: false });
    expect(isCenterFollowDriving()).toBe(true);
    expect(isEdgeFollowDriving()).toBe(false);
    expect(Math.abs(readPlaybackFractionalPx())).toBeLessThan(1);
    expect(suppressUntilRef.current).toBe(Number.POSITIVE_INFINITY);
    clearPlaybackFollowDriving();
    setPlaybackFractionalPx(0);
  });

  it("edge seek force-anchors and hard-clears fractional (no mid-band keep)", () => {
    clearPlaybackFollowDriving();
    setPlaybackFractionalPx(320);
    const tier = document.createElement("div");
    Object.defineProperty(tier, "clientWidth", { value: 800, configurable: true });
    Object.defineProperty(tier, "scrollLeft", { value: 100, writable: true, configurable: true });
    const playbackFollowScroll = vi.fn((px: number) => {
      tier.scrollLeft = px;
    });

    // t=20 mid-band under hysteresis would keep scroll=100; seek land must force anchor.
    snapPlaybackViewportAfterSeek({
      timeSec: 20,
      followMode: "edge",
      timelineWidthPx: 1000,
      durationSec: 100,
      tierScrollEl: tier,
      playbackFollowScroll,
    });

    const playheadPx = 200;
    const expected = Math.round(playheadPx - 800 * WAVEFORM_EDGE_FOLLOW.anchorFrac);
    expect(playbackFollowScroll).toHaveBeenCalledWith(expected, { deferLayoutCommit: false });
    expect(readPlaybackFractionalPx()).toBe(0);
    expect(isCenterFollowDriving()).toBe(false);
    expect(isEdgeFollowDriving()).toBe(false);
    clearPlaybackFollowDriving();
    setPlaybackFractionalPx(0);
  });

  it("edge page-jump seek lands at anchor with frac=0 and no edge pin", () => {
    clearPlaybackFollowDriving();
    setPlaybackFractionalPx(12.5);
    const tier = document.createElement("div");
    Object.defineProperty(tier, "clientWidth", { value: 800, configurable: true });
    Object.defineProperty(tier, "scrollLeft", { value: 0, writable: true, configurable: true });
    const playbackFollowScroll = vi.fn((px: number) => {
      tier.scrollLeft = px;
    });

    snapPlaybackViewportAfterSeek({
      timeSec: 90,
      followMode: "edge",
      timelineWidthPx: 1000,
      durationSec: 100,
      tierScrollEl: tier,
      playbackFollowScroll,
    });

    const playheadPx = 900;
    const expected = Math.round(playheadPx - 800 * WAVEFORM_EDGE_FOLLOW.anchorFrac);
    // Clamped to maxSl = 1000-800 = 200.
    expect(playbackFollowScroll).toHaveBeenCalledWith(Math.min(200, expected), {
      deferLayoutCommit: false,
    });
    expect(readPlaybackFractionalPx()).toBe(0);
    expect(isEdgeFollowDriving()).toBe(false);
    expect(isCenterFollowDriving()).toBe(false);
    clearPlaybackFollowDriving();
    setPlaybackFractionalPx(0);
  });
});
