import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useRef } from "react";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import { useEditorShortcutDispatcher } from "./useEditorShortcutDispatcher";
import { createEmptySegmentListFilterNavState } from "../utils/segmentListFilterNav";

function makeCtx(overrides: Partial<TranscriptionLayerInput> = {}): TranscriptionLayerInput {
  return {
    projectId: "p1",
    fileId: "f1",
    mediaUrl: "media",
    segments: [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
      { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
    ],
    selectedIdx: 0,
    busy: false,
    selectionLo: 0,
    selectionHi: 0,
    selectionRangeAnchorIdx: 0,
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
    markSegmentFirstProof: vi.fn(() => Promise.resolve(true)),
    saveSegments: vi.fn(() => Promise.resolve(true)),
    triggerFindReplaceShortcut: vi.fn(),
    closeFile: vi.fn(),
    openEnvironment: vi.fn(),
    openSegmentAnnotationDialog: vi.fn(),
    toggleSegmentFrozen: vi.fn(),
    openManualCorrectionMemoryDialog: vi.fn(),
    ...overrides,
  };
}

function dispatchKey(opts: Partial<KeyboardEventInit> & { key: string }) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  Object.defineProperty(event, "target", { value: document.body, configurable: true });
  window.dispatchEvent(event);
}

function mountDispatcher(
  ctx: TranscriptionLayerInput,
  opts: {
    waveformShell?: HTMLElement;
    tierScroll?: HTMLElement;
    scheduleAdvanceToSegment?: ReturnType<typeof vi.fn>;
    selectSegmentAt?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const waveformShellRef = { current: opts.waveformShell ?? null };
  const tierScrollRef = { current: opts.tierScroll ?? null };
  const scheduleAdvanceToSegment = (opts.scheduleAdvanceToSegment ?? vi.fn()) as (targetIdx: number) => void;
  const scheduleAdvanceToSegmentRef = { current: scheduleAdvanceToSegment };
  const selectSegmentAt = (opts.selectSegmentAt ?? vi.fn()) as (
    idx: number,
    source?: string,
    opts?: { shiftKey?: boolean },
  ) => void;
  const selectSegmentAtRef = { current: selectSegmentAt };
  const hook = renderHook(() => {
    const ctxRef = useRef(ctx);
    ctxRef.current = ctx;
    const wfApiRef = useRef({
      togglePlay: vi.fn(),
      handleToggleSelectedWaveformPlay: vi.fn(),
      getPlayheadTime: () => 0.5,
      playSegmentAtIndex: vi.fn(),
      preserveLoopForNextSegmentSelect: vi.fn(),
      seekByDelta: vi.fn(),
    });
    selectSegmentAtRef.current = selectSegmentAt;
    useEditorShortcutDispatcher({
      enabled: true,
      ctxRef,
      wfApiRef: wfApiRef as never,
      waveformShellRef,
      tierScrollRef,
      selectSegmentAtRef,
      focusSegmentTextarea: vi.fn(),
      scheduleAdvanceToSegmentRef,
      showEditorHintRef: useRef(vi.fn()),
      stepWaveformZoomRef: useRef(vi.fn()),
      segmentListFilterNavRef: useRef(createEmptySegmentListFilterNavState()),
    });
    return { wfApiRef, scheduleAdvanceToSegment, selectSegmentAtRef };
  });
  return {
    wfApiRef: hook.result.current.wfApiRef,
    scheduleAdvanceToSegment,
    selectSegmentAtRef: hook.result.current.selectSegmentAtRef,
  };
}

describe("useEditorShortcutDispatcher", () => {
  afterEach(() => {
    cleanup();
  });

  it("merges with next on Cmd+J from window capture", () => {
    const mergeWithNextAt = vi.fn();
    const ctx = makeCtx({ mergeWithNextAt });
    mountDispatcher(ctx);

    act(() => {
      dispatchKey({ key: "j", metaKey: true });
    });

    expect(mergeWithNextAt).toHaveBeenCalledWith(0);
  });

  it("merges with next when focus is in segment textarea", () => {
    const mergeWithNextAt = vi.fn();
    const ctx = makeCtx({ mergeWithNextAt, selectedIdx: 0 });
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "0");
    row.appendChild(textarea);
    document.body.appendChild(row);
    textarea.focus();

    mountDispatcher(ctx);

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "j",
        code: "KeyJ",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "target", { value: textarea, configurable: true });
      window.dispatchEvent(event);
    });

    expect(mergeWithNextAt).toHaveBeenCalledWith(0);
    row.remove();
  });

  it("merges contiguous multi-select on Cmd+J", () => {
    const mergeSegmentRange = vi.fn();
    const ctx = makeCtx({
      selectedIdx: 1,
      selectionLo: 0,
      selectionHi: 1,
      selectionCount: 2,
      isMultiSegmentSelection: true,
      mergeSegmentRange,
    });
    mountDispatcher(ctx);

    act(() => {
      dispatchKey({ key: "j", metaKey: true });
    });

    expect(mergeSegmentRange).toHaveBeenCalledWith(0, 1);
  });

  it("ignores plain Cmd+M", () => {
    const mergeWithNextAt = vi.fn();
    const ctx = makeCtx({ mergeWithNextAt });
    mountDispatcher(ctx);

    act(() => {
      dispatchKey({ key: "m", metaKey: true });
    });

    expect(mergeWithNextAt).not.toHaveBeenCalled();
  });

  it("toggles play on bare Space outside editable fields", () => {
    const togglePlay = vi.fn();
    const ctx = makeCtx();
    const { wfApiRef } = mountDispatcher(ctx);
    wfApiRef.current.togglePlay = togglePlay;

    act(() => {
      dispatchKey({ key: " " });
    });

    expect(togglePlay).toHaveBeenCalledTimes(1);
    expect(wfApiRef.current.handleToggleSelectedWaveformPlay).not.toHaveBeenCalled();
  });

  it("ignores key-repeat Space so concurrent play() cannot deadlock WebKit", () => {
    const togglePlay = vi.fn();
    const ctx = makeCtx();
    const { wfApiRef } = mountDispatcher(ctx);
    wfApiRef.current.togglePlay = togglePlay;

    act(() => {
      dispatchKey({ key: " " });
      dispatchKey({ key: " ", repeat: true });
      dispatchKey({ key: " ", repeat: true });
    });

    expect(togglePlay).toHaveBeenCalledTimes(1);
  });

  it("toggles global play on Shift+Space outside editable fields", () => {
    const togglePlay = vi.fn();
    const ctx = makeCtx();
    const { wfApiRef } = mountDispatcher(ctx);
    wfApiRef.current.togglePlay = togglePlay;

    act(() => {
      dispatchKey({ key: " ", shiftKey: true });
    });

    expect(togglePlay).toHaveBeenCalledTimes(1);
    expect(wfApiRef.current.handleToggleSelectedWaveformPlay).not.toHaveBeenCalled();
  });

  it("does not toggle play on Space inside segment textarea", () => {
    const togglePlay = vi.fn();
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    document.body.appendChild(textarea);
    textarea.focus();
    const ctx = makeCtx();
    const { wfApiRef } = mountDispatcher(ctx);
    wfApiRef.current.togglePlay = togglePlay;

    act(() => {
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    });

    expect(togglePlay).not.toHaveBeenCalled();
    textarea.remove();
  });

  it("does not toggle play on Space inside a generic panel input", () => {
    const togglePlay = vi.fn();
    const input = document.createElement("input");
    input.type = "text";
    document.body.appendChild(input);
    input.focus();
    const ctx = makeCtx();
    const { wfApiRef } = mountDispatcher(ctx);
    wfApiRef.current.togglePlay = togglePlay;

    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: input, configurable: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(togglePlay).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    input.remove();
  });

  it("toggles global play on Shift+Space inside segment textarea", () => {
    const togglePlay = vi.fn();
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    document.body.appendChild(textarea);
    textarea.focus();
    const ctx = makeCtx();
    const { wfApiRef } = mountDispatcher(ctx);
    wfApiRef.current.togglePlay = togglePlay;

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "target", { value: textarea, configurable: true });
      window.dispatchEvent(event);
    });

    expect(togglePlay).toHaveBeenCalledTimes(1);
    expect(wfApiRef.current.handleToggleSelectedWaveformPlay).not.toHaveBeenCalled();
    textarea.remove();
  });

  it("does not toggle play on Shift+Cmd+Space inside segment textarea", () => {
    const togglePlay = vi.fn();
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    document.body.appendChild(textarea);
    textarea.focus();
    const ctx = makeCtx();
    const { wfApiRef } = mountDispatcher(ctx);
    wfApiRef.current.togglePlay = togglePlay;

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "target", { value: textarea, configurable: true });
      window.dispatchEvent(event);
    });

    expect(togglePlay).not.toHaveBeenCalled();
    textarea.remove();
  });

  it("saves segments on Cmd+S", () => {
    const saveSegments = vi.fn(() => Promise.resolve(true));
    const ctx = makeCtx({ saveSegments });
    mountDispatcher(ctx);

    act(() => {
      dispatchKey({ key: "s", metaKey: true });
    });

    expect(saveSegments).toHaveBeenCalledTimes(1);
  });

  it("opens find replace on Cmd+F", () => {
    const triggerFindReplaceShortcut = vi.fn();
    const ctx = makeCtx({ triggerFindReplaceShortcut });
    mountDispatcher(ctx);

    act(() => {
      dispatchKey({ key: "f", metaKey: true });
    });

    expect(triggerFindReplaceShortcut).toHaveBeenCalledTimes(1);
  });

  it("clears multi-selection on Escape inside waveform shell", () => {
    const clearMultiSelection = vi.fn();
    const shell = document.createElement("div");
    document.body.appendChild(shell);
    shell.tabIndex = 0;
    shell.focus();
    const ctx = makeCtx({ isMultiSegmentSelection: true, clearMultiSelection });
    mountDispatcher(ctx, { waveformShell: shell, tierScroll: shell });

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "target", { value: shell, configurable: true });
      window.dispatchEvent(event);
    });

    expect(clearMultiSelection).toHaveBeenCalledTimes(1);
    shell.remove();
  });

  it("opens settings on Cmd+, without an open file", () => {
    const openEnvironment = vi.fn();
    const ctx = makeCtx({ fileId: null, openEnvironment });
    mountDispatcher(ctx);

    act(() => {
      dispatchKey({ key: ",", metaKey: true });
    });

    expect(openEnvironment).toHaveBeenCalledTimes(1);
  });

  it("selects next segment on ArrowRight when focus is on waveform tier scroll", () => {
    const tierScroll = document.createElement("div");
    const shell = document.createElement("div");
    tierScroll.appendChild(shell);
    document.body.appendChild(tierScroll);
    tierScroll.tabIndex = 0;
    tierScroll.focus();
    const selectSegmentAt = vi.fn();
    const ctx = makeCtx({ selectedIdx: 0 });
    mountDispatcher(ctx, { waveformShell: shell, tierScroll, selectSegmentAt });

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "target", { value: tierScroll, configurable: true });
      window.dispatchEvent(event);
    });

    expect(selectSegmentAt).toHaveBeenCalledWith(1, "waveformKeyboard", { shiftKey: false });
    tierScroll.remove();
  });

  it("selects previous segment on ArrowLeft inside waveform shell", () => {
    const shell = document.createElement("div");
    document.body.appendChild(shell);
    shell.tabIndex = 0;
    shell.focus();
    const selectSegmentAt = vi.fn();
    const ctx = makeCtx({ selectedIdx: 1 });
    mountDispatcher(ctx, { waveformShell: shell, tierScroll: shell, selectSegmentAt });

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "target", { value: shell, configurable: true });
      window.dispatchEvent(event);
    });

    expect(selectSegmentAt).toHaveBeenCalledWith(0, "waveformKeyboard", { shiftKey: false });
    shell.remove();
  });

  it("does not select segment on ArrowRight inside transcript textarea", () => {
    const selectSegmentAt = vi.fn();
    const ctx = makeCtx({ selectedIdx: 0 });
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    textarea.className = "seg-text";
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "0");
    row.appendChild(textarea);
    document.body.appendChild(row);
    textarea.focus();
    mountDispatcher(ctx, { selectSegmentAt });

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "target", { value: textarea, configurable: true });
      window.dispatchEvent(event);
    });

    expect(selectSegmentAt).not.toHaveBeenCalled();
    row.remove();
  });

  it("advances segment on ArrowDown when focus is outside textarea", () => {
    const scheduleAdvanceToSegment = vi.fn();
    const ctx = makeCtx({ selectedIdx: 0 });
    mountDispatcher(ctx, { scheduleAdvanceToSegment });

    act(() => {
      dispatchKey({ key: "ArrowDown" });
    });

    expect(scheduleAdvanceToSegment).toHaveBeenCalledWith(1);
  });

  it("seeks on ArrowDown when focus is inside waveform shell", () => {
    const shell = document.createElement("div");
    document.body.appendChild(shell);
    shell.tabIndex = 0;
    shell.focus();
    const selectSegmentAt = vi.fn();
    const scheduleAdvanceToSegment = vi.fn();
    const ctx = makeCtx({ selectedIdx: 0 });
    mountDispatcher(ctx, { waveformShell: shell, tierScroll: shell, selectSegmentAt, scheduleAdvanceToSegment });

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "target", { value: shell, configurable: true });
      window.dispatchEvent(event);
    });

    expect(selectSegmentAt).toHaveBeenCalledWith(1, "waveformKeyboard", { shiftKey: false });
    expect(scheduleAdvanceToSegment).not.toHaveBeenCalled();
    shell.remove();
  });

  it("does not advance segment on ArrowDown inside textarea", () => {
    const scheduleAdvanceToSegment = vi.fn();
    const ctx = makeCtx({ selectedIdx: 0 });
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "0");
    row.appendChild(textarea);
    document.body.appendChild(row);
    textarea.focus();
    mountDispatcher(ctx, { scheduleAdvanceToSegment });

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "target", { value: textarea, configurable: true });
      window.dispatchEvent(event);
    });

    expect(scheduleAdvanceToSegment).not.toHaveBeenCalled();
    row.remove();
  });
});
