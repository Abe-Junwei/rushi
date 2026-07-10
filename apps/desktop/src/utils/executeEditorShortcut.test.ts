import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetTranscriptProjectionForTests,
  seedTranscriptProjectionForTests,
} from "../components/editor/core/transcriptProjection";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import { executeEditorShortcut } from "./executeEditorShortcut";
import { createEmptySegmentListFilterNavState } from "./segmentListFilterNav";
import * as waveformPrefs from "./waveformPrefs";
import type { ConfirmAdvanceTabQueueRef } from "./confirmAdvanceTabQueue";

function makeCtx(overrides: Partial<TranscriptionLayerInput> = {}): TranscriptionLayerInput {
  return {
    projectId: "p1",
    fileId: "f1",
    mediaUrl: "media",
    segments: [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
      { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
    ],
    selectedIdx: 1,
    busy: false,
    selectionLo: 0,
    selectionHi: 0,
    selectionRangeAnchorIdx: 0,
    selectionCount: 1,
    isMultiSegmentSelection: false,
    isContiguousSelection: true,
    selectedIndicesArray: [1],
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

function makeConfirmAdvanceQueue(): ConfirmAdvanceTabQueueRef {
  return { inFlight: false, pendingSteps: 0 };
}

function makeDeps(overrides: Partial<Parameters<typeof executeEditorShortcut>[1]> = {}) {
  return {
    ctx: makeCtx(),
    confirmAdvanceQueueRef: makeConfirmAdvanceQueue(),
    wf: {
      getPlayheadTime: () => 1.5,
      togglePlay: vi.fn(),
      handleToggleSelectedWaveformPlay: vi.fn(),
      seekByDelta: vi.fn(),
      seek: vi.fn(),
      playSegmentAtIndex: vi.fn(),
      preserveLoopForNextSegmentSelect: vi.fn(),
    } as never,
    selectSegmentAt: vi.fn(),
    focusSegmentTextarea: vi.fn(),
    scheduleAdvanceToSegment: vi.fn(),
    segmentListFilterNavState: createEmptySegmentListFilterNavState(),
    showEditorHint: vi.fn(),
    stepWaveformZoom: vi.fn(),
    blurActiveElement: vi.fn(),
    ...overrides,
  };
}

describe("executeEditorShortcut", () => {
  afterEach(() => {
    resetTranscriptProjectionForTests();
    document.body.innerHTML = "";
  });

  it("playback.toggle uses selected-segment play, not global togglePlay", () => {
    const handleToggleSelectedWaveformPlay = vi.fn();
    const togglePlay = vi.fn();
    const deps = makeDeps({
      wf: {
        getPlayheadTime: () => 1.5,
        togglePlay,
        handleToggleSelectedWaveformPlay,
        seekByDelta: vi.fn(),
        seek: vi.fn(),
        playSegmentAtIndex: vi.fn(),
        preserveLoopForNextSegmentSelect: vi.fn(),
      } as never,
    });

    executeEditorShortcut("playback.toggle", deps);

    expect(handleToggleSelectedWaveformPlay).toHaveBeenCalledTimes(1);
    expect(togglePlay).not.toHaveBeenCalled();
  });

  it("playback.toggle is a no-op when no segment is selected", () => {
    const handleToggleSelectedWaveformPlay = vi.fn();
    const deps = makeDeps({
      ctx: makeCtx({ selectedIdx: -1 }),
      wf: {
        getPlayheadTime: () => 0,
        togglePlay: vi.fn(),
        handleToggleSelectedWaveformPlay,
        seekByDelta: vi.fn(),
        seek: vi.fn(),
        playSegmentAtIndex: vi.fn(),
        preserveLoopForNextSegmentSelect: vi.fn(),
      } as never,
    });

    expect(executeEditorShortcut("playback.toggle", deps)).toBe(true);
    expect(handleToggleSelectedWaveformPlay).not.toHaveBeenCalled();
  });

  it("playback.toggle uses CM6 projection when React SC1 still lags (H3)", async () => {
    const {
      resetTranscriptProjectionForTests,
      seedTranscriptProjectionForTests,
    } = await import("../components/editor/core/transcriptProjection");
    resetTranscriptProjectionForTests();
    seedTranscriptProjectionForTests({
      primaryIdx: 1,
      selectedSet: new Set([1]),
      rangeAnchor: 1,
      lineCount: 2,
    });
    const handleToggleSelectedWaveformPlay = vi.fn();
    const deps = makeDeps({
      ctx: makeCtx({ selectedIdx: 0 }),
      wf: {
        getPlayheadTime: () => 0.5,
        togglePlay: vi.fn(),
        handleToggleSelectedWaveformPlay,
        seekByDelta: vi.fn(),
        seek: vi.fn(),
        playSegmentAtIndex: vi.fn(),
        preserveLoopForNextSegmentSelect: vi.fn(),
      } as never,
    });

    expect(executeEditorShortcut("playback.toggle", deps)).toBe(true);
    expect(handleToggleSelectedWaveformPlay).toHaveBeenCalledTimes(1);
    resetTranscriptProjectionForTests();
  });

  it("splits at playhead for selectedIdx even when another textarea is focused", () => {
    const splitAtPlayhead = vi.fn();
    const mergeWithNextAt = vi.fn();
    const ctx = makeCtx({ selectedIdx: 0, splitAtPlayhead, mergeWithNextAt });
    document.body.innerHTML = `
      <div data-seg-row="1">
        <textarea aria-label="语段正文"></textarea>
      </div>
    `;
    document.querySelector("textarea")!.focus();

    executeEditorShortcut("segment.splitPlayhead", makeDeps({ ctx }));
    expect(splitAtPlayhead).toHaveBeenCalledWith(1.5);

    executeEditorShortcut("segment.mergeNext", makeDeps({ ctx }));
    expect(mergeWithNextAt).toHaveBeenCalledWith(0);

    document.body.innerHTML = "";
  });

  it("calls saveSegments for workflow.save", () => {
    const saveSegments = vi.fn(() => Promise.resolve(true));
    const ctx = makeCtx({ saveSegments });

    executeEditorShortcut("workflow.save", makeDeps({ ctx }));

    expect(saveSegments).toHaveBeenCalledTimes(1);
  });

  it("calls triggerFindReplaceShortcut for workflow.find", () => {
    const triggerFindReplaceShortcut = vi.fn();
    const ctx = makeCtx({ triggerFindReplaceShortcut });

    executeEditorShortcut("workflow.find", makeDeps({ ctx }));

    expect(triggerFindReplaceShortcut).toHaveBeenCalledTimes(1);
  });

  it("calls closeFile for workflow.closeFile", () => {
    const closeFile = vi.fn();
    const ctx = makeCtx({ closeFile });

    executeEditorShortcut("workflow.closeFile", makeDeps({ ctx }));

    expect(closeFile).toHaveBeenCalledTimes(1);
  });

  it("calls openEnvironment for workflow.openSettings", () => {
    const openEnvironment = vi.fn();
    const ctx = makeCtx({ openEnvironment, fileId: null });

    executeEditorShortcut("workflow.openSettings", makeDeps({ ctx }));

    expect(openEnvironment).toHaveBeenCalledTimes(1);
  });

  it("dispatches activity inbox toggle for workflow.openActivityInbox", () => {
    const onToggle = vi.fn();
    window.addEventListener("rushi:activity-inbox-toggle", onToggle);
    const ctx = makeCtx({ fileId: null });

    executeEditorShortcut("workflow.openActivityInbox", makeDeps({ ctx }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    window.removeEventListener("rushi:activity-inbox-toggle", onToggle);
  });

  it("opens annotation dialog for selectedIdx, not focused textarea row", () => {
    const openSegmentAnnotationDialog = vi.fn();
    const ctx = makeCtx({ openSegmentAnnotationDialog, selectedIdx: 0 });
    document.body.innerHTML = `
      <div data-seg-row="1">
        <textarea aria-label="语段正文"></textarea>
      </div>
    `;
    document.querySelector("textarea")!.focus();

    executeEditorShortcut("workflow.segmentAnnotation", makeDeps({ ctx }));

    expect(openSegmentAnnotationDialog).toHaveBeenCalledWith(0);
    document.body.innerHTML = "";
  });

  it("confirmAdvance uses listKeyboard after save", async () => {
    vi.spyOn(waveformPrefs, "readStoredTabAdvanceLoopsSegment").mockReturnValue(false);
    const confirmSegmentEditAndAdvance = vi.fn(() => Promise.resolve(true));
    const ctx = makeCtx({ selectedIdx: 0, confirmSegmentEditAndAdvance });
    const wf = {
      togglePlay: vi.fn(),
      handleToggleSelectedWaveformPlay: vi.fn(),
      getPlayheadTime: () => 0,
      seekByDelta: vi.fn(),
      seek: vi.fn(),
      playSegmentAtIndex: vi.fn(),
      preserveLoopForNextSegmentSelect: vi.fn(),
    };
    const selectSegmentAt = vi.fn();
    const focusSegmentTextarea = vi.fn();
    document.body.innerHTML = `
      <div data-seg-row="0">
        <textarea aria-label="语段正文"></textarea>
      </div>
    `;
    document.querySelector("textarea")!.focus();

    executeEditorShortcut(
      "workflow.confirmAdvance",
      makeDeps({ ctx, selectSegmentAt, focusSegmentTextarea, wf: wf as never }),
    );

    await vi.waitFor(() => {
      expect(confirmSegmentEditAndAdvance).toHaveBeenCalledWith(0);
      expect(selectSegmentAt).toHaveBeenCalledWith(1, "listKeyboard");
      expect(focusSegmentTextarea).toHaveBeenCalledWith(1);
      expect(wf.seek).not.toHaveBeenCalled();
      expect(wf.playSegmentAtIndex).not.toHaveBeenCalled();
    }, { timeout: 3000 });
    document.body.innerHTML = "";
  });

  it("advances to next segment from selectedIdx when blurred", () => {
    const scheduleAdvanceToSegment = vi.fn();
    const ctx = makeCtx({ selectedIdx: 0 });
    executeEditorShortcut("segment.advanceNext", makeDeps({ ctx, scheduleAdvanceToSegment }));
    expect(scheduleAdvanceToSegment).toHaveBeenCalledWith(1);
  });

  it("uses lightweight waveform keyboard selection when advancing in waveform context", () => {
    const scheduleAdvanceToSegment = vi.fn();
    const selectSegmentAt = vi.fn();
    const ctx = makeCtx({ selectedIdx: 0 });
    executeEditorShortcut(
      "segment.advanceNext",
      makeDeps({ ctx, scheduleAdvanceToSegment, selectSegmentAt }),
      { inWaveform: true },
    );
    expect(selectSegmentAt).toHaveBeenCalledWith(1, "waveformKeyboard", { shiftKey: undefined });
    expect(scheduleAdvanceToSegment).not.toHaveBeenCalled();
  });

  it("advances to previous segment from selectedIdx when blurred", () => {
    const scheduleAdvanceToSegment = vi.fn();
    const ctx = makeCtx({ selectedIdx: 1 });
    executeEditorShortcut("segment.advancePrev", makeDeps({ ctx, scheduleAdvanceToSegment }));
    expect(scheduleAdvanceToSegment).toHaveBeenCalledWith(0);
  });

  it("respects active list filter for blurred arrow advance", () => {
    const scheduleAdvanceToSegment = vi.fn();
    const ctx = makeCtx({
      selectedIdx: 0,
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
        { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "c" },
      ],
    });
    executeEditorShortcut(
      "segment.advanceNext",
      makeDeps({
        ctx,
        scheduleAdvanceToSegment,
        segmentListFilterNavState: { active: true, indices: [0, 2] },
      }),
    );
    expect(scheduleAdvanceToSegment).toHaveBeenCalledWith(2);
  });

  it("stops at last filtered segment for blurred arrow advance", () => {
    const scheduleAdvanceToSegment = vi.fn();
    const ctx = makeCtx({
      selectedIdx: 2,
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
        { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "c" },
      ],
    });
    executeEditorShortcut(
      "segment.advanceNext",
      makeDeps({
        ctx,
        scheduleAdvanceToSegment,
        segmentListFilterNavState: { active: true, indices: [0, 2] },
      }),
    );
    expect(scheduleAdvanceToSegment).not.toHaveBeenCalled();
  });

  it("confirmAdvance finalizes CM6 projection primary, not stale selectedIdx", async () => {
    const confirmSegmentEditAndAdvance = vi.fn(() => Promise.resolve(true));
    const ctx = makeCtx({
      selectedIdx: 0,
      confirmSegmentEditAndAdvance,
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
        { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "c" },
      ],
    });
    const selectSegmentAt = vi.fn();
    seedTranscriptProjectionForTests({
      primaryIdx: 1,
      selectedSet: new Set([1]),
      rangeAnchor: 1,
      lineCount: 3,
    });

    executeEditorShortcut(
      "workflow.confirmAdvance",
      makeDeps({ ctx, selectSegmentAt }),
    );

    await vi.waitFor(() => {
      expect(confirmSegmentEditAndAdvance).toHaveBeenCalledWith(1);
      expect(selectSegmentAt).toHaveBeenCalledWith(2, "listKeyboard");
    });
  });

  it("confirmAdvance respects active list filter", async () => {
    const confirmSegmentEditAndAdvance = vi.fn(() => Promise.resolve(true));
    const ctx = makeCtx({
      selectedIdx: 0,
      confirmSegmentEditAndAdvance,
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
        { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "c" },
      ],
    });
    const selectSegmentAt = vi.fn();
    document.body.innerHTML = `
      <div data-seg-row="0">
        <textarea aria-label="语段正文"></textarea>
      </div>
    `;
    document.querySelector("textarea")!.focus();

    executeEditorShortcut(
      "workflow.confirmAdvance",
      makeDeps({
        ctx,
        selectSegmentAt,
        segmentListFilterNavState: { active: true, indices: [0, 2] },
      }),
    );

    await vi.waitFor(() => {
      expect(selectSegmentAt).toHaveBeenCalledWith(2, "listKeyboard");
    });
    document.body.innerHTML = "";
  });

  it("confirmAdvance still advances when finalize is no-op on finalized segment", async () => {
    const confirmSegmentEditAndAdvance = vi.fn(() => Promise.resolve(true));
    const ctx = makeCtx({ selectedIdx: 0, confirmSegmentEditAndAdvance });
    const selectSegmentAt = vi.fn();
    document.body.innerHTML = `
      <div data-seg-row="0">
        <textarea aria-label="语段正文"></textarea>
      </div>
    `;
    document.querySelector("textarea")!.focus();

    executeEditorShortcut(
      "workflow.confirmAdvance",
      makeDeps({ ctx, selectSegmentAt }),
    );

    await vi.waitFor(() => {
      expect(selectSegmentAt).toHaveBeenCalledWith(1, "listKeyboard");
    });
    document.body.innerHTML = "";
  });

  it("confirmAdvance loops next segment when tab advance preference is on", async () => {
    vi.spyOn(waveformPrefs, "readStoredTabAdvanceLoopsSegment").mockReturnValue(true);
    const confirmSegmentEditAndAdvance = vi.fn(() => Promise.resolve(true));
    const ctx = makeCtx({ selectedIdx: 0, confirmSegmentEditAndAdvance });
    const selectSegmentAt = vi.fn();
    const focusSegmentTextarea = vi.fn();
    const wf = {
      getPlayheadTime: () => 0,
      togglePlay: vi.fn(),
      handleToggleSelectedWaveformPlay: vi.fn(),
      seekByDelta: vi.fn(),
      seek: vi.fn(),
      playSegmentAtIndex: vi.fn(),
      preserveLoopForNextSegmentSelect: vi.fn(),
    };
    document.body.innerHTML = `
      <div data-seg-row="0">
        <textarea aria-label="语段正文"></textarea>
      </div>
    `;
    document.querySelector("textarea")!.focus();

    executeEditorShortcut(
      "workflow.confirmAdvance",
      makeDeps({ ctx, selectSegmentAt, focusSegmentTextarea, wf: wf as never }),
    );

    await vi.waitFor(() => {
      expect(wf.preserveLoopForNextSegmentSelect).toHaveBeenCalled();
      expect(wf.playSegmentAtIndex).toHaveBeenCalledWith(1, { loop: true });
      expect(wf.seek).not.toHaveBeenCalled();
    });
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });
});
