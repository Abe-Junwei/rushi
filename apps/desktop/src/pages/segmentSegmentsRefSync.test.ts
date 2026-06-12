import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { reconcileSegmentsRefWithState } from "./segmentSegmentsRefSync";

function seg(text: string, uid: string): SegmentDto {
  return {
    idx: 0,
    uid,
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

describe("reconcileSegmentsRefWithState", () => {
  it("keeps ref when S1 text is ahead of React state", () => {
    const stateRow = seg("state", "uid-a");
    const refRow = seg("ref ahead", "uid-a");
    const segmentsRef = { current: [refRow] };
    reconcileSegmentsRefWithState(segmentsRef, [stateRow]);
    expect(segmentsRef.current[0]?.text).toBe("ref ahead");
  });

  it("syncs ref from state when uids diverge (structure changed)", () => {
    const refRow = seg("old text", "uid-a");
    const stateRow = seg("new row", "uid-b");
    const segmentsRef = { current: [refRow] };
    reconcileSegmentsRefWithState(segmentsRef, [stateRow]);
    expect(segmentsRef.current[0]?.uid).toBe("uid-b");
    expect(segmentsRef.current[0]?.text).toBe("new row");
  });

  it("syncs ref from state when lengths differ", () => {
    const segmentsRef = { current: [seg("a", "uid-a"), seg("b", "uid-b")] };
    reconcileSegmentsRefWithState(segmentsRef, [seg("only", "uid-only")]);
    expect(segmentsRef.current).toHaveLength(1);
    expect(segmentsRef.current[0]?.uid).toBe("uid-only");
  });
});
