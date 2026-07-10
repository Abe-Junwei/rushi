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
import { effectiveTranscriptPrimaryIdx } from "../../components/editor/core/projectionWaveformBridge";
import { dispatchTranscriptEditorSelection } from "../../components/editor/core/transcriptEditorViewHandle";
import { revealSegmentInView } from "../../components/editor/core/revealSegment";
import { getTranscriptEditorView } from "../../components/editor/core/transcriptEditorViewHandle";
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
  /** Kept for call-site compat; P9b1 core-on path does not paint SC2. */
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
  /** When true, defer media seek to pointerup so playback playhead does not jump on down. */
  isMediaPlaying?: () => boolean;
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
 * pointerdown（Tier-0）：CM6 selection + seek + playhead + list reveal.
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

  const effectiveSelectedIdx = effectiveTranscriptPrimaryIdx(ctx.selectedIdx);
  const idxChanged = idx !== effectiveSelectedIdx;
  if (!idxChanged) return { applied: false, viewportSyncedOnDown: false };

  const planSeg = resolveSelectSegmentViewportPlan(segment).segment;
  const mediaPlaying = deps.isMediaPlaying?.() ?? false;
  dispatchTranscriptEditorSelection(idx);
  if (!mediaPlaying) {
    syncWaveformSegmentSelectPreviewViewport(timeline, planSeg, { segmentIdx: idx });
    markWaveformSegmentPreviewViewportSynced(idx, sessionId);
  }
  deps.commitSelectedIdxRef(idx);
  const view = getTranscriptEditorView();
  if (view) revealSegmentInView(view, idx);
  else deps.runListScroll?.(idx);
  return { applied: true, viewportSyncedOnDown: !mediaPlaying };
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
