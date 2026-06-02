import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { segmentDraftStore, segmentDraftKey } from "../hooks/useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";
import { useAutoSaveSegments } from "./useAutoSaveSegments";

function seg(text: string, idx = 0): SegmentDto {
  return {
    uid: `u${idx}`,
    idx,
    start_sec: 0,
    end_sec: 1,
    text,
  };
}

describe("useAutoSaveSegments", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    segmentDraftStore.resetAll();
  });

  afterEach(() => {
    vi.useRealTimers();
    segmentDraftStore.resetAll();
  });

  it("debounces save after segment text change", async () => {
    const saveSegments = vi.fn().mockResolvedValue(true);
    let dirty = true;
    const { rerender } = renderHook(
      (props: { segments: SegmentDto[] }) =>
        useAutoSaveSegments({
          enabled: true,
          currentFileId: "f1",
          segments: props.segments,
          busy: false,
          saveInFlightRef: { current: false },
          hasUnsavedSegmentChanges: () => dirty,
          saveSegments,
        }),
      { initialProps: { segments: [seg("a")] } },
    );

    dirty = true;
    rerender({ segments: [seg("b")] });

    expect(saveSegments).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(saveSegments).toHaveBeenCalledTimes(1);
    expect(saveSegments).toHaveBeenCalledWith({ quiet: true, countHits: false });

    dirty = false;
    rerender({ segments: [seg("b")] });
  });

  it("schedules save when draft store updates", async () => {
    const saveSegments = vi.fn().mockResolvedValue(true);
    const segments = [seg("committed", 0)];
    renderHook(() =>
      useAutoSaveSegments({
        enabled: true,
        currentFileId: "f1",
        segments,
        busy: false,
        saveInFlightRef: { current: false },
        hasUnsavedSegmentChanges: () => true,
        saveSegments,
      }),
    );

    act(() => {
      segmentDraftStore.setDraft(segmentDraftKey(segments[0]!, 0), "draft edit");
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(saveSegments).toHaveBeenCalledTimes(1);
    expect(saveSegments).toHaveBeenCalledWith({ quiet: true, countHits: false });
  });
});
