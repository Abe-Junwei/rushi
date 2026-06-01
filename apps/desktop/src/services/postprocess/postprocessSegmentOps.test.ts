import { describe, expect, it } from "vitest";
import {
  applySegmentRefineOps,
  segmentsMonotonicByTime,
} from "./segmentRefineApply";
import {
  collectRefineSegmentWindow,
  describeRefineOpsForPreview,
  validateRefineOps,
} from "./postprocessSegmentOps";
import type { SegmentDto } from "../../tauri/projectApi";

function seg(uid: string, start: number, end: number, text: string): SegmentDto {
  return {
    uid,
    idx: 0,
    start_sec: start,
    end_sec: end,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
    kind: "speech",
  };
}

describe("postprocessSegmentOps", () => {
  it("collects selected and neighbors", () => {
    const segments = [
      seg("a", 0, 1, "甲"),
      seg("b", 1, 2, "乙"),
      seg("c", 2, 3, "丙"),
    ];
    expect(collectRefineSegmentWindow(segments, 1).map((x) => x.uid)).toEqual(["a", "b", "c"]);
  });

  it("rejects non-adjacent merge", () => {
    const window = [
      { uid: "a", startSec: 0, endSec: 1, text: "甲" },
      { uid: "b", startSec: 1, endSec: 2, text: "乙" },
      { uid: "c", startSec: 2, endSec: 3, text: "丙" },
    ];
    expect(
      validateRefineOps(window, [{ op: "merge", uids: ["a", "c"] }]),
    ).toMatch(/相邻/);
  });
});

describe("describeRefineOpsForPreview", () => {
  it("shows time range and text instead of uid", () => {
    const window = [{ uid: "a", startSec: 10, endSec: 20, text: "这是测试语段正文" }];
    const lines = describeRefineOpsForPreview(window, [
      { op: "update_text", uid: "a", text: "这是测试语段正文。" },
    ]);
    expect(lines[0]).toContain("10.0–20.0");
    expect(lines[0]).toContain("测试语段");
    expect(lines[0]).not.toContain("a");
  });
});

describe("segmentRefineApply", () => {
  it("applies merge then validates monotonic times", () => {
    const segments = [seg("a", 0, 1, "甲"), seg("b", 1, 2, "乙")];
    const out = applySegmentRefineOps(segments, [{ op: "merge", uids: ["a", "b"] }]);
    expect(out).toHaveLength(1);
    expect(out?.[0]?.text).toContain("甲");
    expect(out && segmentsMonotonicByTime(out)).toBe(true);
  });

  it("applies split at midpoint", () => {
    const segments = [seg("a", 0, 2, "甲乙")];
    const out = applySegmentRefineOps(segments, [
      { op: "split", uid: "a", at_sec: 1, left_text: "甲", right_text: "乙" },
    ]);
    expect(out).toHaveLength(2);
    expect(out?.[0]?.text).toBe("甲");
    expect(out?.[1]?.text).toBe("乙");
  });
});
