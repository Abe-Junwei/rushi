import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  findSegmentIndexByUid,
  normalizeSegmentList,
  sortSegmentsByStartSec,
} from "./segmentListHelpers";
import { ensureUniqueSegmentUids } from "../utils/segmentUid";

function seg(
  props: Partial<SegmentDto> & { start_sec: number; end_sec: number; text: string },
): SegmentDto {
  return {
    idx: 0,
    confidence: null,
    low_confidence: false,
    detail: null,
    uid: "uid-a",
    ...props,
  };
}

describe("segmentListHelpers", () => {
  it("sortSegmentsByStartSec orders by start_sec and reindexes", () => {
    const input = [
      seg({ uid: "b", start_sec: 5, end_sec: 6, text: "b" }),
      seg({ uid: "a", start_sec: 1, end_sec: 2, text: "a" }),
    ];
    const out = sortSegmentsByStartSec(input);
    expect(out.map((s) => s.text)).toEqual(["a", "b"]);
    expect(out.map((s) => s.idx)).toEqual([0, 1]);
  });

  it("ensureUniqueSegmentUids reassigns duplicates", () => {
    const input = [
      seg({ uid: "dup", start_sec: 0, end_sec: 1, text: "a" }),
      seg({ uid: "dup", start_sec: 2, end_sec: 3, text: "b" }),
    ];
    const out = ensureUniqueSegmentUids(input);
    expect(out[0]?.uid).toBe("dup");
    expect(out[1]?.uid).not.toBe("dup");
  });

  it("normalizeSegmentList sorts and dedupes uids", () => {
    const out = normalizeSegmentList([
      seg({ uid: "dup", start_sec: 4, end_sec: 5, text: "late" }),
      seg({ uid: "dup", start_sec: 1, end_sec: 2, text: "early" }),
    ]);
    expect(out[0]?.text).toBe("early");
    expect(out[1]?.text).toBe("late");
    expect(new Set(out.map((s) => s.uid)).size).toBe(2);
  });

  it("findSegmentIndexByUid returns array index", () => {
    const list = [
      seg({ uid: "x", start_sec: 0, end_sec: 1, text: "a" }),
      seg({ uid: "y", start_sec: 2, end_sec: 3, text: "b" }),
    ];
    expect(findSegmentIndexByUid(list, "y")).toBe(1);
  });
});
