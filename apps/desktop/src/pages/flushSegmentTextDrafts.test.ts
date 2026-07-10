import { describe, expect, it, vi } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  publishSegmentStructureMutation,
  publishSegmentTextBulkMutation,
  publishTranscribeSegmentClear,
  publishTranscribeSegmentRestore,
} from "./flushSegmentTextDrafts";

function seg(text: string): SegmentDto {
  return {
    idx: 0,
    uid: "uid-a",
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

describe("publishTranscribeSegmentClear / publishTranscribeSegmentRestore", () => {
  it("clear empties segments", () => {
    let reactState = [seg("keep")];
    const getCurrentSegmentsSnapshot = () => reactState;
    const setSegments = (next: React.SetStateAction<SegmentDto[]>) => {
      reactState = typeof next === "function" ? next(reactState) : next;
    };

    publishTranscribeSegmentClear(getCurrentSegmentsSnapshot, setSegments);

    expect(reactState).toEqual([]);
  });

  it("restore writes restored segments into state", () => {
    const restored = [seg("restored text")];
    let reactState = [] as SegmentDto[];
    const getCurrentSegmentsSnapshot = () => reactState;
    const setSegments = (next: React.SetStateAction<SegmentDto[]>) => {
      reactState = typeof next === "function" ? next(reactState) : next;
    };

    publishTranscribeSegmentRestore(getCurrentSegmentsSnapshot, setSegments, restored);

    expect(reactState[0]?.text).toBe("restored text");
  });
});

describe("publishSegmentTextBulkMutation", () => {
  it("applies bulk text writeback to React state", () => {
    let reactState = [seg("箱板")];
    const getCurrentSegmentsSnapshot = () => reactState;
    const setSegments = (next: React.SetStateAction<SegmentDto[]>) => {
      reactState = typeof next === "function" ? next(reactState) : next;
    };

    publishSegmentTextBulkMutation(getCurrentSegmentsSnapshot, setSegments, [seg("相板")]);

    expect(reactState[0]?.text).toBe("相板");
  });
});

describe("publishSegmentStructureMutation", () => {
  it("resolves functional updater from React state before flushSync", () => {
    let reactState = [seg("a"), seg("b")];
    const getCurrentSegmentsSnapshot = () => reactState;
    const setSegments = (next: React.SetStateAction<SegmentDto[]>) => {
      reactState = typeof next === "function" ? next(reactState) : next;
    };
    const updater = vi.fn((prev: SegmentDto[]) => prev.slice(0, 1));

    publishSegmentStructureMutation(getCurrentSegmentsSnapshot, setSegments, updater);

    expect(updater).toHaveBeenCalledTimes(1);
    expect(reactState).toHaveLength(1);
    expect(reactState[0]?.text).toBe("a");
  });
});
