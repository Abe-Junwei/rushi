// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTranscriptionLayerSelection } from "./useTranscriptionLayerSelection";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";
import {
  getSelectionChromeSnapshot,
  resetSelectionChromeStoreForTests,
} from "../services/selection/selectionChromeStore";

function makeSegments(count: number) {
  return Array.from({ length: count }, (_, idx) => ({
    uid: `seg-${idx}`,
    idx,
    start_sec: idx * 2,
    end_sec: idx * 2 + 1.5,
    text: `语段 ${idx + 1}`,
  }));
}

function makeCtx(segmentCount: number, selectedIdx = 0): TranscriptionLayerInput {
  const segments = makeSegments(segmentCount);
  return {
    projectId: "p1",
    fileId: "f1",
    mediaUrl: null,
    segments,
    selectedIdx,
    busy: false,
    selectionLo: selectedIdx,
    selectionHi: selectedIdx,
    selectionRangeAnchorIdx: selectedIdx,
    selectionCount: 1,
    isMultiSegmentSelection: false,
    isContiguousSelection: true,
    selectedIndicesArray: [selectedIdx],
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
    wfApiRef: {
      current: {
        seek: vi.fn(),
        clientXToTimeSec: vi.fn(() => 0),
      },
    },
    zoom: { layoutIntentRef: { current: "manual" as const } },
    viewportFit: {
      revealSegmentInViewport: vi.fn(),
      zoomToFitSegment: vi.fn(),
    },
    suppressPlaybackFollowForSelectionSeek: vi.fn(),
  };
}

describe("useTranscriptionLayerSelection chrome sync", () => {
  beforeEach(() => {
    resetSelectionChromeStoreForTests();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("list click on idx 0 repaints chrome after store reset while React selectedIdx stays 0", () => {
    const ctx = makeCtx(5, 0);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    const setSelectedIdxUi = vi.fn();
    const listRoot = document.createElement("div");
    document.body.appendChild(listRoot);

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef: { current: listRoot },
        setSelectedIdxUi,
      }),
    );

    expect(getSelectionChromeSnapshot().primaryIdx).toBe(-1);

    act(() => {
      result.current.selectSegmentAt(0, "list");
    });

    expect(getSelectionChromeSnapshot().primaryIdx).toBe(0);
    expect(setSelectedIdxUi).toHaveBeenCalledWith(0, undefined);
  });
});
