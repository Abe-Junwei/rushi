import type { OverlayDragState, SegmentOverlayDraft } from "../../utils/waveformSegmentOverlayGeometry";
import type { OverlayDragMode } from "../../utils/waveformSegmentOverlayGestures";
import type { SegmentOverlayTapGesture } from "../../utils/waveformSegmentOverlayActions";

let nextWaveformSegmentInteractionSessionSeq = 1;

export type WaveformSegmentInteractionSessionId = string;

export type WaveformSegmentInteractionState =
  | { phase: "idle" }
  | {
      phase: "pendingTap" | "draggingEdit";
      sessionId: WaveformSegmentInteractionSessionId;
      drag: OverlayDragState;
      tapGesture: SegmentOverlayTapGesture & {
        segmentIdx: number;
        sessionId: WaveformSegmentInteractionSessionId;
      };
    }
  | {
      phase: "lasso";
      sessionId: WaveformSegmentInteractionSessionId;
      drag: OverlayDragState;
    }
  | { phase: "cancelled"; sessionId: WaveformSegmentInteractionSessionId }
  | { phase: "committed"; sessionId: WaveformSegmentInteractionSessionId };

export function createWaveformSegmentInteractionSessionId(): WaveformSegmentInteractionSessionId {
  const id = `wfseg-${nextWaveformSegmentInteractionSessionSeq}`;
  nextWaveformSegmentInteractionSessionSeq += 1;
  return id;
}

export function resetWaveformSegmentInteractionSessionIdsForTests(): void {
  nextWaveformSegmentInteractionSessionSeq = 1;
}

export function beginWaveformSegmentInteraction(input: {
  mode: OverlayDragMode;
  pointerId: number;
  segmentIdx: number;
  anchorTimeSec: number;
  anchorClientX: number;
  initialStartSec: number;
  initialEndSec: number;
  selectedIdxAtPointerDown: number;
  viewportSyncedOnDown?: boolean;
  sessionId?: WaveformSegmentInteractionSessionId;
}): {
  state: Extract<WaveformSegmentInteractionState, { phase: "pendingTap" | "draggingEdit" }>;
  draft: SegmentOverlayDraft;
} {
  const sessionId = input.sessionId ?? createWaveformSegmentInteractionSessionId();
  const drag: OverlayDragState = {
    mode: input.mode,
    pointerId: input.pointerId,
    segmentIdx: input.segmentIdx,
    anchorTimeSec: input.anchorTimeSec,
    anchorClientX: input.anchorClientX,
    initialStartSec: input.initialStartSec,
    initialEndSec: input.initialEndSec,
    moved: false,
    selectedIdxAtPointerDown: input.selectedIdxAtPointerDown,
    viewportSyncedOnDown: input.viewportSyncedOnDown,
    sessionId,
  };
  return {
    state: {
      phase: "pendingTap",
      sessionId,
      drag,
      tapGesture: {
        segmentIdx: input.segmentIdx,
        selectedIdxAtPointerDown: input.selectedIdxAtPointerDown,
        viewportSyncedOnDown: input.viewportSyncedOnDown,
        sessionId,
      },
    },
    draft: {
      idx: input.segmentIdx,
      startSec: input.initialStartSec,
      endSec: input.initialEndSec,
    },
  };
}

export function beginWaveformSegmentLassoInteraction(input: {
  pointerId: number;
  anchorTimeSec: number;
  anchorClientX: number;
  selectedIdxAtPointerDown: number;
  baseIndices?: Set<number>;
  sessionId?: WaveformSegmentInteractionSessionId;
}): Extract<WaveformSegmentInteractionState, { phase: "lasso" }> {
  const sessionId = input.sessionId ?? createWaveformSegmentInteractionSessionId();
  return {
    phase: "lasso",
    sessionId,
    drag: {
      mode: "lasso",
      pointerId: input.pointerId,
      segmentIdx: -1,
      anchorTimeSec: input.anchorTimeSec,
      anchorClientX: input.anchorClientX,
      initialStartSec: input.anchorTimeSec,
      initialEndSec: input.anchorTimeSec,
      moved: false,
      selectedIdxAtPointerDown: input.selectedIdxAtPointerDown,
      blankLasso: true,
      baseIndices: input.baseIndices,
      sessionId,
    },
  };
}

export function markWaveformSegmentInteractionMoved(
  state: WaveformSegmentInteractionState,
): WaveformSegmentInteractionState {
  if (state.phase !== "pendingTap") return state;
  return {
    ...state,
    phase: "draggingEdit",
  };
}

export function cancelWaveformSegmentInteraction(
  state: WaveformSegmentInteractionState,
): WaveformSegmentInteractionState {
  if (state.phase === "idle" || state.phase === "cancelled" || state.phase === "committed") {
    return state;
  }
  return { phase: "cancelled", sessionId: state.sessionId };
}

export function commitWaveformSegmentInteraction(
  state: WaveformSegmentInteractionState,
): WaveformSegmentInteractionState {
  if (state.phase === "idle" || state.phase === "cancelled" || state.phase === "committed") {
    return state;
  }
  return { phase: "committed", sessionId: state.sessionId };
}

export function consumeWaveformSegmentTapGesture(
  state: WaveformSegmentInteractionState,
  segmentIdx: number,
): SegmentOverlayTapGesture | undefined {
  if (state.phase !== "pendingTap" && state.phase !== "draggingEdit") return undefined;
  if (state.tapGesture.segmentIdx !== segmentIdx) return undefined;
  return {
    selectedIdxAtPointerDown: state.tapGesture.selectedIdxAtPointerDown,
    viewportSyncedOnDown: state.tapGesture.viewportSyncedOnDown,
    sessionId: state.tapGesture.sessionId,
  };
}
