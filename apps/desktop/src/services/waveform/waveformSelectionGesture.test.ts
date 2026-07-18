// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  dispatchWaveformSelectionGestureDown,
  dispatchWaveformSelectionGestureUp,
} from "./waveformSelectionGesture";
import {
  resetTranscriptProjectionForTests,
  seedTranscriptProjectionForTests,
} from "../../components/editor/core/transcriptProjection";
import type { TranscriptionLayerInput } from "../../pages/transcriptionLayerTypes";

const { revealSegmentInView, dispatchTranscriptEditorSelection } = vi.hoisted(() => ({
  revealSegmentInView: vi.fn(() => true),
  dispatchTranscriptEditorSelection: vi.fn(),
}));

vi.mock("../../components/editor/core/revealSegment", () => ({
  revealSegmentInView,
}));

vi.mock("../../components/editor/core/transcriptEditorViewHandle", () => ({
  getTranscriptEditorView: () => ({ state: {}, dispatch: vi.fn() }),
  dispatchTranscriptEditorSelection,
}));

function makeCtx(selectedIdx = 0): TranscriptionLayerInput {
  return {
    projectId: "p1",
    fileId: "f1",
    mediaUrl: null,
    segments: [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
      { uid: "b", idx: 1, start_sec: 2, end_sec: 3, text: "b" },
    ],
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
    markSegmentFirstProof: vi.fn(() => Promise.resolve(true)),
    saveSegments: vi.fn(() => Promise.resolve(true)),
    triggerFindReplaceShortcut: vi.fn(),
    closeFile: vi.fn(),
    openEnvironment: vi.fn(),
    openSegmentAnnotationDialog: vi.fn(),
    toggleSegmentFrozen: vi.fn(),
    openManualCorrectionMemoryDialog: vi.fn(),
  };
}

function makeTimeline() {
  return {
    suppressPlaybackFollowForSelectionSeek: vi.fn(),
    wfApiRef: { current: { seek: vi.fn() } },
    viewportFit: { revealSegmentInViewport: vi.fn() },
  };
}

function seedPrimary(idx: number) {
  seedTranscriptProjectionForTests({
    primaryIdx: idx,
    selectedSet: new Set([idx]),
    rangeAnchor: idx,
    lineCount: 2,
  });
}

