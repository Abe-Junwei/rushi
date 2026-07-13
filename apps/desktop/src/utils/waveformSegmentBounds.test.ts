import { describe, expect, it } from "vitest";
import { assignSegmentOverlapLanes } from "./segmentLayout";
import { clampCreateRangeClearOfSegments } from "./segmentTimeRange";
import {
  clampSegmentTimeBounds,
  computeDragSegmentBounds,
  expandSegmentHitGeometry,
  hitSegmentEdgeFromLocalPx,
  hitSegmentEdgeFromTimelinePointer,
  isPlaceholderSegment,
  resolveExpandedSegmentHitBoundsSec,
  resolveSegmentIndexAtWaveformPointer,
  segmentOverlayGeometry,
  selectPackableSegmentIndices,
  selectPackableSegments,
  WAVEFORM_SEGMENT_INSET_BOTTOM_PX,
  WAVEFORM_SEGMENT_INSET_TOP_PX,
  WAVEFORM_SEGMENT_MIN_HIT_WIDTH_PX,
} from "./waveformSegmentBounds";

describe("waveformSegmentBounds", () => {
  it("clamps segment bounds with minimum span", () => {
    expect(clampSegmentTimeBounds(1, 1.01, 10)).toEqual({ startSec: 1, endSec: 1.05 });
  });

  it("uses full waveform band height for a single lane", () => {
    const h = 96;
    const g = segmentOverlayGeometry({
      startSec: 2,
      endSec: 4,
      timelineWidthPx: 1000,
      durationSec: 10,
      lane: 0,
      laneCount: 1,
      containerHeightPx: h,
    });
    expect(g.leftPx).toBe(200);
    expect(g.widthPx).toBe(200);
    expect(g.topPx).toBe(WAVEFORM_SEGMENT_INSET_TOP_PX);
    expect(g.heightPx).toBe(h - WAVEFORM_SEGMENT_INSET_TOP_PX - WAVEFORM_SEGMENT_INSET_BOTTOM_PX);
  });

  it("uses full band height regardless of lane metadata", () => {
    const h = 96;
    const g = segmentOverlayGeometry({
      startSec: 1,
      endSec: 2,
      timelineWidthPx: 560,
      durationSec: 10,
      lane: 1,
      laneCount: 3,
      containerHeightPx: h,
    });
    expect(g.topPx).toBe(WAVEFORM_SEGMENT_INSET_TOP_PX);
    expect(g.heightPx).toBe(h - WAVEFORM_SEGMENT_INSET_TOP_PX - WAVEFORM_SEGMENT_INSET_BOTTOM_PX);
  });

  it("computeDragSegmentBounds matches move delta on finish path", () => {
    const moved = computeDragSegmentBounds("move", 2, 4, 0.5, 60);
    expect(moved).toEqual({ startSec: 2.5, endSec: 4.5 });
  });

  it("hitSegmentEdgeFromLocalPx detects resize handles", () => {
    expect(hitSegmentEdgeFromLocalPx(4, 200)).toBe("resize-start");
    expect(hitSegmentEdgeFromLocalPx(196, 200)).toBe("resize-end");
    expect(hitSegmentEdgeFromLocalPx(100, 200)).toBe("move");
  });

  it("keeps a move zone on extremely narrow painted segments", () => {
    expect(hitSegmentEdgeFromLocalPx(0, 6)).toBe("resize-start");
    expect(hitSegmentEdgeFromLocalPx(3, 6)).toBe("move");
    expect(hitSegmentEdgeFromLocalPx(5, 6)).toBe("resize-end");
  });

  it("expandSegmentHitGeometry pads painted width to the min hit size", () => {
    const hit = expandSegmentHitGeometry({ leftPx: 100, widthPx: 4, timelineWidthPx: 1000 });
    expect(hit.widthPx).toBe(WAVEFORM_SEGMENT_MIN_HIT_WIDTH_PX);
    expect(hit.leftPx).toBeCloseTo(90, 5);
  });

  it("expandSegmentHitGeometry half-shrinks into the gap between neighbors", () => {
    // Painted 4px at 100; neighbors at 90 and 120 → gap mids clamp expansion.
    const hit = expandSegmentHitGeometry({
      leftPx: 100,
      widthPx: 4,
      timelineWidthPx: 1000,
      prevPaintedRightPx: 90,
      nextPaintedLeftPx: 120,
    });
    expect(hit.leftPx).toBeCloseTo(95, 5); // mid(90,100)
    expect(hit.leftPx + hit.widthPx).toBeCloseTo(112, 5); // mid(104,120)
    expect(hit.widthPx).toBeLessThan(WAVEFORM_SEGMENT_MIN_HIT_WIDTH_PX);
  });

  it("resolveExpandedSegmentHitBoundsSec does not cross the neighbor midpoint", () => {
    const hit = resolveExpandedSegmentHitBoundsSec({
      startSec: 1.0,
      endSec: 1.02,
      durationSec: 10,
      timelineWidthPx: 10_000, // 1000 px/s → painted 20px < 24
      prevPaintedEndSec: 0.98,
      nextPaintedStartSec: 1.05,
    });
    expect(hit.startSec).toBeGreaterThanOrEqual(0.99); // mid(0.98,1.0)
    expect(hit.endSec).toBeLessThanOrEqual(1.035); // mid(1.02,1.05)
  });

  it("resolveSegmentIndexAtWaveformPointer expands narrow hits but stops at neighbor mid", () => {
    const segments = [
      { idx: 0, start_sec: 1.0, end_sec: 1.01, text: "a" },
      { idx: 1, start_sec: 1.03, end_sec: 1.04, text: "b" },
    ];
    // Midpoint between 1.01 and 1.03 is 1.02 — belongs to neither expansion past mid.
    const miss = resolveSegmentIndexAtWaveformPointer({
      segments: segments as never,
      timeSec: 1.02,
      pointerClientY: 40,
      overlayClientTop: 0,
      layoutHeightPx: 96,
      laneByIndex: [0, 0],
      laneCount: 1,
      selectedIdx: -1,
      durationSec: 10,
      timelineWidthPx: 10_000,
    });
    expect(miss).toBe(-1);

    const hitA = resolveSegmentIndexAtWaveformPointer({
      segments: segments as never,
      timeSec: 1.005,
      pointerClientY: 40,
      overlayClientTop: 0,
      layoutHeightPx: 96,
      laneByIndex: [0, 0],
      laneCount: 1,
      selectedIdx: -1,
      durationSec: 10,
      timelineWidthPx: 10_000,
    });
    expect(hitA).toBe(0);
  });

  it("hitSegmentEdgeFromTimelinePointer uses expanded hit geometry for narrow segments", () => {
    // 0.05s on a sparse timeline paints ~2px; expanded hit keeps a center move zone.
    expect(
      hitSegmentEdgeFromTimelinePointer({
        pointerTimeSec: 10.025,
        startSec: 10,
        endSec: 10.05,
        timelineWidthPx: 40_000,
        durationSec: 10_000,
      }),
    ).toBe("move");
  });

  it("hitSegmentEdgeFromTimelinePointer uses segment time bounds", () => {
    expect(
      hitSegmentEdgeFromTimelinePointer({
        pointerTimeSec: 2.01,
        startSec: 2,
        endSec: 4,
        timelineWidthPx: 1000,
        durationSec: 10,
      }),
    ).toBe("resize-start");
  });

  it("aligns segment geometry with peaks when timeline width floor engages", () => {
    const durationSec = 1263;
    const timelineWidthPx = 320;
    const g = segmentOverlayGeometry({
      startSec: 600,
      endSec: 660,
      timelineWidthPx,
      durationSec,
      lane: 0,
      laneCount: 1,
      containerHeightPx: 96,
    });
    expect(g.leftPx).toBeCloseTo((600 / durationSec) * timelineWidthPx, 4);
    expect(g.widthPx).toBeCloseTo((60 / durationSec) * timelineWidthPx, 4);
  });

  it("resolveSegmentIndexAtWaveformPointer prefers later index when times overlap", () => {
    const layoutHeightPx = 96;
    const overlayTop = 100;
    const pointerY = overlayTop + layoutHeightPx / 2;
    const idx = resolveSegmentIndexAtWaveformPointer({
      segments: [
        { idx: 0, start_sec: 0, end_sec: 5, text: "a" },
        { idx: 1, start_sec: 1, end_sec: 4, text: "b" },
      ],
      timeSec: 2,
      pointerClientY: pointerY,
      overlayClientTop: overlayTop,
      layoutHeightPx,
      laneByIndex: [0, 1],
      laneCount: 2,
      selectedIdx: -1,
    });
    expect(idx).toBe(1);
  });

  it("resolveSegmentIndexAtWaveformPointer prefers selectedIdx when in overlap", () => {
    const idx = resolveSegmentIndexAtWaveformPointer({
      segments: [
        { idx: 0, start_sec: 0, end_sec: 5, text: "a" },
        { idx: 1, start_sec: 1, end_sec: 4, text: "b" },
      ],
      timeSec: 2,
      pointerClientY: 148,
      overlayClientTop: 100,
      layoutHeightPx: 96,
      laneByIndex: [0, 1],
      laneCount: 2,
      selectedIdx: 0,
    });
    expect(idx).toBe(0);
  });

  it("returns -1 when pointer misses all segments", () => {
    const idx = resolveSegmentIndexAtWaveformPointer({
      segments: [{ idx: 0, start_sec: 10, end_sec: 12, text: "a" }],
      timeSec: 2,
      pointerClientY: 150,
      overlayClientTop: 100,
      layoutHeightPx: 96,
      laneByIndex: [0],
      laneCount: 1,
      selectedIdx: 0,
    });
    expect(idx).toBe(-1);
  });

  it("isPlaceholderSegment prefers explicit kind over the span heuristic", () => {
    // Explicit speech wins even when the span would trip the 0.85 heuristic.
    expect(isPlaceholderSegment({ start_sec: 0, end_sec: 95, kind: "speech" }, 100)).toBe(false);
    // Explicit placeholder wins even for a short span (and regardless of duration).
    expect(isPlaceholderSegment({ start_sec: 0, end_sec: 3, kind: "placeholder" }, 100)).toBe(true);
    expect(isPlaceholderSegment({ start_sec: 0, end_sec: 3, kind: "placeholder" }, 0)).toBe(true);
    // No kind → fall back to the heuristic.
    expect(isPlaceholderSegment({ start_sec: 0, end_sec: 95 }, 100)).toBe(true);
    expect(isPlaceholderSegment({ start_sec: 0, end_sec: 10 }, 100)).toBe(false);
    // Unknown kind → treat as missing, fall back to heuristic.
    expect(isPlaceholderSegment({ start_sec: 0, end_sec: 95, kind: "unknown" as "speech" }, 100)).toBe(
      true,
    );
  });

  it("selectPackableSegments keeps an explicit speech segment that the heuristic would hide", () => {
    const segments = [
      { start_sec: 0, end_sec: 95, kind: "speech" as const },
      { start_sec: 96, end_sec: 99 },
    ];
    const { packableIndices, dominantSpanIndices } = selectPackableSegmentIndices(segments, 100);
    expect(dominantSpanIndices).toEqual([]);
    expect(packableIndices).toEqual([0, 1]);
  });

  it("selectPackableSegments excludes an explicit placeholder regardless of span", () => {
    const segments = [
      { start_sec: 0, end_sec: 4, kind: "placeholder" as const },
      { start_sec: 5, end_sec: 8 },
    ];
    const kept = selectPackableSegments(segments, 100);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.start_sec).toBe(5);
  });

  it("selectPackableSegmentIndices excludes whole-track placeholders when duration is known", () => {
    const segments = [
      { start_sec: 0, end_sec: 100 },
      { start_sec: 5, end_sec: 8 },
      { start_sec: 20, end_sec: 25 },
    ];
    const { packableIndices, dominantSpanIndices } = selectPackableSegmentIndices(segments, 100);
    expect(dominantSpanIndices).toEqual([0]);
    expect(packableIndices).toEqual([1, 2]);
  });

  it("selectPackableSegments keeps every segment (identity) when duration is unknown", () => {
    const segments = [
      { start_sec: 0, end_sec: 100 },
      { start_sec: 5, end_sec: 8 },
    ];
    const kept = selectPackableSegments(segments, 0);
    expect(kept).toHaveLength(2);
    expect(kept[0]).toBe(segments[0]);
    expect(kept[1]).toBe(segments[1]);
  });

  // Cross-path invariant: the placeholder hidden from the overlay/lane layout must be
  // exactly the segment dropped from create-range overlap. Both paths now derive from the
  // single selectPackableSegments authority, so a segment invisible on the waveform can
  // never block a new selection in that region (the dominant-span overlap regression).
  it("render lane hiding and create-overlap stay in lockstep through the selector", () => {
    const durationSec = 100;
    const segments = [
      { idx: 0, start_sec: 0, end_sec: 100, text: "placeholder" },
      { idx: 1, start_sec: 5, end_sec: 8, text: "real" },
    ];

    const { dominantSpanIndices } = assignSegmentOverlapLanes(segments, durationSec);
    const { packableIndices } = selectPackableSegmentIndices(segments, durationSec);

    // Lane layout hides exactly the placeholder; the create path sees exactly the rest.
    expect(dominantSpanIndices).toEqual([0]);
    const overlapSegs = selectPackableSegments(segments, durationSec);
    expect(overlapSegs.map((s) => s.idx)).toEqual(packableIndices);

    // Selecting inside the hidden placeholder (but clear of the real segment) must succeed.
    expect(clampCreateRangeClearOfSegments(overlapSegs, 20, 25)).not.toBeNull();
    // Selecting over the real segment must still be rejected.
    expect(clampCreateRangeClearOfSegments(overlapSegs, 6, 7)).toBeNull();
  });

  it("maps pointer Y through layoutYScale when overlay is scaleY-previewed", () => {
    const layoutHeightPx = 96;
    const overlayTop = 100;
    const scale = 0.75;
    const pointerY = overlayTop + (layoutHeightPx / 2) * scale;

    const idx = resolveSegmentIndexAtWaveformPointer({
      segments: [
        { idx: 0, start_sec: 0, end_sec: 5, text: "a" },
        { idx: 1, start_sec: 1, end_sec: 4, text: "b" },
      ],
      timeSec: 2,
      pointerClientY: pointerY,
      overlayClientTop: overlayTop,
      layoutHeightPx,
      layoutYScale: scale,
      laneByIndex: [0, 1],
      laneCount: 2,
      selectedIdx: -1,
    });
    expect(idx).toBe(1);
  });
});
