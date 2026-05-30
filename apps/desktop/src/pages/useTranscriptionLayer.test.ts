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
    expect(assignSegmentOverlapLanes([])).toEqual({
      laneByIndex: [],
      laneCount: 0,
      dominantSpanIndices: [],
    });
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
      { start_sec: 0, end_sec: 10 },
      { start_sec: 5, end_sec: 15 },
    ];
    const { laneByIndex, laneCount } = assignSegmentOverlapLanes(segs);
    expect(laneCount).toBe(2);
    expect(laneByIndex[0]).toBe(0);
    expect(laneByIndex[1]).toBe(1);
  });

  it("reuses lane 0 when interval fits after previous on that lane", () => {
    const segs = [
      { start_sec: 0, end_sec: 10 },
      { start_sec: 5, end_sec: 15 },
      { start_sec: 10, end_sec: 20 },
    ];
    const { laneByIndex, laneCount } = assignSegmentOverlapLanes(segs);
    expect(laneCount).toBe(2);
    expect(laneByIndex[2]).toBe(0);
  });

  it("excludes whole-track placeholder spans from lane stacking", () => {
    const segs = [
      { start_sec: 30, end_sec: 1000 },
      { start_sec: 40, end_sec: 50 },
      { start_sec: 55, end_sec: 65 },
      { start_sec: 100, end_sec: 1000 },
    ];
    const { laneByIndex, laneCount, dominantSpanIndices } = assignSegmentOverlapLanes(segs, 1000);
    expect(dominantSpanIndices).toEqual([0, 3]);
    expect(laneCount).toBe(1);
    expect(laneByIndex[1]).toBe(0);
    expect(laneByIndex[2]).toBe(0);
  });

  it("keeps laneCount=1 for ASR micro-overlap (avoid half-height overlay bands)", () => {
    const segs = [
      { start_sec: 0, end_sec: 10.02 },
      { start_sec: 10, end_sec: 20 },
      { start_sec: 20, end_sec: 30.01 },
      { start_sec: 30, end_sec: 40 },
    ];
    const { laneByIndex, laneCount } = assignSegmentOverlapLanes(segs);
    expect(laneCount).toBe(1);
    expect(laneByIndex).toEqual([0, 0, 0, 0]);
  });

  it("keeps laneCount=1 for ASR boundary overlap up to ~2s (typical FunASR tail/head)", () => {
    const segs = [
      { start_sec: 0, end_sec: 10.6 },
      { start_sec: 10, end_sec: 22.4 },
      { start_sec: 22, end_sec: 35.8 },
      { start_sec: 35.5, end_sec: 48 },
    ];
    const { laneByIndex, laneCount } = assignSegmentOverlapLanes(segs);
    expect(laneCount).toBe(1);
    expect(laneByIndex).toEqual([0, 0, 0, 0]);
  });

  it("still uses two lanes for true parallel overlap (non-contained)", () => {
    const segs = [
      { start_sec: 0, end_sec: 10 },
      { start_sec: 5, end_sec: 15 },
    ];
    const { laneByIndex, laneCount } = assignSegmentOverlapLanes(segs);
    expect(laneCount).toBe(2);
    expect(laneByIndex).toEqual([0, 1]);
  });

  it("shares a lane when one segment fully contains another", () => {
    const segs = [
      { start_sec: 0, end_sec: 100 },
      { start_sec: 10, end_sec: 20 },
      { start_sec: 30, end_sec: 40 },
    ];
    const { laneByIndex, laneCount } = assignSegmentOverlapLanes(segs);
    expect(laneCount).toBe(1);
    expect(laneByIndex).toEqual([0, 0, 0]);
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
