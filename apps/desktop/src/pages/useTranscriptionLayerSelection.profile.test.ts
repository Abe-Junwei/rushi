import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTranscriptionLayerSelection } from "./useTranscriptionLayerSelection";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";
import {
  readRecentSelectionLatencyProfileLines,
  resetSelectionLatencyProfileForTests,
  setSelectionLatencyProfileEnabled,
} from "../services/ui/selectionLatencyProfile";
import { resetWaveformSegmentPreviewViewportSyncForTests } from "../services/waveform/waveformSegmentSelectPreviewSync";
import {
  resetTranscriptProjectionForTests,
  seedTranscriptProjectionForTests,
} from "../components/editor/core/transcriptProjection";

function makeSegments(count: number) {
  return Array.from({ length: count }, (_, idx) => ({
    uid: `seg-${idx}`,
    idx,
    start_sec: idx * 2,
    end_sec: idx * 2 + 1.5,
    text: `语段 ${idx + 1}`,
  }));
}

function makeCtx(segmentCount: number): TranscriptionLayerInput {
  const segments = makeSegments(segmentCount);
  return {
    projectId: "p1",
    fileId: "f1",
    mediaUrl: null,
    segments,
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
    saveSegments: vi.fn(() => Promise.resolve(true)),
    triggerFindReplaceShortcut: vi.fn(),
    closeFile: vi.fn(),
    openEnvironment: vi.fn(),
    openSegmentAnnotationDialog: vi.fn(),
    openManualCorrectionMemoryDialog: vi.fn(),
  };
}

function makeTimeline(layoutIntent: "manual" | "fit-selection" | "fit-all" = "manual") {
  const revealSegmentInViewport = vi.fn();
  const zoomToFitSegment = vi.fn();
  const suppressPlaybackFollowForSelectionSeek = vi.fn();
  return {
    timelineMetrics: { mediaDurationSec: 10 },
    tierScrollRef: { current: null },
    wfApiRef: {
      current: {
        seek: vi.fn(),
        clientXToTimeSec: vi.fn(() => 0),
      },
    },
    zoom: { layoutIntentRef: { current: layoutIntent } },
    viewportFit: { revealSegmentInViewport, zoomToFitSegment },
    suppressPlaybackFollowForSelectionSeek,
  };
}

