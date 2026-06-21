import { useSyncExternalStore } from "react";
import {
  getSelectionChromeSnapshot,
  SELECTION_ROW_STATE,
  selectionRowState,
  subscribeSelectionChrome,
} from "../services/selection/selectionChromeStore";

export function useSelectionChromePrimaryIdx(): number {
  return useSyncExternalStore(
    subscribeSelectionChrome,
    () => getSelectionChromeSnapshot().primaryIdx,
    () => -1,
  );
}

export function useSegmentRowSelection(
  segmentIdx: number,
): (typeof SELECTION_ROW_STATE)[keyof typeof SELECTION_ROW_STATE] {
  return useSyncExternalStore(
    subscribeSelectionChrome,
    () => selectionRowState(segmentIdx),
    () => SELECTION_ROW_STATE.none,
  );
}
