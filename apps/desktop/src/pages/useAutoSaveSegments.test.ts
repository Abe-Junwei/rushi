import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces save after segment text change", () => {
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
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(saveSegments).toHaveBeenCalledTimes(1);
    expect(saveSegments).toHaveBeenCalledWith({ quiet: true, countHits: true });

    dirty = false;
    rerender({ segments: [seg("b")] });
  });

  it("schedules save when segment text updates", () => {
    const saveSegments = vi.fn().mockResolvedValue(true);
    const { rerender } = renderHook(
      (props: { segments: SegmentDto[] }) =>
        useAutoSaveSegments({
          enabled: true,
          currentFileId: "f1",
          segments: props.segments,
          busy: false,
          saveInFlightRef: { current: false },
          hasUnsavedSegmentChanges: () => true,
          saveSegments,
        }),
      { initialProps: { segments: [seg("committed", 0)] } },
    );

    rerender({ segments: [seg("draft edit", 0)] });

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(saveSegments).toHaveBeenCalledTimes(1);
    expect(saveSegments).toHaveBeenCalledWith({ quiet: true, countHits: true });
  });
});
