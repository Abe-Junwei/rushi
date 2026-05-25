import { describe, expect, it } from "vitest";
import {
  buildSplitPair,
  mergeTwoSegments,
  reindexSegments,
  segmentsEqualForPersist,
  snapshotSegmentsForPersist,
} from "./segmentListHelpers";
import type { SegmentDto } from "../tauri/projectApi";

describe("reindexSegments", () => {
  it("assigns contiguous idx", () => {
    const a: SegmentDto = { idx: 9, start_sec: 0, end_sec: 1, text: "a" };
    const b: SegmentDto = { idx: 9, start_sec: 1, end_sec: 2, text: "b" };
    const out = reindexSegments([a, b]);
    expect(out[0].idx).toBe(0);
    expect(out[1].idx).toBe(1);
  });
});

describe("mergeTwoSegments", () => {
  it("joins text and time bounds", () => {
    const a: SegmentDto = { idx: 0, start_sec: 0, end_sec: 1, text: "x", confidence: 0.9 };
    const b: SegmentDto = { idx: 1, start_sec: 1, end_sec: 3, text: "y", confidence: 0.5 };
    const m = mergeTwoSegments(a, b);
    expect(m.start_sec).toBe(0);
    expect(m.end_sec).toBe(3);
    expect(m.text).toBe("x\ny");
    expect(m.confidence).toBe(0.5);
  });
});

describe("segmentsEqualForPersist", () => {
  const base: SegmentDto = { idx: 0, start_sec: 0, end_sec: 1, text: "a", confidence: 0.5, low_confidence: false, detail: null };

  it("treats reindexed copies as equal", () => {
    const a = [{ ...base, idx: 3 }];
    const b = snapshotSegmentsForPersist(a);
    expect(segmentsEqualForPersist(a, b)).toBe(true);
  });

  it("detects text change", () => {
    const a = [base];
    const b = [{ ...base, text: "b" }];
    expect(segmentsEqualForPersist(a, b)).toBe(false);
  });
});

describe("buildSplitPair", () => {
  it("returns null when segment too short", () => {
    const s: SegmentDto = { idx: 0, start_sec: 0, end_sec: 0.03, text: "a" };
    expect(buildSplitPair(s, 0.015)).toBeNull();
  });

  it("splits at mid", () => {
    const s: SegmentDto = { idx: 0, start_sec: 0, end_sec: 2, text: "ab" };
    const p = buildSplitPair(s, 1);
    expect(p).not.toBeNull();
    expect(p!.left.end_sec).toBe(1);
    expect(p!.right.start_sec).toBe(1);
    expect(p!.right.text).toBe("");
  });
});
