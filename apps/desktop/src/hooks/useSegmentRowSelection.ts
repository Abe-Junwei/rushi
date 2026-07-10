import { useSyncExternalStore } from "react";
import {
  SELECTION_ROW_STATE,
  type SelectionRowState,
} from "../services/selection/selectionRowState";
import {
  getTranscriptProjectionSnapshot,
  subscribeTranscriptProjection,
} from "../components/editor/core/transcriptProjection";

function projectionRowState(segmentIdx: number): SelectionRowState {
  const snap = getTranscriptProjectionSnapshot();
  if (segmentIdx === snap.primaryIdx) return SELECTION_ROW_STATE.primary;
  if (snap.selectedSet.has(segmentIdx) && segmentIdx !== snap.primaryIdx) {
    return SELECTION_ROW_STATE.inSelection;
  }
  return SELECTION_ROW_STATE.none;
}

/** Primary segment idx from CM6 transcriptProjection (P9b1). */
export function useSelectionChromePrimaryIdx(): number {
  return useSyncExternalStore(
    subscribeTranscriptProjection,
    () => getTranscriptProjectionSnapshot().primaryIdx,
    () => -1,
  );
}

/** Overlay/list row selection chrome from CM6 projection (not SC2 store). */
export function useSegmentRowSelection(segmentIdx: number): SelectionRowState {
  return useSyncExternalStore(
    subscribeTranscriptProjection,
    () => projectionRowState(segmentIdx),
    () => SELECTION_ROW_STATE.none,
  );
}
