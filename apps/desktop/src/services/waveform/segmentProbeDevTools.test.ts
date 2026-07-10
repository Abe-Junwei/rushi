import { describe, expect, it, afterEach } from "vitest";
import {
  probeSegmentsInTimeWindow,
  registerSegmentProbeSource,
} from "./segmentProbeDevTools";

describe("segmentProbeDevTools", () => {
  afterEach(() => {
    registerSegmentProbeSource(null);
  });

  it("filters segments intersecting the time window", () => {
    const rows = probeSegmentsInTimeWindow(
      [
        { idx: 0, uid: "a", start_sec: 0, end_sec: 10, text: "early" },
        { idx: 1, uid: "b", start_sec: 189, end_sec: 195, text: "" },
        { idx: 2, uid: "c", start_sec: 195, end_sec: 201, text: "  " },
        { idx: 3, uid: "d", start_sec: 244, end_sec: 250, text: "later" },
      ],
      189,
      201,
    );
    expect(rows.map((r) => r.i)).toEqual([1, 2]);
    expect(rows[0]?.text).toBe("");
  });
});
