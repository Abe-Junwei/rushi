import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import { useSegmentKeyboard } from "./useSegmentKeyboard";

function makeCtx(overrides: Partial<TranscriptionLayerInput> = {}): TranscriptionLayerInput {
  return {
    projectId: "p1",
    fileId: "f1",
    mediaUrl: "media",
    segments: [{ uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" }],
    selectedIdx: 0,
    busy: false,
    selectionLo: 0,
    selectionHi: 0,
    selectionCount: 1,
    isMultiSegmentSelection: false,
    isContiguousSelection: true,
    selectedIndicesArray: [0],
    selectSegmentIndices: vi.fn(),
    requestDeleteSelectedIndices: vi.fn(),
    clearMultiSelection: vi.fn(),
    isIndexInSelection: () => true,
    selectSegmentAt: vi.fn(),
    selectSegmentRange: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    updateSegmentBounds: vi.fn(),
    insertSegmentFromTimeRange: vi.fn(),
    splitAtSelection: vi.fn(),
    splitAtPlayhead: vi.fn(),
    mergeWithNext: vi.fn(),
    mergeWithPrev: vi.fn(),
    mergeSegmentRange: vi.fn(),
    insertSegmentAfter: vi.fn(),
    deleteSegmentAt: vi.fn(),
    requestDeleteSelection: vi.fn(),
    confirmSegmentEditAndAdvance: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  };
}

function makeKeyEvent(key: string, opts: Partial<ReactKeyboardEvent> = {}): ReactKeyboardEvent {
  return {
    key,
    preventDefault: vi.fn(),
    target: document.body,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...opts,
  } as ReactKeyboardEvent;
}

function renderKeyboard(initialCtx: TranscriptionLayerInput) {
  return renderHook(
    (ctx: TranscriptionLayerInput) => {
      const ctxRef = useRef(ctx);
      ctxRef.current = ctx;
      const selectSegmentAtRef = useRef<
        (idx: number, source?: string, opts?: { shiftKey?: boolean }) => void
      >(vi.fn());
      const wfApiRef = useRef({
        togglePlay: vi.fn(),
        getPlayheadTime: () => 0,
        playSegmentAtIndex: vi.fn(),
        preserveLoopForNextSegmentSelect: vi.fn(),
        seekByDelta: vi.fn(),
      });

      const keyboard = useSegmentKeyboard({
        ctxRef,
        wfApiRef: wfApiRef as never,
        selectSegmentAtRef,
        tierScrollRef: useRef(null),
        showEditorHintRef: useRef(vi.fn()),
        stepWaveformZoomRef: useRef(vi.fn()),
      });

      return { keyboard, selectSegmentAtRef };
    },
    { initialProps: initialCtx },
  );
}

describe("useSegmentKeyboard", () => {
  it("requests batch delete when multi-select is active", () => {
    const requestDeleteSelection = vi.fn();
    const ctx = makeCtx({
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
        { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "c" },
      ],
      selectedIdx: 2,
      selectionLo: 0,
      selectionHi: 2,
      selectionCount: 3,
      isMultiSegmentSelection: true,
      requestDeleteSelection,
    });
    const { result } = renderKeyboard(ctx);

    act(() => {
      result.current.keyboard.onWaveformMainKeyDown(makeKeyEvent("Delete"));
    });

    expect(requestDeleteSelection).toHaveBeenCalledWith(0, 2);
  });

  it("merges selection range on Cmd+M when multi-select is active", () => {
    const mergeSegmentRange = vi.fn();
    const ctx = makeCtx({
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
      ],
      selectedIdx: 1,
      selectionLo: 0,
      selectionHi: 1,
      selectionCount: 2,
      isMultiSegmentSelection: true,
      mergeSegmentRange,
    });
    const { result } = renderKeyboard(ctx);

    act(() => {
      result.current.keyboard.onWaveformMainKeyDown(makeKeyEvent("m", { metaKey: true }));
    });

    expect(mergeSegmentRange).toHaveBeenCalledWith(0, 1);
  });

  it("requests sparse delete when multi-select is non-contiguous", () => {
    const requestDeleteSelectedIndices = vi.fn();
    const ctx = makeCtx({
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
        { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "c" },
        { uid: "d", idx: 3, start_sec: 3, end_sec: 4, text: "d" },
        { uid: "e", idx: 4, start_sec: 4, end_sec: 5, text: "e" },
      ],
      selectedIdx: 4,
      selectionLo: 0,
      selectionHi: 4,
      selectionCount: 3,
      isMultiSegmentSelection: true,
      isContiguousSelection: false,
      selectedIndicesArray: [0, 2, 4],
      requestDeleteSelectedIndices,
    });
    const { result } = renderKeyboard(ctx);

    act(() => {
      result.current.keyboard.onWaveformMainKeyDown(makeKeyEvent("Delete"));
    });

    expect(requestDeleteSelectedIndices).toHaveBeenCalledWith([0, 2, 4]);
  });

  it("does not merge on Cmd+M when multi-select is non-contiguous", () => {
    const mergeSegmentRange = vi.fn();
    const mergeWithNext = vi.fn();
    const mergeWithPrev = vi.fn();
    const ctx = makeCtx({
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
        { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "c" },
      ],
      selectedIdx: 2,
      selectionLo: 0,
      selectionHi: 2,
      selectionCount: 2,
      isMultiSegmentSelection: true,
      isContiguousSelection: false,
      selectedIndicesArray: [0, 2],
      mergeSegmentRange,
      mergeWithNext,
      mergeWithPrev,
    });
    const { result } = renderKeyboard(ctx);

    act(() => {
      result.current.keyboard.onWaveformMainKeyDown(makeKeyEvent("m", { metaKey: true }));
    });

    expect(mergeSegmentRange).not.toHaveBeenCalled();
    expect(mergeWithNext).not.toHaveBeenCalled();
    expect(mergeWithPrev).not.toHaveBeenCalled();
  });

  it("clears multi-selection on Escape", () => {
    const clearMultiSelection = vi.fn();
    const ctx = makeCtx({
      isMultiSegmentSelection: true,
      selectionCount: 3,
      clearMultiSelection,
    });
    const { result } = renderKeyboard(ctx);

    act(() => {
      result.current.keyboard.onWaveformMainKeyDown(makeKeyEvent("Escape"));
    });

    expect(clearMultiSelection).toHaveBeenCalled();
  });

  it("extends selection on Shift+ArrowRight", () => {
    const ctx = makeCtx({
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
      ],
      selectedIdx: 0,
    });
    const { result } = renderKeyboard(ctx);

    act(() => {
      result.current.keyboard.onWaveformMainKeyDown(makeKeyEvent("ArrowRight", { shiftKey: true }));
    });

    expect(result.current.selectSegmentAtRef.current).toHaveBeenCalledWith(1, "waveform", {
      shiftKey: true,
    });
  });
});
