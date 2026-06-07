import { act, renderHook, waitFor } from "@testing-library/react";
import type { SetStateAction } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { useSegmentAnnotationController } from "./useSegmentAnnotationController";

function baseArgs(saveSegments = vi.fn().mockResolvedValue(true)) {
  const segments: SegmentDto[] = [
    { uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "hello", annotation: null },
  ];
  const segmentsRef = { current: segments };
  const setSegments = vi.fn((updater: SetStateAction<SegmentDto[]>) => {
    const next = typeof updater === "function" ? updater(segmentsRef.current) : updater;
    segmentsRef.current = next;
  });
  return {
    busy: false,
    segmentsRef,
    setSegments,
    saveSegments,
    pushUndo: vi.fn(),
    setError: vi.fn(),
  };
}

describe("useSegmentAnnotationController", () => {
  it("keeps dialog open and reverts annotation when save fails", async () => {
    const saveSegments = vi.fn().mockResolvedValue(false);
    const args = baseArgs(saveSegments);
    const { result } = renderHook(() => useSegmentAnnotationController(args));

    act(() => {
      result.current.openSegmentAnnotationDialog(0);
    });
    act(() => {
      result.current.setSegmentAnnotationDraft("新备注");
    });

    await act(async () => {
      await result.current.saveSegmentAnnotation();
    });
    await waitFor(() => expect(saveSegments).toHaveBeenCalled());

    expect(result.current.segmentAnnotationDialog.phase).toBe("edit");
    expect(args.segmentsRef.current[0]?.annotation).toBeNull();
    expect(args.setError).toHaveBeenCalledWith("备注保存失败，请重试");
    expect(args.pushUndo).toHaveBeenCalledTimes(1);
  });

  it("closes dialog after successful save and pushes undo", async () => {
    let args!: ReturnType<typeof baseArgs>;
    const saveSegments = vi.fn().mockImplementation(async () => {
      expect(args.segmentsRef.current[0]?.annotation).toBe("已保存");
      return true;
    });
    args = baseArgs(saveSegments);
    const { result } = renderHook(() => useSegmentAnnotationController(args));

    act(() => {
      result.current.openSegmentAnnotationDialog(0);
    });
    act(() => {
      result.current.setSegmentAnnotationDraft("已保存");
    });
    args.setError.mockClear();

    await act(async () => {
      await result.current.saveSegmentAnnotation();
    });
    await waitFor(() => expect(result.current.segmentAnnotationDialog.phase).toBe("closed"));

    expect(args.segmentsRef.current[0]?.annotation).toBe("已保存");
    expect(args.pushUndo).toHaveBeenCalledTimes(1);
    expect(args.setError).not.toHaveBeenCalled();
  });

  it("ignores duplicate save while persist is in flight", async () => {
    let resolveSave!: (value: boolean) => void;
    const saveSegments = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const args = baseArgs(saveSegments);
    const { result } = renderHook(() => useSegmentAnnotationController(args));

    act(() => {
      result.current.openSegmentAnnotationDialog(0);
      result.current.setSegmentAnnotationDraft("并发测试");
    });

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.saveSegmentAnnotation();
      second = result.current.saveSegmentAnnotation();
    });

    expect(args.pushUndo).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave(true);
      await first;
      await second;
    });

    expect(await second).toBe(false);
    expect(saveSegments).toHaveBeenCalledTimes(1);
  });
});
