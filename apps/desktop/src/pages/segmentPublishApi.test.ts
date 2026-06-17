import { describe, expect, it, vi } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { createSegmentPublishApi } from "./segmentPublishApi";

function seg(text: string): SegmentDto {
  return {
    uid: "u1",
    idx: 0,
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

describe("createSegmentPublishApi", () => {
  it("getCurrentSegmentsSnapshot reads segmentsRef.current", () => {
    const segmentsRef = { current: [seg("hello")] };
    const setSegments = vi.fn();
    const api = createSegmentPublishApi(segmentsRef, setSegments);
    expect(api.getCurrentSegmentsSnapshot()).toEqual([seg("hello")]);
  });

  it("publishTextBulk updates React state through setter", () => {
    const segmentsRef = { current: [seg("hello")] };
    const setSegments = vi.fn((updater: SegmentDto[] | ((prev: SegmentDto[]) => SegmentDto[])) => {
      segmentsRef.current =
        typeof updater === "function" ? updater(segmentsRef.current) : updater;
    });
    const api = createSegmentPublishApi(segmentsRef, setSegments);
    api.publishTextBulk([seg("world")]);
    expect(segmentsRef.current[0]?.text).toBe("world");
    expect(setSegments).toHaveBeenCalled();
  });

  it("publishStructureLive updates React state without touching ref until reconcile", () => {
    const segmentsRef = { current: [seg("a")] };
    let reactState = segmentsRef.current;
    const setSegments = vi.fn((updater: SegmentDto[] | ((prev: SegmentDto[]) => SegmentDto[])) => {
      reactState = typeof updater === "function" ? updater(reactState) : updater;
    });
    const api = createSegmentPublishApi(segmentsRef, setSegments);
    api.publishStructureLive((prev) => prev.map((row) => ({ ...row, text: "live" })));
    expect(reactState[0]?.text).toBe("live");
    expect(segmentsRef.current[0]?.text).toBe("a");
    expect(setSegments).toHaveBeenCalled();
  });

  it("publishStructure updates React state through setter", () => {
    const segmentsRef = { current: [seg("a")] };
    const setSegments = vi.fn((updater: SegmentDto[] | ((prev: SegmentDto[]) => SegmentDto[])) => {
      segmentsRef.current =
        typeof updater === "function" ? updater(segmentsRef.current) : updater;
    });
    const api = createSegmentPublishApi(segmentsRef, setSegments);
    api.publishStructure([seg("b")]);
    expect(segmentsRef.current[0]?.text).toBe("b");
    expect(setSegments).toHaveBeenCalled();
  });
});
