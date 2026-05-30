import { describe, expect, it } from "vitest";
import { TIMELINE_PX_PER_SEC } from "./useTranscriptionLayer";
import {
  assignSegmentOverlapLanes,
  computeSegmentLaneRowPx,
  computeTimelineWidthPx,
  SEGMENT_LANE_ROW_PX,
} from "../utils/segmentLayout";

describe("assignSegmentOverlapLanes", () => {
  it("returns empty for no segments", () => {
    expect(assignSegmentOverlapLanes([])).toEqual({ laneByIndex: [], laneCount: 0 });
  });

  it("places non-overlapping segments on lane 0", () => {
    const segs = [
      { start_sec: 0, end_sec: 1 },
      { start_sec: 1, end_sec: 2 },
      { start_sec: 3, end_sec: 4 },
    ];
    const { laneByIndex, laneCount } = assignSegmentOverlapLanes(segs);
    expect(laneCount).toBe(1);
    expect(laneByIndex).toEqual([0, 0, 0]);
  });

  it("stacks overlapping segments on separate lanes", () => {
    const segs = [
      { start_sec: 0, end_sec: 3 },
      { start_sec: 1, end_sec: 4 },
    ];
    const { laneByIndex, laneCount } = assignSegmentOverlapLanes(segs);
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
    const { laneByIndex, laneCount } = assignSegmentOverlapLanes(segs);
    expect(laneCount).toBe(2);
    expect(laneByIndex[2]).toBe(0);
  });
});

describe("computeTimelineWidthPx", () => {
  it("uses media duration only, not segment ends; matches waveform width", () => {
    expect(computeTimelineWidthPx(0, TIMELINE_PX_PER_SEC)).toBe(28);
    expect(computeTimelineWidthPx(10, TIMELINE_PX_PER_SEC)).toBe(560);
    expect(computeTimelineWidthPx(400, TIMELINE_PX_PER_SEC)).toBe(22400);
    expect(computeTimelineWidthPx(5, TIMELINE_PX_PER_SEC)).toBe(280);
  });

  it("scales with pxPerSec", () => {
    expect(computeTimelineWidthPx(10, 112)).toBe(1120);
    expect(computeTimelineWidthPx(400, 112)).toBe(44800);
  });
});

describe("computeSegmentLaneRowPx", () => {
  it("matches exported default constant at 13px font", () => {
    expect(computeSegmentLaneRowPx(13)).toBe(SEGMENT_LANE_ROW_PX);
    expect(SEGMENT_LANE_ROW_PX).toBe(68);
  });

  it("grows with font size", () => {
    expect(computeSegmentLaneRowPx(11)).toBeLessThan(computeSegmentLaneRowPx(22));
  });
});
