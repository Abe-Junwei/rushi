import { resolveSelectSegmentViewportPlan } from "./selectSegmentViewportPlan";
import {
  syncWaveformSegmentSelectPreviewViewport,
  type WaveformSegmentSelectViewportTimeline,
} from "./syncWaveformSegmentSelectViewport";
import { markWaveformSegmentPreviewViewportSynced } from "./waveformSegmentSelectPreviewSync";
import {
  applyWaveformSelectionCommand,
  resolveWaveformSelectionTapCommand,
} from "../selection/waveformSelectionCommand";
import {
  selectionChromeEffectivePrimaryIdx,
  selectionChromePrimaryOutOfSync,
} from "../selection/selectionChromeStore";
import type { TranscriptionLayerInput } from "../../pages/transcriptionLayerTypes";
import type { SegmentSelectAtOptions, SegmentSelectSource } from "../../utils/waveformViewMode";

export type WaveformSelectionGestureDown = {
  phase: "down";
  idx: number;
  sessionId?: string;
};

export type WaveformSelectionGestureUp = {
  phase: "up";
  idx: number;
  pointerTimeSec: number;
  selectedIdxAtPointerDown: number;
  viewportSyncedOnDown?: boolean;
  sessionId?: string;
};

export type WaveformSelectionGesture =
  | WaveformSelectionGestureDown
  | WaveformSelectionGestureUp;

export type WaveformSelectionGestureDownDeps = {
  paintChrome: (
    ctx: TranscriptionLayerInput,
    idx: number,
    opts: { shiftKey?: boolean; toggle?: boolean } | undefined,
    source: SegmentSelectSource,
    publishOpts?: { skipBandPaint?: boolean },
  ) => void;
  /** SC1 ref + microtask commit — pointerup 不等待 React 即可读逻辑 idx。 */
  commitSelectedIdxRef: (idx: number) => void;
  runListScroll?: (idx: number) => void;
};

export type WaveformSelectionGestureDownResult = {
  applied: boolean;
  viewportSyncedOnDown: boolean;
};

export type WaveformSelectionGestureUpDeps = {
  selectSegmentAt: (
    idx: number,
    source?: SegmentSelectSource,
    opts?: SegmentSelectAtOptions,
  ) => void;
  seekToTime: (timeSec: number) => void;
  focusWaveformShell?: () => void;
};

/**
 * pointerdown（Tier-0）：SC2 imperative + seek + playhead + list scroll。
 */
export function dispatchWaveformSelectionGestureDown(
  ctx: TranscriptionLayerInput,
  timeline: WaveformSegmentSelectViewportTimeline,
  idx: number,
  deps: WaveformSelectionGestureDownDeps,
  sessionId?: string,
): WaveformSelectionGestureDownResult {
  const segment = ctx.segments[idx];
  if (ctx.busy || !segment) return { applied: false, viewportSyncedOnDown: false };

  const effectiveSelectedIdx = selectionChromeEffectivePrimaryIdx(ctx.selectedIdx);
  const idxChanged = idx !== effectiveSelectedIdx;
  const needsPaint = idxChanged || selectionChromePrimaryOutOfSync(idx);
  if (!needsPaint) return { applied: false, viewportSyncedOnDown: false };

  const publishOpts = { skipBandPaint: true as const };

  if (idxChanged) {
    const planSeg = resolveSelectSegmentViewportPlan(segment).segment;
    deps.paintChrome(ctx, idx, undefined, "waveform", publishOpts);
    syncWaveformSegmentSelectPreviewViewport(timeline, planSeg);
    markWaveformSegmentPreviewViewportSynced(idx, sessionId);
    deps.commitSelectedIdxRef(idx);
    deps.runListScroll?.(idx);
    return { applied: true, viewportSyncedOnDown: true };
  }

  deps.paintChrome(ctx, idx, undefined, "waveform", publishOpts);
  return { applied: true, viewportSyncedOnDown: false };
}

/** pointerup tap：select 提交 SC1 或 seek-within；preview consume 仅在 selectSegmentAt fast path 发生一次。 */
export function dispatchWaveformSelectionGestureUp(
  ctx: TranscriptionLayerInput,
  gesture: Omit<WaveformSelectionGestureUp, "phase">,
  deps: WaveformSelectionGestureUpDeps,
): void {
  const segment = ctx.segments[gesture.idx];
  if (ctx.busy || !segment) return;

  applyWaveformSelectionCommand(
    resolveWaveformSelectionTapCommand({
      ctx,
      segmentIdx: gesture.idx,
      pointerTimeSec: gesture.pointerTimeSec,
      tapGesture: {
        selectedIdxAtPointerDown: gesture.selectedIdxAtPointerDown,
        viewportSyncedOnDown: gesture.viewportSyncedOnDown,
        sessionId: gesture.sessionId,
      },
    }),
    deps,
  );
}
