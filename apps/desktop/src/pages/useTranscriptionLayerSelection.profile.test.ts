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

function makeTimeline() {
  const revealSegmentInViewport = vi.fn();
  const zoomToFitSegment = vi.fn();
  return {
    timelineMetrics: { mediaDurationSec: 10 },
    tierScrollRef: { current: null },
    wfApiRef: {
      current: {
        seek: vi.fn(),
        clientXToTimeSec: vi.fn(() => 0),
      },
    },
    zoom: { layoutIntentRef: { current: "manual" as const } },
    viewportFit: { revealSegmentInViewport, zoomToFitSegment },
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

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        setSelectedIdxUi,
      }),
    );

    act(() => {
      result.current.selectSegmentAt(2, "list");
    });

    expect(setSelectedIdxUi).toHaveBeenCalledWith(2, undefined);
    expect(timeline.viewportFit.zoomToFitSegment).toHaveBeenCalled();
    expect(timeline.wfApiRef.current.seek).toHaveBeenCalled();

    const lines = readRecentSelectionLatencyProfileLines();
    const dataLines = lines.filter((line) => line.includes("list idx=2") && line.includes("total="));
    expect(dataLines.length).toBeGreaterThan(0);
    expect(dataLines[0]).toMatch(/flushSelectedIdx=/);
    expect(dataLines[0]).toMatch(/viewport=/);
  });
});