describe("dispatchWaveformSelectionGestureDown (P9a CM6)", () => {
  beforeEach(() => {
    resetTranscriptProjectionForTests();
    revealSegmentInView.mockClear();
    dispatchTranscriptEditorSelection.mockClear();
    seedPrimary(0);
  });

  afterEach(() => {
    resetTranscriptProjectionForTests();
  });

  it("syncs seek immediately and CM6 reveal in the same turn when idx changes", () => {
    const ctx = makeCtx(0);
    const timeline = makeTimeline();
    const paintChrome = vi.fn();
    const runListScroll = vi.fn();
    const commitSelectedIdxRef = vi.fn();

    const result = dispatchWaveformSelectionGestureDown(
      ctx,
      timeline,
      1,
      {
        paintChrome,
        runListScroll,
        commitSelectedIdxRef,
      },
      "s1",
    );

    expect(result).toEqual({ applied: true, viewportSyncedOnDown: true });
    expect(timeline.wfApiRef.current.seek).toHaveBeenCalledWith(2);
    expect(timeline.viewportFit.revealSegmentInViewport).toHaveBeenCalled();
    expect(dispatchTranscriptEditorSelection).toHaveBeenCalledWith(1);
    expect(revealSegmentInView).toHaveBeenCalled();
    expect(paintChrome).not.toHaveBeenCalled();
    expect(runListScroll).not.toHaveBeenCalled();
    expect(commitSelectedIdxRef).toHaveBeenCalledWith(1);
  });

  it("defers preview seek to pointerup while media is playing", () => {
    const ctx = makeCtx(0);
    const timeline = makeTimeline();
    const paintChrome = vi.fn();
    const runListScroll = vi.fn();

    const result = dispatchWaveformSelectionGestureDown(
      ctx,
      timeline,
      1,
      {
        paintChrome,
        runListScroll,
        commitSelectedIdxRef: vi.fn(),
        isMediaPlaying: () => true,
      },
      "s1",
    );

    expect(result).toEqual({ applied: true, viewportSyncedOnDown: false });
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
    expect(timeline.viewportFit.revealSegmentInViewport).not.toHaveBeenCalled();
    expect(revealSegmentInView).toHaveBeenCalled();
    expect(paintChrome).not.toHaveBeenCalled();
    expect(runListScroll).not.toHaveBeenCalled();
  });

  it("skips preview seek when CM6 primary already matches tapped idx", () => {
    seedPrimary(1);
    const ctx = makeCtx(0);
    const timeline = makeTimeline();
    const runListScroll = vi.fn();

    const result = dispatchWaveformSelectionGestureDown(ctx, timeline, 1, {
      paintChrome: vi.fn(),
      runListScroll,
      commitSelectedIdxRef: vi.fn(),
    });

    expect(result).toEqual({ applied: false, viewportSyncedOnDown: false });
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
    expect(runListScroll).not.toHaveBeenCalled();
  });

  it("skips viewport when idx unchanged and projection in sync", () => {
    const ctx = makeCtx(0);
    const timeline = makeTimeline();
    const paintChrome = vi.fn();
    const runListScroll = vi.fn();

    const result = dispatchWaveformSelectionGestureDown(ctx, timeline, 0, {
      paintChrome,
      runListScroll,
      commitSelectedIdxRef: vi.fn(),
    });

    expect(result).toEqual({ applied: false, viewportSyncedOnDown: false });
    expect(timeline.wfApiRef.current.seek).not.toHaveBeenCalled();
    expect(runListScroll).not.toHaveBeenCalled();
    expect(paintChrome).not.toHaveBeenCalled();
  });

  it("does not repaint SC2 when idx unchanged (CM6 owns selection)", () => {
    const ctx = makeCtx(0);
    const timeline = makeTimeline();
    const paintChrome = vi.fn();

    const result = dispatchWaveformSelectionGestureDown(ctx, timeline, 0, {
      paintChrome,
      runListScroll: vi.fn(),
      commitSelectedIdxRef: vi.fn(),
    });

    expect(result).toEqual({ applied: false, viewportSyncedOnDown: false });
    expect(paintChrome).not.toHaveBeenCalled();
  });

  it("pointerdown then pointerup selects without requiring SC2 version bump", () => {
    const ctx = makeCtx(0);
    const timeline = makeTimeline();
    const selectSegmentAt = vi.fn();

    dispatchWaveformSelectionGestureDown(
      ctx,
      timeline,
      1,
      { paintChrome: vi.fn(), commitSelectedIdxRef: vi.fn(), runListScroll: vi.fn() },
      "s1",
    );
    expect(dispatchTranscriptEditorSelection).toHaveBeenCalledWith(1);

    dispatchWaveformSelectionGestureUp(
      ctx,
      {
        idx: 1,
        pointerTimeSec: 2.02,
        selectedIdxAtPointerDown: 0,
        viewportSyncedOnDown: true,
        sessionId: "s1",
      },
      { selectSegmentAt, seekToTime: vi.fn() },
    );

    expect(selectSegmentAt).toHaveBeenCalledWith(1, "waveform", { previewSessionId: "s1" });
  });
});

describe("dispatchWaveformSelectionGestureUp", () => {
  beforeEach(() => {
    resetTranscriptProjectionForTests();
    seedPrimary(0);
  });

  afterEach(() => {
    resetTranscriptProjectionForTests();
  });

  it("selects on pointerup when idx changed from pointerdown", () => {
    const ctx = makeCtx(0);
    const selectSegmentAt = vi.fn();
    const seekToTime = vi.fn();

    dispatchWaveformSelectionGestureUp(
      ctx,
      {
        idx: 1,
        pointerTimeSec: 2.5,
        selectedIdxAtPointerDown: 0,
        viewportSyncedOnDown: true,
      },
      { selectSegmentAt, seekToTime },
    );

    expect(selectSegmentAt).toHaveBeenCalledWith(1, "waveform", undefined);
    expect(seekToTime).not.toHaveBeenCalled();
  });

  it("seeks within segment when same idx as pointerdown", () => {
    seedPrimary(1);
    const ctx = makeCtx(1);
    const selectSegmentAt = vi.fn();
    const seekToTime = vi.fn();

    dispatchWaveformSelectionGestureUp(
      ctx,
      {
        idx: 1,
        pointerTimeSec: 2.5,
        selectedIdxAtPointerDown: 1,
        viewportSyncedOnDown: false,
      },
      { selectSegmentAt, seekToTime },
    );

    expect(selectSegmentAt).not.toHaveBeenCalled();
    expect(seekToTime).toHaveBeenCalled();
  });
});
