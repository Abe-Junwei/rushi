import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTranscriptionLayerSelection } from "./useTranscriptionLayerSelection";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";
import {
  readRecentSelectionLatencyProfileLines,
  resetSelectionLatencyProfileForTests,
  setSelectionLatencyProfileEnabled,
} from "../services/ui/selectionLatencyProfile";

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
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSelectionLatencyProfileForTests();
    setSelectionLatencyProfileEnabled(false);
  });

  it("records profile spans for list selection without runaway rerenders", () => {
    const ctx = makeCtx(5);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    const setSelectedIdxUi = vi.fn();

    const segmentListRef = { current: null as HTMLDivElement | null };
    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
        setSelectedIdxUi,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "list");
    });

    expect(setSelectedIdxUi).toHaveBeenCalledWith(2, undefined);
    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalled();
    expect(timeline.viewportFit.zoomToFitSegment).not.toHaveBeenCalled();
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
    expect(setSelectedIdxUi.mock.invocationCallOrder[0]).toBeLessThan(
      timeline.viewportFit.revealSegmentInViewport.mock.invocationCallOrder[0],
    );

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
    const setSelectedIdxUi = vi.fn();

    const segmentListRef = { current: null as HTMLDivElement | null };
    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef,
        setSelectedIdxUi,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(3, "listAdvance");
    });

    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalled();
    expect(timeline.viewportFit.zoomToFitSegment).not.toHaveBeenCalled();
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
  });

  it("listKeyboard reveals when editor focus gate open and does not seek", () => {
    vi.useFakeTimers();
    const ctx = makeCtx(5);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    const setSelectedIdxUi = vi.fn();
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
        setSelectedIdxUi,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "listKeyboard");
    });

    expect(timeline.viewportFit.revealSegmentInViewport).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(180);
    });
    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalled();
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("listKeyboard skips reveal when editor focus gate closed", () => {
    const ctx = makeCtx(5);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    const setSelectedIdxUi = vi.fn();
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
        setSelectedIdxUi,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "listKeyboard");
    });

    expect(timeline.viewportFit.revealSegmentInViewport).not.toHaveBeenCalled();
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
    document.body.innerHTML = "";
  });

  it("waveform selection centers without zooming even in fit-selection layout", () => {
    const ctx = makeCtx(5);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline("fit-selection");
    const setSelectedIdxUi = vi.fn();
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
        setSelectedIdxUi,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "waveform");
    });

    expect(setSelectedIdxUi).toHaveBeenCalledWith(2, undefined);
    expect(setSelectedIdxUi.mock.invocationCallOrder[0]).toBeLessThan(
      timeline.viewportFit.revealSegmentInViewport.mock.invocationCallOrder[0],
    );
    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalledWith({
      start_sec: 4,
      end_sec: 5.5,
    });
    expect(timeline.viewportFit.zoomToFitSegment).not.toHaveBeenCalled();
    expect(timeline.wfApiRef.current.seek).toHaveBeenCalledWith(4);
    expect(timeline.wfApiRef.current.seek.mock.invocationCallOrder[0]).toBeLessThan(
      setSelectedIdxUi.mock.invocationCallOrder[0],
    );
    expect(document.activeElement).toBe(waveformShell);
  });
});
