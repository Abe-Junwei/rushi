import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import type { useProjectWaveform } from "../hooks/useProjectWaveform";
import type { SegmentListFilterNavState } from "./segmentListFilterNav";
import { resolveKeyboardAdvanceTarget } from "./segmentListKeyboardNav";
import { readStoredTabAdvanceLoopsSegment } from "./waveformPrefs";
import type { SegmentSelectSource } from "./waveformViewMode";
import { effectiveTranscriptPrimaryIdx } from "../components/editor/core/projectionWaveformBridge";

type WfApi = ReturnType<typeof useProjectWaveform>;

export type ConfirmAdvanceStep = {
  /** Cmd+Enter / 右键定稿路径为 true；Tab 跳段为 false。 */
  finalize: boolean;
};

export type ConfirmAdvanceTabQueueRef = {
  inFlight: boolean;
  pending: ConfirmAdvanceStep[];
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
  return effectiveTranscriptPrimaryIdx(ctx.selectedIdx);
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
  opts?: { finalize?: boolean },
): void {
  if (queue.pending.length >= CONFIRM_ADVANCE_TAB_QUEUE_MAX) return;
  queue.pending.push({ finalize: opts?.finalize === true });
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
    while (queue.pending.length > 0) {
      const step = queue.pending.shift();
      if (!step) continue;
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
        if (step.finalize) {
          await deps.getCtx().confirmSegmentEditAndAdvance(fromIdx);
        }
        continue;
      }

      deps.selectSegmentAt(nextIdx, "listKeyboard");
      deps.focusSegmentTextarea(nextIdx);
      lastAdvancedIdx = nextIdx;
      cursorIdx = nextIdx;
      await nextFrame();
      if (step.finalize) {
        await deps.getCtx().confirmSegmentEditAndAdvance(fromIdx);
      }
    }
  } finally {
    queue.inFlight = false;
    if (queue.pending.length > 0) {
      void drainConfirmAdvanceTabQueue(queue, deps);
    } else if (lastAdvancedIdx != null && readStoredTabAdvanceLoopsSegment()) {
      deps.wf.preserveLoopForNextSegmentSelect();
      void deps.wf.playSegmentAtIndex(lastAdvancedIdx, { loop: true });
    }
  }
}
