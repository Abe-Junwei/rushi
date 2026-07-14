import { describe, expect, it, vi } from "vitest";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import {
  CONFIRM_ADVANCE_TAB_QUEUE_MAX,
  enqueueConfirmAdvanceTab,
  type ConfirmAdvanceTabQueueRef,
} from "./confirmAdvanceTabQueue";

function makeCtx(overrides: Partial<TranscriptionLayerInput> = {}): TranscriptionLayerInput {
  return {
    projectId: "p1",
    fileId: "f1",
    mediaUrl: "media",
    segments: [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
      { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "b" },
      { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "c" },
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
    isIndexInSelection: () => true,
    selectSegmentAt: vi.fn(),
    selectSegmentRange: vi.fn(),
    selectSegmentIndices: vi.fn(),
    clearMultiSelection: vi.fn(),
    requestDeleteSelectedIndices: vi.fn(),
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
    toggleSegmentFrozen: vi.fn(),
    openManualCorrectionMemoryDialog: vi.fn(),
    ...overrides,
  };
}

describe("confirmAdvanceTabQueue", () => {
  it("Tab advance queues steps without finalizing", async () => {
    let selectedIdx = 0;
    const ctx = makeCtx();
    const getCtx = vi.fn(() => ({ ...ctx, selectedIdx }));
    const selectSegmentAt = vi.fn((idx: number) => {
      selectedIdx = idx;
    });
    const focusSegmentTextarea = vi.fn();
    const confirmSegmentEditAndAdvance = vi.fn(() => Promise.resolve(true));
    ctx.confirmSegmentEditAndAdvance = confirmSegmentEditAndAdvance;

    const queue: ConfirmAdvanceTabQueueRef = { inFlight: false, pending: [] };
    const deps = {
      getCtx,
      segmentListFilterNavState: { active: false, indices: [] },
      selectSegmentAt,
      focusSegmentTextarea,
      wf: {
        preserveLoopForNextSegmentSelect: vi.fn(),
        playSegmentAtIndex: vi.fn(),
      },
    };

    enqueueConfirmAdvanceTab(queue, deps);
    enqueueConfirmAdvanceTab(queue, deps);
    enqueueConfirmAdvanceTab(queue, deps);

    await vi.waitFor(() => {
      expect(queue.inFlight).toBe(false);
      expect(queue.pending).toHaveLength(0);
    });

    expect(confirmSegmentEditAndAdvance).not.toHaveBeenCalled();
    expect(selectSegmentAt).toHaveBeenCalledWith(1, "listKeyboard");
    expect(selectSegmentAt).toHaveBeenCalledWith(2, "listKeyboard");
    expect(deps.wf.playSegmentAtIndex).toHaveBeenCalledTimes(1);
    expect(deps.wf.playSegmentAtIndex).toHaveBeenCalledWith(2, { loop: true });
  });

  it("Enter finalize path still confirms then advances", async () => {
    let selectedIdx = 0;
    const ctx = makeCtx();
    const getCtx = vi.fn(() => ({ ...ctx, selectedIdx }));
    const selectSegmentAt = vi.fn((idx: number) => {
      selectedIdx = idx;
    });
    const focusSegmentTextarea = vi.fn();
    const confirmSegmentEditAndAdvance = vi.fn(() => Promise.resolve(true));
    ctx.confirmSegmentEditAndAdvance = confirmSegmentEditAndAdvance;

    const queue: ConfirmAdvanceTabQueueRef = { inFlight: false, pending: [] };
    const deps = {
      getCtx,
      segmentListFilterNavState: { active: false, indices: [] },
      selectSegmentAt,
      focusSegmentTextarea,
      wf: {
        preserveLoopForNextSegmentSelect: vi.fn(),
        playSegmentAtIndex: vi.fn(),
      },
    };

    enqueueConfirmAdvanceTab(queue, deps, { finalize: true });
    enqueueConfirmAdvanceTab(queue, deps, { finalize: true });

    await vi.waitFor(() => {
      expect(queue.inFlight).toBe(false);
      expect(queue.pending).toHaveLength(0);
    });

    expect(confirmSegmentEditAndAdvance).toHaveBeenCalledTimes(2);
    expect(confirmSegmentEditAndAdvance).toHaveBeenNthCalledWith(1, 0);
    expect(confirmSegmentEditAndAdvance).toHaveBeenNthCalledWith(2, 1);
    expect(selectSegmentAt).toHaveBeenCalledWith(1, "listKeyboard");
    expect(selectSegmentAt).toHaveBeenCalledWith(2, "listKeyboard");
  });

  it("caps queued Tab steps", () => {
    const queue: ConfirmAdvanceTabQueueRef = { inFlight: false, pending: [] };
    const deps = {
      getCtx: () => makeCtx(),
      segmentListFilterNavState: { active: false, indices: [] },
      selectSegmentAt: vi.fn(),
      focusSegmentTextarea: vi.fn(),
      wf: { preserveLoopForNextSegmentSelect: vi.fn(), playSegmentAtIndex: vi.fn() },
    };
    for (let i = 0; i < CONFIRM_ADVANCE_TAB_QUEUE_MAX + 3; i += 1) {
      enqueueConfirmAdvanceTab(queue, deps);
    }
    expect(queue.pending).toHaveLength(CONFIRM_ADVANCE_TAB_QUEUE_MAX);
  });
});