describe("useTranscriptionLayerSelection profile", () => {
  beforeEach(() => {
    resetWaveformSegmentPreviewViewportSyncForTests();
    const data = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
        removeItem: (key: string) => data.delete(key),
        clear: () => data.clear(),
      },
    });
    resetSelectionLatencyProfileForTests();
    setSelectionLatencyProfileEnabled(true);
    resetTranscriptProjectionForTests();
    resetWaveformSegmentPreviewViewportSyncForTests();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSelectionLatencyProfileForTests();
    setSelectionLatencyProfileEnabled(false);
    resetTranscriptProjectionForTests();
  });

  it("records profile spans for list selection without runaway rerenders", () => {
    const ctx = makeCtx(5);
    const selectedIdxRef = { current: 0 };
    ctx.selectedIdxRef = selectedIdxRef;
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();

    const segmentListRef = { current: null as HTMLDivElement | null };
    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
        selectedIdxRef,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "list");
    });

    expect(selectedIdxRef.current).toBe(2);
    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalled();
    expect(timeline.viewportFit.zoomToFitSegment).not.toHaveBeenCalled();
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();

    const lines = readRecentSelectionLatencyProfileLines();
    const dataLines = lines.filter((line) => line.includes("list idx=2") && line.includes("total="));
    expect(dataLines.length).toBeGreaterThan(0);
    expect(dataLines[0]).toMatch(/flushSelectedIdx=/);
    expect(dataLines[0]).toMatch(/viewport=/);
  });

  it("listAdvance reveals without seek", () => {
    const ctx = makeCtx(5);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();

    const segmentListRef = { current: null as HTMLDivElement | null };
    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(3, "listAdvance");
    });

    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalled();
    expect(timeline.viewportFit.zoomToFitSegment).not.toHaveBeenCalled();
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
  });

  it("listKeyboard reveals once on burst finalize when editor focus gate open and does not seek", () => {
    const ctx = makeCtx(5);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    document.body.innerHTML = `
      <div data-seg-row="0">
        <textarea aria-label="语段正文" class="seg-text"></textarea>
      </div>
    `;
    document.querySelector("textarea")!.focus();

    const segmentListRef = { current: null as HTMLDivElement | null };
    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "listKeyboard", { burst: true });
    });

    expect(timeline.viewportFit.revealSegmentInViewport).not.toHaveBeenCalled();
    act(() => {
      result.current.finalizeListKeyboardViewport(2);
    });
    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalledTimes(1);
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
    document.body.innerHTML = "";
  });

  it("listKeyboard burst step defers tier reveal until keyup finalize", () => {
    const ctx = makeCtx(5);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    document.body.innerHTML = `<button type="button">hub</button>`;
    document.querySelector("button")!.focus();

    const segmentListRef = { current: null as HTMLDivElement | null };
    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "listKeyboard", { burst: true });
    });

    expect(timeline.viewportFit.revealSegmentInViewport).not.toHaveBeenCalled();
    act(() => {
      result.current.finalizeListKeyboardViewport(2);
    });
    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalledTimes(1);
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
    document.body.innerHTML = "";
  });

  it("finalizeListKeyboardViewport(revealIdx) reveals when focus gate closed", () => {
    const ctx = makeCtx(5);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    document.body.innerHTML = `<button type="button">hub</button>`;
    document.querySelector("button")!.focus();

    const segmentListRef = { current: null as HTMLDivElement | null };
    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "listKeyboard", { burst: true });
    });
    timeline.viewportFit.revealSegmentInViewport.mockClear();

    act(() => {
      result.current.finalizeListKeyboardViewport(2);
    });
    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalledWith({
      start_sec: 4,
      end_sec: 5.5,
    });
    document.body.innerHTML = "";
  });

  it("non-burst listKeyboard skips reveal when editor focus gate closed", () => {
    const ctx = makeCtx(5);
    const selectedIdxRef = { current: 0 };
    ctx.selectedIdxRef = selectedIdxRef;
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    document.body.innerHTML = `<button type="button">hub</button>`;
    document.querySelector("button")!.focus();

    const segmentListRef = { current: null as HTMLDivElement | null };
    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
        selectedIdxRef,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "listKeyboard");
    });

    expect(selectedIdxRef.current).toBe(2);
    expect(timeline.viewportFit.revealSegmentInViewport).not.toHaveBeenCalled();
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
    document.body.innerHTML = "";
  });

  it("U18: listKeyboard burst mid-steps emit no profile lines; keyup commit emits one", async () => {
    setSelectionLatencyProfileEnabled(true);
    const ctx = makeCtx(8);
    const selectedIdxRef = { current: 0 };
    ctx.selectedIdxRef = selectedIdxRef;
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    const segmentListRef = { current: null as HTMLDivElement | null };
    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
        selectedIdxRef,
      }),
    );

    act(() => {
      for (let i = 1; i <= 5; i += 1) {
        result.current.selectSegmentAt(i, "listKeyboard", { burst: true });
      }
    });
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });

    const midBurst = readRecentSelectionLatencyProfileLines().filter((line) =>
      line.includes("[selection-profile]"),
    );
    expect(midBurst).toHaveLength(0);
    expect(selectedIdxRef.current).toBe(5);

    act(() => {
      result.current.commitListKeyboardBurst(5);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const afterCommit = readRecentSelectionLatencyProfileLines().filter((line) =>
      line.includes("listKeyboard commit idx=5"),
    );
    expect(afterCommit.length).toBe(1);
    expect(afterCommit[0]).toMatch(/listCommit=/);
  });

  it("waveform selection centers without zooming even in fit-selection layout", () => {
    const ctx = makeCtx(5);
    const selectedIdxRef = { current: 0 };
    ctx.selectedIdxRef = selectedIdxRef;
    const ctxRef = { current: ctx };
    const timeline = makeTimeline("fit-selection");
    const waveformShell = document.createElement("div");
    waveformShell.tabIndex = -1;
    document.body.appendChild(waveformShell);
    const segmentListRef = { current: null as HTMLDivElement | null };

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: waveformShell },
        segmentListRef,
        selectedIdxRef,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "waveform");
    });

    expect(selectedIdxRef.current).toBe(2);
    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalledWith(
      expect.objectContaining({ start_sec: 4, end_sec: 5.5 }),
    );
    expect(timeline.viewportFit.zoomToFitSegment).not.toHaveBeenCalled();
    expect(timeline.wfApiRef.current.seek).toHaveBeenCalledWith(4);
    expect(document.activeElement).toBe(waveformShell);
  });

  it("waveformKeyboard updates selectedIdxRef and seeks during burst steps", () => {
    const ctx = makeCtx(5);
    const selectedIdxRef = { current: 0 };
    ctx.selectedIdxRef = selectedIdxRef;
    const ctxRef = { current: ctx };
    const timeline = makeTimeline("fit-selection");
    const waveformShell = document.createElement("div");
    waveformShell.tabIndex = -1;
    document.body.appendChild(waveformShell);
    const segmentListRef = { current: null as HTMLDivElement | null };

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: waveformShell },
        segmentListRef,
        selectedIdxRef,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "waveformKeyboard");
      result.current.selectSegmentAt(3, "waveformKeyboard");
    });

    expect(selectedIdxRef.current).toBe(3);
    expect(timeline.wfApiRef.current.seek).toHaveBeenCalledWith(6);
    expect(timeline.viewportFit.revealSegmentInViewport).not.toHaveBeenCalled();
  });

  it("seeks on waveform segment change (CM6 path; SC2 paint skipped)", () => {
    const ctx = makeCtx(5);
    const selectedIdxRef = { current: 0 };
    ctx.selectedIdxRef = selectedIdxRef;
    const ctxRef = { current: ctx };
    const timeline = makeTimeline("fit-selection");
    const segmentListRef = { current: null as HTMLDivElement | null };
    resetTranscriptProjectionForTests();

    timeline.wfApiRef.current.seek = vi.fn();

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
        selectedIdxRef,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "waveform");
    });

    expect(timeline.wfApiRef.current.seek).toHaveBeenCalled();
    expect(selectedIdxRef.current).toBe(2);
  });

  it("dispatchWaveformSelectionGesture down syncs seek+reveal on pointerdown when idx changes", async () => {
    const ctx = makeCtx(5);
    const selectedIdxRef = { current: 0 };
    ctx.selectedIdxRef = selectedIdxRef;
    const ctxRef = { current: ctx };
    const timeline = makeTimeline("fit-selection");
    const segmentListRef = { current: null as HTMLDivElement | null };
    resetTranscriptProjectionForTests();

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
        selectedIdxRef,
      }),
    );

    act(() => {
      result.current.dispatchWaveformSelectionGesture({ phase: "down", idx: 3 });
    });

    expect(timeline.suppressPlaybackFollowForSelectionSeek).toHaveBeenCalledOnce();
    expect(timeline.wfApiRef.current.seek).toHaveBeenCalledWith(6);
    expect(selectedIdxRef.current).toBe(3);

    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    });

    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalledWith(
      expect.objectContaining({ start_sec: 6, end_sec: 7.5 }),
    );

    act(() => {
      result.current.dispatchWaveformSelectionGesture({
        phase: "up",
        idx: 3,
        pointerTimeSec: 6.02,
        selectedIdxAtPointerDown: 0,
        viewportSyncedOnDown: true,
      });
    });
    expect(selectedIdxRef.current).toBe(3);
  });

  it("dispatchWaveformSelectionGesture down skips seek when projection already matches tapped idx", () => {
    const ctx = makeCtx(5);
    ctx.selectedIdx = 3;
    const selectedIdxRef = { current: 3 };
    ctx.selectedIdxRef = selectedIdxRef;
    const ctxRef = { current: ctx };
    const timeline = makeTimeline("fit-selection");
    const segmentListRef = { current: null as HTMLDivElement | null };
    resetTranscriptProjectionForTests();
    seedTranscriptProjectionForTests({
      primaryIdx: 3,
      selectedSet: new Set([3]),
      rangeAnchor: 3,
      lineCount: 5,
    });

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
        selectedIdxRef,
      }),
    );

    act(() => {
      result.current.dispatchWaveformSelectionGesture({ phase: "down", idx: 3 });
    });

    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
    expect(timeline.viewportFit.revealSegmentInViewport).not.toHaveBeenCalled();
  });

  it("selectSegmentAt skips duplicate seek/reveal after pointerdown preview sync", () => {
    const ctx = makeCtx(5);
    const selectedIdxRef = { current: 0 };
    ctx.selectedIdxRef = selectedIdxRef;
    const ctxRef = { current: ctx };
    const timeline = makeTimeline("fit-selection");
    const segmentListRef = { current: null as HTMLDivElement | null };
    resetTranscriptProjectionForTests();

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
        selectedIdxRef,
      }),
    );

    act(() => {
      result.current.dispatchWaveformSelectionGesture({ phase: "down", idx: 3 });
    });
    timeline.wfApiRef.current.seek.mockClear();
    timeline.viewportFit.revealSegmentInViewport.mockClear();
    timeline.suppressPlaybackFollowForSelectionSeek.mockClear();

    act(() => {
      result.current.selectSegmentAt(3, "waveform");
    });

    expect(selectedIdxRef.current).toBe(3);
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
    expect(timeline.viewportFit.revealSegmentInViewport).not.toHaveBeenCalled();
    expect(timeline.suppressPlaybackFollowForSelectionSeek).not.toHaveBeenCalled();
  });

  it("preview path marks firstPaint immediately on pointerdown+commit", () => {
    const ctx = makeCtx(5);
    const selectedIdxRef = { current: 0 };
    ctx.selectedIdxRef = selectedIdxRef;
    const ctxRef = { current: ctx };
    const timeline = makeTimeline("fit-selection");
    const segmentListRef = { current: document.createElement("div") };
    resetTranscriptProjectionForTests();

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
        selectedIdxRef,
      }),
    );

    act(() => {
      result.current.dispatchWaveformSelectionGesture({ phase: "down", idx: 3 });
    });
    act(() => {
      result.current.selectSegmentAt(3, "waveform");
    });

    expect(selectedIdxRef.current).toBe(3);
    const lines = readRecentSelectionLatencyProfileLines();
    const profile = lines.find((line) => line.includes("waveform idx=3"));
    expect(profile).toBeDefined();
    expect(profile).toMatch(/firstPaint=[\d.]+ms/);
  });

  it("playing pointerdown defers seek; pointerup selectAndSeekStart still seeks segment start", () => {
    const ctx = makeCtx(5);
    ctx.selectedIdx = 0;
    const selectedIdxRef = { current: 0 };
    ctx.selectedIdxRef = selectedIdxRef;
    const ctxRef = { current: ctx };
    const timeline = makeTimeline("fit-selection");
    (timeline as { wf?: { isPlaying: boolean } }).wf = { isPlaying: true };
    resetTranscriptProjectionForTests();

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef: { current: null },
        selectedIdxRef,
      }),
    );

    act(() => {
      const synced = result.current.dispatchWaveformSelectionGesture({
        phase: "down",
        idx: 3,
        sessionId: "play-s1",
      });
      expect(synced).toBe(false);
    });
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();

    act(() => {
      result.current.dispatchWaveformSelectionGesture({
        phase: "up",
        idx: 3,
        pointerTimeSec: 6.8,
        selectedIdxAtPointerDown: 0,
        viewportSyncedOnDown: false,
        sessionId: "play-s1",
      });
    });

    expect(timeline.wfApiRef.current.seek).toHaveBeenCalledWith(6);
    expect(selectedIdxRef.current).toBe(3);
  });

  it("selectSegmentAt with preferSegmentTextFocus skips waveform shell focus", () => {
    const ctx = makeCtx(5);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline("fit-selection");
    const waveformShell = document.createElement("div");
    const focusSpy = vi.spyOn(waveformShell, "focus");
    const waveformShellRef = { current: waveformShell };

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef,
        segmentListRef: { current: null },
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "waveform", { preferSegmentTextFocus: true });
    });

    expect(focusSpy).not.toHaveBeenCalled();
    focusSpy.mockRestore();
  });
});
