// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { useFindReplaceSearch } from "./useFindReplaceSearch";

vi.mock("../utils/segmentListVirtualWindow", () => ({
  scheduleScrollSegmentListIndexToView: vi.fn(),
}));

vi.mock("../components/editor/core/transcriptEditorCoreFlag", () => ({
  readTranscriptEditorCoreEnabled: () => false,
}));

function makeSegments(texts: string[]): SegmentDto[] {
  return texts.map((text, idx) => ({
    uid: `u${idx}`,
    idx,
    start_sec: idx * 65 + 5,
    end_sec: idx * 65 + 10,
    text,
    text_stage: "auto_transcribe" as const,
  }));
}

describe("useFindReplaceSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps committed matches while the find draft changes before debounce", () => {
    const segments = makeSegments(["hello world", "hello again"]);
    const { result } = renderHook(() =>
      useFindReplaceSearch({
        segments,
        getCurrentSegmentsSnapshot: () => segments,
        flushSegmentTextDrafts: vi.fn(),
        setSelectedIdx: vi.fn(),
      }),
    );

    act(() => {
      result.current.seedSearchForOpen("hello", "");
    });
    expect(result.current.committedFindQuery).toBe("hello");
    const committedCount = result.current.matches.length;
    expect(committedCount).toBeGreaterThan(0);

    act(() => {
      result.current.setFindReplaceFindText("hell");
    });
    expect(result.current.findText).toBe("hell");
    expect(result.current.committedFindQuery).toBe("hello");
    expect(result.current.matches.length).toBe(committedCount);

    act(() => {
      vi.advanceTimersByTime(320);
    });
    expect(result.current.committedFindQuery).toBe("hell");
    expect(result.current.matches.length).toBeGreaterThan(0);
  });

  it("clears committed query immediately when the find draft is emptied", () => {
    const segments = makeSegments(["hello world"]);
    const { result } = renderHook(() =>
      useFindReplaceSearch({
        segments,
        getCurrentSegmentsSnapshot: () => segments,
        flushSegmentTextDrafts: vi.fn(),
        setSelectedIdx: vi.fn(),
      }),
    );

    act(() => {
      result.current.seedSearchForOpen("hello", "");
    });
    expect(result.current.searchCommitted).toBe(true);

    act(() => {
      result.current.setFindReplaceFindText("");
    });
    expect(result.current.committedFindQuery).toBe("");
    expect(result.current.searchCommitted).toBe(false);
    expect(result.current.matches).toEqual([]);
  });
});
