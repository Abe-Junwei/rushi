import {
  computeSegmentListVirtualWindow,
  maybePinSegmentListVirtualWindow,
  resolveVirtualListScrollTopForWindow,
  SEGMENT_LIST_VIRTUAL_OVERSCAN,
} from "../../utils/segmentListVirtualWindow";
import type { SegmentSelectSource } from "../../utils/waveformViewMode";
import { shouldSkipListScrollWhenInViewport } from "../../utils/waveformViewMode";
import type { MutableRefObject } from "react";

export type ComputeEditorSegmentListVirtualWindowArgs = {
  segmentListRoot: HTMLElement | null;
  scrollMetricsRef: MutableRefObject<{ scrollTop: number; viewportHeight: number }>;
  selectionScrollProjectionRef: MutableRefObject<boolean>;
  prevSelectedDisplayIndexRef: MutableRefObject<number>;
  selectedDisplayIndex: number;
  displayCount: number;
  itemStridePx: number;
  rowMinHeightPx: number;
  useVirtualList: boolean;
  source: SegmentSelectSource | undefined;
};

export function computeEditorSegmentListVirtualWindow({
  segmentListRoot,
  scrollMetricsRef,
  selectionScrollProjectionRef,
  prevSelectedDisplayIndexRef,
  selectedDisplayIndex,
  displayCount,
  itemStridePx,
  rowMinHeightPx,
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

  const fromWaveform = shouldSkipListScrollWhenInViewport(source ?? "waveform");
  const selectionChanged = prevSelectedDisplayIndexRef.current !== selectedDisplayIndex;
  prevSelectedDisplayIndexRef.current = selectedDisplayIndex;
  if (fromWaveform) {
    selectionScrollProjectionRef.current = false;
  } else if (selectionChanged && selectedDisplayIndex >= 0) {
    selectionScrollProjectionRef.current = true;
  }

  const scrollMetrics = scrollMetricsRef.current;
  const scrollTop = resolveVirtualListScrollTopForWindow({
    rootScrollTop: segmentListRoot?.scrollTop ?? scrollMetrics.scrollTop,
    rootScrollHeight: segmentListRoot?.scrollHeight ?? 0,
    rootClientHeight: segmentListRoot?.clientHeight ?? 0,
    scrollMetrics,
    selectedDisplayIndex,
    rowMinHeightPx,
    itemStridePx,
    useSelectionProjection: selectionScrollProjectionRef.current,
  });
  const base = computeSegmentListVirtualWindow({
    scrollTop,
    viewportHeight: scrollMetrics.viewportHeight,
    itemStridePx,
    totalCount: displayCount,
    overscan: SEGMENT_LIST_VIRTUAL_OVERSCAN,
  });
  if (fromWaveform || selectedDisplayIndex < 0) return base;
  return maybePinSegmentListVirtualWindow(base, selectedDisplayIndex, displayCount, itemStridePx, {
    overscan: SEGMENT_LIST_VIRTUAL_OVERSCAN + 1,
  });
}
