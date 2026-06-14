import { describe, expect, it, vi } from "vitest";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import { executeEditorShortcut } from "./executeEditorShortcut";
import { createEmptySegmentListFilterNavState } from "./segmentListFilterNav";
import * as waveformPrefs from "./waveformPrefs";

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

function makeDeps(overrides: Partial<Parameters<typeof executeEditorShortcut>[1]> = {}) {
  return {
    ctx: makeCtx(),
    wf: {
      getPlayheadTime: () => 1.5,
      togglePlay: vi.fn(),
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
  it("splits at playhead for focused segment index, not only selectedIdx", () => {
    const splitAtPlayhead = vi.fn();
    const ctx = makeCtx({ selectedIdx: 0, splitAtPlayhead });
    document.body.innerHTML = `
      <div data-seg-row="1">
        <textarea aria-label="语段正文"></textarea>
      </div>
    `;
    const textarea = document.querySelector("textarea")!;
    textarea.focus();

    executeEditorShortcut("segment.splitPlayhead", makeDeps({ ctx }));

    expect(splitAtPlayhead).toHaveBeenCalledWith(1.5);
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

  it("opens annotation dialog for focused segment", () => {
    const openSegmentAnnotationDialog = vi.fn();
    const ctx = makeCtx({ openSegmentAnnotationDialog, selectedIdx: 0 });
    document.body.innerHTML = `
      <div data-seg-row="1">
        <textarea aria-label="语段正文"></textarea>
      </div>
    `;
    document.querySelector("textarea")!.focus();

    executeEditorShortcut("workflow.segmentAnnotation", makeDeps({ ctx }));

    expect(openSegmentAnnotationDialog).toHaveBeenCalledWith(1);
    document.body.innerHTML = "";
  });

  it("confirmAdvance uses listAdvance after save", async () => {
    const confirmSegmentEditAndAdvance = vi.fn(() => Promise.resolve(true));
    const ctx = makeCtx({ selectedIdx: 0, confirmSegmentEditAndAdvance });
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
      makeDeps({ ctx, selectSegmentAt, focusSegmentTextarea }),
    );

    await vi.waitFor(() => {
      expect(confirmSegmentEditAndAdvance).toHaveBeenCalledWith(0);
      expect(selectSegmentAt).toHaveBeenCalledWith(1, "listAdvance");
      expect(focusSegmentTextarea).toHaveBeenCalledWith(1);
    });
    document.body.innerHTML = "";
  });

  it("advances to next segment from selectedIdx when blurred", () => {
    const scheduleAdvanceToSegment = vi.fn();
    const ctx = makeCtx({ selectedIdx: 0 });
    executeEditorShortcut("segment.advanceNext", makeDeps({ ctx, scheduleAdvanceToSegment }));
    expect(scheduleAdvanceToSegment).toHaveBeenCalledWith(1);
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

  it("confirmAdvance loops next segment when tab advance preference is on", async () => {
    vi.spyOn(waveformPrefs, "readStoredTabAdvanceLoopsSegment").mockReturnValue(true);
    const confirmSegmentEditAndAdvance = vi.fn(() => Promise.resolve(true));
    const ctx = makeCtx({ selectedIdx: 0, confirmSegmentEditAndAdvance });
    const selectSegmentAt = vi.fn();
    const focusSegmentTextarea = vi.fn();
    const wf = {
      getPlayheadTime: () => 0,
      togglePlay: vi.fn(),
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
