import { describe, expect, it } from "vitest";
import { assignSegmentOverlapLanes } from "./segmentLayout";
import { trimAdjacentSegmentOverlaps } from "./segmentBoundaryTrim";
import type { SegmentDto } from "../tauri/projectApi";

function seg(partial: Partial<SegmentDto> & Pick<SegmentDto, "start_sec" | "end_sec">): SegmentDto {
  return {
    uid: "u",
    idx: 0,
    text: "",
    confidence: null,
    low_confidence: false,
    detail: null,
    kind: "speech",
    ...partial,
  };
}

describe("trimAdjacentSegmentOverlaps", () => {
  it("trims ASR-style tail/head overlap on adjacent segments", () => {
    const out = trimAdjacentSegmentOverlaps([
      seg({ start_sec: 0, end_sec: 10.6 }),
      seg({ start_sec: 10, end_sec: 22 }),
    ]);
    expect(out[0]?.end_sec).toBe(10);
    expect(out[1]?.start_sec).toBe(10);
  });

  it("eliminates large false parallel overlap between sorted neighbors", () => {
    const out = trimAdjacentSegmentOverlaps([
      seg({ start_sec: 0, end_sec: 10 }),
      seg({ start_sec: 5, end_sec: 15 }),
    ]);
    expect(out[0]?.end_sec).toBe(5);
    expect(out[0]?.end_sec).toBeLessThanOrEqual(out[1]?.start_sec ?? 0);
  });

  it("trims long ASR chains with no remaining overlap", () => {
    const raw = [
      { start_sec: 0, end_sec: 10.6 },
      { start_sec: 10, end_sec: 22.4 },
      { start_sec: 22, end_sec: 35.8 },
      { start_sec: 35.5, end_sec: 48 },
    ];
    const trimmed = trimAdjacentSegmentOverlaps(raw.map((s, i) => seg({ ...s, idx: i })));
    for (let i = 0; i < trimmed.length - 1; i += 1) {
      expect(trimmed[i]?.end_sec).toBeLessThanOrEqual((trimmed[i + 1]?.start_sec ?? 0) + 1e-6);
    }
    const { laneCount } = assignSegmentOverlapLanes(trimmed);
    expect(laneCount).toBe(1);
  });
});
