import { describe, expect, it } from "vitest";
import { calculatePlaybackFollowGeometry } from "./waveformPlaybackRenderSnapshot";
import { CENTER_FOLLOW_RECONCILE_PX } from "./waveformPlaybackSubpixel";

describe("calculatePlaybackFollowGeometry", () => {
  it("edge page-drive reconcile keeps sub-pixel residual (float continuity)", () => {
    const vw = 400;
    // playheadPx = 5.003 * 100 = 500.3; target = 500.3 - vw*anchorFrac(0.15)=60 → 440.3
    const geometry = calculatePlaybackFollowGeometry({
      followMode: "edge",
      timeSec: 5.003,
      timelineWidthPx: 3000,
      durationSec: 30,
      viewportWidthPx: vw,
      currentScrollLeftPx: 0,
      currentFractionalPx: 12,
      subpixelFollow: true,
    });
    expect(geometry.scrollWritePx).toBe(440);
    // Residual is sub-pixel and retained (seek/large-jump destroy lives in snap).
    expect(geometry.fractionalPx).toBeCloseTo(0.3, 5);
    expect(Math.abs(geometry.fractionalPx)).toBeLessThan(0.5 + 1e-9);
    expect(geometry.edgeFollowDriving).toBe(true);
  });

  it("center reconcile keeps subpixel residual past threshold", () => {
    const geometry = calculatePlaybackFollowGeometry({
      followMode: "center",
      timeSec: 50,
      timelineWidthPx: 1000,
      durationSec: 100,
      viewportWidthPx: 800,
      currentScrollLeftPx: 0,
      currentFractionalPx: 0,
      subpixelFollow: true,
    });
    // target scroll 100; offset 100 < reconcile 200 → float only until threshold
    expect(geometry.scrollWritePx).toBeNull();
    expect(Math.abs(geometry.fractionalPx)).toBeCloseTo(100, 1);
    expect(geometry.centerFollowDriving).toBe(true);
  });

  it("edge mid-band sinks float without page-drive", () => {
    const geometry = calculatePlaybackFollowGeometry({
      followMode: "edge",
      timeSec: 15,
      timelineWidthPx: 3000,
      durationSec: 30,
      viewportWidthPx: 400,
      currentScrollLeftPx: 1250,
      currentFractionalPx: 8,
      subpixelFollow: true,
    });
    expect(geometry.edgeFollowDriving).toBe(false);
    expect(geometry.scrollWritePx).toBe(1258);
    expect(geometry.fractionalPx).toBe(0);
  });

  it("snapshot playhead matches pin at center", () => {
    const geometry = calculatePlaybackFollowGeometry({
      followMode: "center",
      timeSec: 10,
      timelineWidthPx: 1000,
      durationSec: 100,
      viewportWidthPx: 400,
      currentScrollLeftPx: 50,
      currentFractionalPx: 0.2,
      subpixelFollow: true,
    });
    expect(geometry.snapshot.playheadViewportLeftPx).toBe(200);
    expect(geometry.snapshot.timeSec).toBe(10);
  });

  it("uses reconcile threshold at least CENTER_FOLLOW_RECONCILE_PX for center", () => {
    const geometry = calculatePlaybackFollowGeometry({
      followMode: "center",
      timeSec: 1,
      timelineWidthPx: 3000,
      durationSec: 30,
      viewportWidthPx: 400,
      currentScrollLeftPx: 0,
      currentFractionalPx: 0,
      subpixelFollow: true,
    });
    const offset = 100 - 0;
    if (Math.abs(offset) < CENTER_FOLLOW_RECONCILE_PX) {
      expect(geometry.scrollWritePx).toBeNull();
    }
  });
});
