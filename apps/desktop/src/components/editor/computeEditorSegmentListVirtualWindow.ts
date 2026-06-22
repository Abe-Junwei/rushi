import {
  computeSegmentListVirtualWindow,
  maybePinSegmentListVirtualWindow,
  SEGMENT_LIST_VIRTUAL_OVERSCAN,
} from "../../utils/segmentListVirtualWindow";
import { readListKeyboardVirtualDisplayPin } from "../../services/selection/listKeyboardBurstCoordinator";
import type { SegmentSelectSource } from "../../utils/waveformViewMode";
import type { MutableRefObject } from "react";

export type ComputeEditorSegmentListVirtualWindowArgs = {
  segmentListRoot: HTMLElement | null;
  scrollMetricsRef: MutableRefObject<{ scrollTop: number; viewportHeight: number }>;
  selectedDisplayIndex: number;
  displayCount: number;
  itemStridePx: number;
  useVirtualList: boolean;
  source: SegmentSelectSource | undefined;
};

export function computeEditorSegmentListVirtualWindow({
  segmentListRoot,
  scrollMetricsRef,
  selectedDisplayIndex,
  displayCount,
  itemStridePx,
  useVirtualList,
  source,
}: ComputeEditorSegmentListVirtualWindowArgs) {
  if (!useVirtualList) {
    return {
      startIndex: 0,
      endIndex: displayCount,
      paddingTopPx: 0,
      paddingBottomPx: 0,
      totalHeightPx: 0,
    };
  }

  const scrollMetrics = scrollMetricsRef.current;
  const scrollTop = segmentListRoot?.scrollTop ?? scrollMetrics.scrollTop;
  const viewportHeight =
    segmentListRoot != null && segmentListRoot.clientHeight > 0
      ? segmentListRoot.clientHeight
      : scrollMetrics.viewportHeight;

  const base = computeSegmentListVirtualWindow({
    scrollTop,
    viewportHeight,
    itemStridePx,
    totalCount: displayCount,
    overscan: SEGMENT_LIST_VIRTUAL_OVERSCAN,
  });

  if (selectedDisplayIndex < 0) return base;

  const pinDisplayIndex =
    source === "listKeyboard"
      ? (readListKeyboardVirtualDisplayPin() ?? selectedDisplayIndex)
      : selectedDisplayIndex;

  if (pinDisplayIndex >= base.startIndex && pinDisplayIndex < base.endIndex) {
    return base;
  }

  return maybePinSegmentListVirtualWindow(base, pinDisplayIndex, displayCount, itemStridePx, {
    overscan: SEGMENT_LIST_VIRTUAL_OVERSCAN + (source === "listKeyboard" ? 1 : 0),
  });
}
