import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { createSegmentUid, ensureSegmentUids, ensureUniqueSegmentUids, segmentsUidSignature } from "./segmentUid";

function seg(partial: Partial<SegmentDto> & Pick<SegmentDto, "start_sec" | "end_sec">): SegmentDto {
  return {
    idx: 0,
    text: "x",
    confidence: null,
    low_confidence: false,
    detail: null,
    ...partial,
  };
}

describe("segmentUid", () => {
  it("ensureSegmentUids only fills missing uids", () => {
    const existing = createSegmentUid();
    const input = [seg({ uid: existing, start_sec: 0, end_sec: 1 }), seg({ start_sec: 1, end_sec: 2 })];
    const out = ensureSegmentUids(input);
    expect(out[0]?.uid).toBe(existing);
    expect(out[1]?.uid).toBeTruthy();
    expect(out[1]?.uid).not.toBe(existing);
  });

  it("ensureUniqueSegmentUids fixes duplicate uids", () => {
    const dup = createSegmentUid();
    const input = [seg({ uid: dup, start_sec: 0, end_sec: 1 }), seg({ uid: dup, start_sec: 2, end_sec: 3 })];
    const out = ensureUniqueSegmentUids(input);
    expect(out[0]?.uid).toBe(dup);
    expect(out[1]?.uid).not.toBe(dup);
  });

  it("segmentsUidSignature ignores order and text", () => {
    const a = createSegmentUid();
    const b = createSegmentUid();
    const s1 = [seg({ uid: b, start_sec: 0, end_sec: 1 }), seg({ uid: a, start_sec: 1, end_sec: 2 })];
    const s2 = [seg({ uid: a, start_sec: 1, end_sec: 2, text: "changed" }), seg({ uid: b, start_sec: 0, end_sec: 1 })];
    expect(segmentsUidSignature(s1)).toBe(segmentsUidSignature(s2));
  });
});
