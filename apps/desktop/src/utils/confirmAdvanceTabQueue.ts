import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import type { useProjectWaveform } from "../hooks/useProjectWaveform";
import { readFocusedSegmentTextareaIdx } from "../pages/flushSegmentTextDrafts";
import type { SegmentListFilterNavState } from "./segmentListFilterNav";
import { resolveKeyboardAdvanceTarget } from "./segmentListKeyboardNav";
import { readStoredTabAdvanceLoopsSegment } from "./waveformPrefs";
import type { SegmentSelectSource } from "./waveformViewMode";

type WfApi = ReturnType<typeof useProjectWaveform>;

export type ConfirmAdvanceTabQueueRef = {
  inFlight: boolean;
  pendingSteps: number;
};

export const CONFIRM_ADVANCE_TAB_QUEUE_MAX = 8;

export type ConfirmAdvanceTabQueueDeps = {
  getCtx: () => TranscriptionLayerInput;
  segmentListFilterNavState: SegmentListFilterNavState;
  selectSegmentAt: (idx: number, source?: SegmentSelectSource) => void;
  focusSegmentTextarea: (segmentIdx: number) => void;
  wf: Pick<WfApi, "preserveLoopForNextSegmentSelect" | "playSegmentAtIndex">;
};

export function resolveConfirmAdvanceStartingIdx(ctx: TranscriptionLayerInput): number {
  const focusedIdx = readFocusedSegmentTextareaIdx(ctx.segments.length);
  if (focusedIdx != null) return focusedIdx;
  return ctx.selectedIdx;
}

function resolveConfirmAdvanceSegmentIdx(ctx: TranscriptionLayerInput): number {
  return resolveConfirmAdvanceStartingIdx(ctx);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function enqueueConfirmAdvanceTab(
  queue: ConfirmAdvanceTabQueueRef,
  deps: ConfirmAdvanceTabQueueDeps,
): void {
  queue.pendingSteps = Math.min(queue.pendingSteps + 1, CONFIRM_ADVANCE_TAB_QUEUE_MAX);
  if (!queue.inFlight) {
    void drainConfirmAdvanceTabQueue(queue, deps);
  }
}

export async function drainConfirmAdvanceTabQueue(
  queue: ConfirmAdvanceTabQueueRef,
  deps: ConfirmAdvanceTabQueueDeps,
): Promise<void> {
  if (queue.inFlight) return;
  queue.inFlight = true;
  let lastAdvancedIdx: number | null = null;
  let cursorIdx = resolveConfirmAdvanceSegmentIdx(deps.getCtx());
  try {
    while (queue.pendingSteps > 0) {
      queue.pendingSteps -= 1;
      const ctx = deps.getCtx();
      if (cursorIdx < 0 || cursorIdx >= ctx.segments.length) continue;

      const fromIdx = cursorIdx;
      const nextIdx = resolveKeyboardAdvanceTarget(
        fromIdx,
        1,
        ctx.segments.length,
        deps.segmentListFilterNavState,
      );

      if (nextIdx == null || nextIdx === fromIdx) {
        await deps.getCtx().confirmSegmentEditAndAdvance(fromIdx);
        continue;
      }

      deps.selectSegmentAt(nextIdx, "listKeyboard");
      deps.focusSegmentTextarea(nextIdx);
      lastAdvancedIdx = nextIdx;
      cursorIdx = nextIdx;
      await nextFrame();
      await deps.getCtx().confirmSegmentEditAndAdvance(fromIdx);
    }
  } finally {
    queue.inFlight = false;
    if (queue.pendingSteps > 0) {
      void drainConfirmAdvanceTabQueue(queue, deps);
      return;
    }
    if (lastAdvancedIdx != null && readStoredTabAdvanceLoopsSegment()) {
      deps.wf.preserveLoopForNextSegmentSelect();
      void deps.wf.playSegmentAtIndex(lastAdvancedIdx, { loop: true });
    }
  }
}
