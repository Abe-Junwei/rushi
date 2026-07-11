// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { revealSegmentInView } = vi.hoisted(() => ({
  revealSegmentInView: vi.fn(() => true),
}));
vi.mock("../components/editor/core/revealSegment", () => ({
  revealSegmentInView,
}));
vi.mock("../components/editor/core/transcriptEditorViewHandle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../components/editor/core/transcriptEditorViewHandle")>();
  return {
    ...actual,
    getTranscriptEditorView: () => ({ focus: vi.fn() } as never),
    dispatchTranscriptEditorSelection: vi.fn(),
  };
});

import { useTranscriptionLayerSelection } from "./useTranscriptionLayerSelection";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";
import { resetTranscriptProjectionForTests } from "../components/editor/core/transcriptProjection";
import { resetWaveformSegmentPreviewViewportSyncForTests } from "../services/waveform/waveformSegmentSelectPreviewSync";

function makeCtx(): TranscriptionLayerInput {
  const segments = Array.from({ length: 5 }, (_, idx) => ({
    uid: `seg-${idx}`,
    idx,
    start_sec: idx * 2,
    end_sec: idx * 2 + 1.5,
    text: `语段 ${idx + 1}`,
  }));
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

function makeTimeline() {
  return {
    timelineMetrics: { mediaDurationSec: 10 },
    tierScrollRef: { current: null },
    wfApiRef: { current: { seek: vi.fn(), clientXToTimeSec: vi.fn(() => 0) } },
    zoom: { layoutIntentRef: { current: "manual" as const } },
    viewportFit: { revealSegmentInViewport: vi.fn(), zoomToFitSegment: vi.fn() },
    suppressPlaybackFollowForSelectionSeek: vi.fn(),
  };
}

describe("useTranscriptionLayerSelection preview dedup", () => {
  beforeEach(() => {
    resetTranscriptProjectionForTests();
    resetWaveformSegmentPreviewViewportSyncForTests();
    revealSegmentInView.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("runs CM6 list reveal once across pointerdown preview and pointerup commit", () => {
    const ctx = makeCtx();
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    const listRoot = document.createElement("div");
    Object.defineProperty(listRoot, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(listRoot, "clientHeight", { value: 400, configurable: true });
    listRoot.scrollTop = 0;
    document.body.appendChild(listRoot);

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef: { current: listRoot },
      }),
    );

    act(() => {
      result.current.dispatchWaveformSelectionGesture({ phase: "down", idx: 3 });
    });
    expect(revealSegmentInView).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.selectSegmentAt(3, "waveform");
    });
    expect(revealSegmentInView).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate seek/reveal on pointerdown then pointerup gesture", () => {
    const ctx = makeCtx();
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    const listRoot = document.createElement("div");
    Object.defineProperty(listRoot, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(listRoot, "clientHeight", { value: 400, configurable: true });
    listRoot.scrollTop = 0;
    document.body.appendChild(listRoot);

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef: { current: listRoot },
      }),
    );

    act(() => {
      result.current.dispatchWaveformSelectionGesture({ phase: "down", idx: 3 });
    });

    expect(timeline.wfApiRef.current.seek).toHaveBeenCalledTimes(1);
    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalledTimes(1);
    expect(revealSegmentInView).toHaveBeenCalledTimes(1);

    timeline.wfApiRef.current.seek.mockClear();
    timeline.viewportFit.revealSegmentInViewport.mockClear();
    revealSegmentInView.mockClear();

    act(() => {
      result.current.dispatchWaveformSelectionGesture({
        phase: "up",
        idx: 3,
        pointerTimeSec: 6.02,
        selectedIdxAtPointerDown: 0,
        viewportSyncedOnDown: true,
      });
    });

    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
    expect(timeline.viewportFit.revealSegmentInViewport).not.toHaveBeenCalled();
    expect(revealSegmentInView).not.toHaveBeenCalled();
  });
});
