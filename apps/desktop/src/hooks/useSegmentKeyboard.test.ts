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
    mergeWithNextAt: vi.fn(),
    mergeWithPrevAt: vi.fn(),
    mergeSegmentRange: vi.fn(),
    insertSegmentAfter: vi.fn(),
    deleteSegmentAt: vi.fn(),
    requestDeleteSelection: vi.fn(),
    confirmSegmentEditAndAdvance: vi.fn(() => Promise.resolve(true)),
    saveSegments: vi.fn(() => Promise.resolve(true)),
    triggerFindReplaceShortcut: vi.fn(),
    closeFile: vi.fn(),
    openEnvironment: vi.fn(),
    openSegmentAnnotationDialog: vi.fn(),
    openManualCorrectionMemoryDialog: vi.fn(),
    ...overrides,
  };
}

function makeTextareaKeyEvent(
  key: string,
  textarea: HTMLTextAreaElement,
  opts: Partial<ReactKeyboardEvent<HTMLTextAreaElement>> = {},
): ReactKeyboardEvent<HTMLTextAreaElement> {
  return {
    key,
    preventDefault: vi.fn(),
    currentTarget: textarea,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...opts,
  } as ReactKeyboardEvent<HTMLTextAreaElement>;
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
      });

      return { keyboard, selectSegmentAtRef, wfApiRef };
    },
    { initialProps: initialCtx },
  );
}

describe("useSegmentKeyboard", () => {
  it("merges with previous segment on Backspace at textarea start", () => {
    const mergeWithPrevAt = vi.fn();
    const textarea = document.createElement("textarea");
    textarea.value = "tail";
    Object.defineProperty(textarea, "selectionStart", { value: 0, configurable: true });
    Object.defineProperty(textarea, "selectionEnd", { value: 0, configurable: true });
    const ctx = makeCtx({
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "head" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "tail" },
      ],
      selectedIdx: 1,
      mergeWithPrevAt,
    });
    const { result } = renderKeyboard(ctx);

    act(() => {
      result.current.keyboard.onSegmentTextareaKeyDown(1, makeTextareaKeyEvent("Backspace", textarea));
    });

    expect(mergeWithPrevAt).toHaveBeenCalledWith(1);
  });

  it("merges with next segment on Delete at textarea end", () => {
    const mergeWithNextAt = vi.fn();
    const textarea = document.createElement("textarea");
    textarea.value = "head";
    Object.defineProperty(textarea, "selectionStart", { value: 4, configurable: true });
    Object.defineProperty(textarea, "selectionEnd", { value: 4, configurable: true });
    const ctx = makeCtx({
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "head" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "tail" },
      ],
      selectedIdx: 0,
      mergeWithNextAt,
    });
    const { result } = renderKeyboard(ctx);

    act(() => {
      result.current.keyboard.onSegmentTextareaKeyDown(0, makeTextareaKeyEvent("Delete", textarea));
    });

    expect(mergeWithNextAt).toHaveBeenCalledWith(0);
  });

  it("advances to next segment on ArrowDown", () => {
    const ctx = makeCtx({
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
      ],
      selectedIdx: 0,
    });
    const textarea = document.createElement("textarea");
    const { result } = renderKeyboard(ctx);

    act(() => {
      result.current.keyboard.onSegmentTextareaKeyDown(0, makeTextareaKeyEvent("ArrowDown", textarea));
    });

    expect(result.current.selectSegmentAtRef.current).toHaveBeenCalledWith(1, "list");
    expect(result.current.wfApiRef.current.playSegmentAtIndex).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it("goes to previous segment on ArrowUp", () => {
    const ctx = makeCtx({
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
      ],
      selectedIdx: 1,
    });
    const textarea = document.createElement("textarea");
    const { result } = renderKeyboard(ctx);

    act(() => {
      result.current.keyboard.onSegmentTextareaKeyDown(1, makeTextareaKeyEvent("ArrowUp", textarea));
    });

    expect(result.current.selectSegmentAtRef.current).toHaveBeenCalledWith(0, "list");
    expect(result.current.wfApiRef.current.playSegmentAtIndex).toHaveBeenCalledWith(0, expect.any(Object));
  });

  it("does not jump segments when Shift+ArrowDown (text selection)", () => {
    const ctx = makeCtx({
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
      ],
      selectedIdx: 0,
    });
    const textarea = document.createElement("textarea");
    const { result } = renderKeyboard(ctx);

    act(() => {
      result.current.keyboard.onSegmentTextareaKeyDown(
        0,
        makeTextareaKeyEvent("ArrowDown", textarea, { shiftKey: true }),
      );
    });

    expect(result.current.selectSegmentAtRef.current).not.toHaveBeenCalled();
  });
});
