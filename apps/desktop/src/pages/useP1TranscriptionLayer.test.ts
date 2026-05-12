import { describe, expect, it } from "vitest";
import {
  assignP1SegmentOverlapLanes,
  computeP1SegmentLaneRowPx,
  computeP1TimelineWidthPx,
  P1_SEGMENT_LANE_ROW_PX,
  P1_TIMELINE_PX_PER_SEC,
} from "./useP1TranscriptionLayer";

describe("assignP1SegmentOverlapLanes", () => {
  it("returns empty for no segments", () => {
    expect(assignP1SegmentOverlapLanes([])).toEqual({ laneByIndex: [], laneCount: 0 });
  });

  it("places non-overlapping segments on lane 0", () => {
    const segs = [
      { start_sec: 0, end_sec: 1 },
      { start_sec: 1, end_sec: 2 },
      { start_sec: 3, end_sec: 4 },
    ];
    const { laneByIndex, laneCount } = assignP1SegmentOverlapLanes(segs);
    expect(laneCount).toBe(1);
    expect(laneByIndex).toEqual([0, 0, 0]);
  });

  it("stacks overlapping segments on separate lanes", () => {
    const segs = [
      { start_sec: 0, end_sec: 3 },
      { start_sec: 1, end_sec: 4 },
    ];
    const { laneByIndex, laneCount } = assignP1SegmentOverlapLanes(segs);
    expect(laneCount).toBe(2);
    expect(laneByIndex[0]).toBe(0);
    expect(laneByIndex[1]).toBe(1);
  });

  it("reuses lane 0 when interval fits after previous on that lane", () => {
    const segs = [
      { start_sec: 0, end_sec: 2 },
      { start_sec: 1, end_sec: 3 },
      { start_sec: 2, end_sec: 4 },
    ];
    const { laneByIndex, laneCount } = assignP1SegmentOverlapLanes(segs);
    expect(laneCount).toBe(2);
    expect(laneByIndex[2]).toBe(0);
  });
});

describe("computeP1TimelineWidthPx", () => {
  it("uses media duration only (floor), not segment ends; matches waveform width", () => {
    expect(computeP1TimelineWidthPx(0, P1_TIMELINE_PX_PER_SEC)).toBe(320);
    expect(computeP1TimelineWidthPx(10, P1_TIMELINE_PX_PER_SEC)).toBe(560);
    expect(computeP1TimelineWidthPx(400, P1_TIMELINE_PX_PER_SEC)).toBe(22400);
    expect(computeP1TimelineWidthPx(5, P1_TIMELINE_PX_PER_SEC)).toBe(320);
  });

  it("scales with pxPerSec", () => {
    expect(computeP1TimelineWidthPx(10, 112)).toBe(1120);
    expect(computeP1TimelineWidthPx(400, 112)).toBe(44800);
  });
});

describe("computeP1SegmentLaneRowPx", () => {
  it("matches exported default constant at 13px font", () => {
    expect(computeP1SegmentLaneRowPx(13)).toBe(P1_SEGMENT_LANE_ROW_PX);
    expect(P1_SEGMENT_LANE_ROW_PX).toBe(43);
  });

  it("grows with font size", () => {
    expect(computeP1SegmentLaneRowPx(11)).toBeLessThan(computeP1SegmentLaneRowPx(22));
  });
});
