import { useCallback, useSyncExternalStore } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentLearnButtonVisible } from "../services/segmentLearnVisibility";
import {
  normalizeSegmentDraftText,
  segmentDraftKey,
  subscribeSegmentDraftStore,
} from "./useSegmentDraftStore";

/** 订阅草稿/追踪，驱动「纳入记忆」按钮（仅当有可学习 removed→inserted 对）。 */
export function useSegmentPendingLearnConfirm(
  segment: SegmentDto,
  segmentIdx: number,
  selected: boolean,
): boolean {
  const draftKey = segmentDraftKey(segment, segmentIdx);
  const committedText = normalizeSegmentDraftText(segment.text ?? "");

  const readVisible = useCallback(
    () => segmentLearnButtonVisible(draftKey, committedText, selected),
    [committedText, draftKey, selected],
  );

  return useSyncExternalStore(subscribeSegmentDraftStore, readVisible, readVisible);
}
