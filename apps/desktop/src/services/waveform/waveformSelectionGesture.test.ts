// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  dispatchWaveformSelectionGestureDown,
  dispatchWaveformSelectionGestureUp,
} from "./waveformSelectionGesture";
import { resetSelectionChromeStoreForTests, getSelectionChromeSnapshot } from "../selection/selectionChromeStore";
import { publishSelectionChromeForInput } from "../selection/publishSelectionChromeForInput";
import type { TranscriptionLayerInput } from "../../pages/transcriptionLayerTypes";

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
    suppressPlaybackFollowForSelectionSeek: vi.fn(),
    wfApiRef: { current: { seek: vi.fn() } },
    viewportFit: { revealSegmentInViewport: vi.fn() },
    syncDisplayPlayheadAfterSeek: vi.fn(),
  };
}

describe("dispatchWaveformSelectionGestureDown", () => {
  beforeEach(() => {
    resetSelectionChromeStoreForTests();
  });

  it("syncs seek immediately and defers reveal/list scroll to rAF when idx changes", async () => {
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
    expect(paintChrome).toHaveBeenCalledWith(ctx, 1, undefined, "waveform", {
      skipBandPaint: true,
    });
    expect(commitSelectedIdxRef).toHaveBeenCalledWith(1);
    expect(timeline.viewportFit.revealSegmentInViewport.mock.invocationCallOrder[0]).toBeLessThan(
      timeline.syncDisplayPlayheadAfterSeek.mock.invocationCallOrder[0],
    );
    expect(runListScroll).not.toHaveBeenCalled();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(runListScroll).toHaveBeenCalledWith(1);
  });

  it("skips viewport and list scroll when idx unchanged and chrome in sync", () => {
    const ctx = makeCtx(0);
    const timeline = makeTimeline();
    const paintChrome = vi.fn();
    const runListScroll = vi.fn();
    publishSelectionChromeForInput(
      ctx,
      { primaryIdx: 0, selectedSet: new Set([0]) },
      { listRoot: null, overlayRoot: null },
    );

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

  it("repaints chrome without viewport when idx unchanged but chrome out of sync", () => {
    const ctx = makeCtx(0);
    const timeline = makeTimeline();
    const paintChrome = vi.fn();
    const runListScroll = vi.fn();

    const result = dispatchWaveformSelectionGestureDown(ctx, timeline, 0, {
      paintChrome,
      runListScroll,
      commitSelectedIdxRef: vi.fn(),
    });

    expect(result).toEqual({ applied: true, viewportSyncedOnDown: false });
  });

  it("pointerdown then pointerup with matching store bumps version once", () => {
    const ctx = makeCtx(0);
    const timeline = makeTimeline();
    const paintChrome = vi.fn(
      (
        ctx: TranscriptionLayerInput,
        idx: number,
        _opts: unknown,
        _source: unknown,
        publishOpts?: { skipBandPaint?: boolean },
      ) => {
        publishSelectionChromeForInput(
          ctx,
          { primaryIdx: idx, selectedSet: new Set([idx]) },
          { listRoot: null, overlayRoot: null },
          { skipImperative: true, skipBandPaint: publishOpts?.skipBandPaint },
        );
      },
    );
    const selectSegmentAt = vi.fn();

    dispatchWaveformSelectionGestureDown(
      ctx,
      timeline,
      1,
      { paintChrome, commitSelectedIdxRef: vi.fn(), runListScroll: vi.fn() },
      "s1",
    );
    expect(getSelectionChromeSnapshot().version).toBe(1);

    dispatchWaveformSelectionGestureUp(
      ctx,
      {
        idx: 1,
        pointerTimeSec: 2.5,
        selectedIdxAtPointerDown: 0,
        viewportSyncedOnDown: true,
        sessionId: "s1",
      },
      { selectSegmentAt, seekToTime: vi.fn() },
    );

    expect(selectSegmentAt).toHaveBeenCalledWith(1, "waveform", { previewSessionId: "s1" });
    expect(getSelectionChromeSnapshot().version).toBe(1);
  });
});

describe("dispatchWaveformSelectionGestureUp", () => {
  beforeEach(() => {
    resetSelectionChromeStoreForTests();
  });

  it("seeks within segment when already selected at pointerdown", () => {
    const ctx = makeCtx(1);
    const seekToTime = vi.fn();
    const selectSegmentAt = vi.fn();

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

    expect(seekToTime).toHaveBeenCalledWith(2.5);
    expect(selectSegmentAt).not.toHaveBeenCalled();
  });

  it("commits select via selectSegmentAt when down synced viewport", () => {
    const ctx = makeCtx(0);
    const selectSegmentAt = vi.fn();
    const seekToTime = vi.fn();
    const focusWaveformShell = vi.fn();

    dispatchWaveformSelectionGestureDown(ctx, makeTimeline(), 1, {
      paintChrome: vi.fn(),
      commitSelectedIdxRef: vi.fn(),
    });

    dispatchWaveformSelectionGestureUp(
      ctx,
      {
        idx: 1,
        pointerTimeSec: 2.5,
        selectedIdxAtPointerDown: 0,
        viewportSyncedOnDown: true,
        sessionId: "s1",
      },
      { selectSegmentAt, seekToTime, focusWaveformShell },
    );

    expect(selectSegmentAt).toHaveBeenCalledWith(1, "waveform", { previewSessionId: "s1" });
    expect(seekToTime).not.toHaveBeenCalled();
    expect(focusWaveformShell).not.toHaveBeenCalled();
  });

  it("focuses waveform shell on seek-within tap", () => {
    const ctx = makeCtx(1);
    const selectSegmentAt = vi.fn();
    const seekToTime = vi.fn();
    const focusWaveformShell = vi.fn();

    dispatchWaveformSelectionGestureUp(
      ctx,
      {
        idx: 1,
        pointerTimeSec: 2.5,
        selectedIdxAtPointerDown: 1,
        viewportSyncedOnDown: false,
      },
      { selectSegmentAt, seekToTime, focusWaveformShell },
    );

    expect(focusWaveformShell).toHaveBeenCalledOnce();
    expect(seekToTime).toHaveBeenCalledWith(2.5);
  });
});
