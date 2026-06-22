import {
  isSelectedSegmentRowIntersectingListViewport,
  scrollSegmentListIndexIntoView,
  scrollSegmentListIndexIntoViewForMount,
  segmentListIndexNeedsScrollAdjustment,
  segmentListVirtualWindowIncludesDisplayIndex,
  computeSegmentListVirtualWindow,
  SEGMENT_LIST_VIRTUAL_OVERSCAN,
} from "../../utils/segmentListVirtualWindow";
import type { SegmentSelectSource } from "../../utils/waveformViewMode";
import { shouldSkipListScrollWhenInViewport } from "../../utils/waveformViewMode";

export function isListKeyboardSelectSource(source: SegmentSelectSource | undefined): boolean {
  return source === "listKeyboard";
}

export type EditorSegmentListSelectionScrollPlan =
  | { kind: "skip" }
  | { kind: "write-scroll"; nextScrollTop: number; syncEpoch: boolean; skipDomCorrection: boolean }
  | { kind: "fallback-dom-correct" };

export type PlanEditorSegmentListSelectionScrollArgs = {
  root: HTMLElement;
  selectedDisplayIndex: number;
  selectedIdx: number;
  rowMinHeightPx: number;
  itemStridePx: number;
  useVirtualList: boolean;
  source: SegmentSelectSource | undefined;
};

export function planEditorSegmentListSelectionScroll({
  root,
  selectedDisplayIndex,
  selectedIdx,
  rowMinHeightPx,
  itemStridePx,
  useVirtualList,
  source,
}: PlanEditorSegmentListSelectionScrollArgs): EditorSegmentListSelectionScrollPlan {
  const fromWaveform = shouldSkipListScrollWhenInViewport(source ?? "waveform");
  const fromListKeyboard = isListKeyboardSelectSource(source);
  const scrollAlign = fromListKeyboard ? "keyboard" : fromWaveform ? "center" : "minimal";
  const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
  const scrollInput = {
    scrollTop: root.scrollTop,
    viewportHeight: root.clientHeight,
    index: selectedDisplayIndex,
    rowMinHeightPx,
    itemStridePx,
    maxScrollTop,
  };

  const needsListScroll = segmentListIndexNeedsScrollAdjustment({
    ...scrollInput,
    align: scrollAlign,
  });

  const rowVisibleInListViewport = isSelectedSegmentRowIntersectingListViewport(root, selectedIdx);

  if (fromWaveform && useVirtualList && !rowVisibleInListViewport) {
    const forcedScrollTop =
      scrollSegmentListIndexIntoView({
        ...scrollInput,
        align: scrollAlign,
      }) ??
      scrollSegmentListIndexIntoViewForMount({
        scrollTop: root.scrollTop,
        viewportHeight: root.clientHeight,
        index: selectedDisplayIndex,
        itemStridePx,
        maxScrollTop,
      });
    if (forcedScrollTop != null) {
      return {
        kind: "write-scroll",
        nextScrollTop: forcedScrollTop,
        syncEpoch: true,
        skipDomCorrection: false,
      };
    }
  }

  if (fromWaveform && !needsListScroll) {
    if (!useVirtualList || rowVisibleInListViewport) {
      return { kind: "skip" };
    }
  }

  const projected = scrollSegmentListIndexIntoView({
    ...scrollInput,
    align: scrollAlign,
  });
  let nextScrollTop = projected;
  if (nextScrollTop == null && useVirtualList) {
    const rowMissing = root.querySelector(`[data-seg-row="${selectedIdx}"]`) == null;
    if (rowMissing) {
      nextScrollTop = scrollSegmentListIndexIntoViewForMount({
        scrollTop: root.scrollTop,
        viewportHeight: root.clientHeight,
        index: selectedDisplayIndex,
        itemStridePx,
        maxScrollTop,
      });
    } else if (fromListKeyboard || fromWaveform) {
      const base = computeSegmentListVirtualWindow({
        scrollTop: root.scrollTop,
        viewportHeight: root.clientHeight,
        itemStridePx,
        totalCount: Math.max(selectedDisplayIndex + 1, 1),
        overscan: SEGMENT_LIST_VIRTUAL_OVERSCAN,
      });
      if (!segmentListVirtualWindowIncludesDisplayIndex(base, selectedDisplayIndex)) {
        nextScrollTop = scrollSegmentListIndexIntoViewForMount({
          scrollTop: root.scrollTop,
          viewportHeight: root.clientHeight,
          index: selectedDisplayIndex,
          itemStridePx,
          maxScrollTop,
        });
      } else if (fromWaveform && !rowVisibleInListViewport) {
        nextScrollTop =
          scrollSegmentListIndexIntoView({
            ...scrollInput,
            align: scrollAlign,
          }) ??
          scrollSegmentListIndexIntoViewForMount({
            scrollTop: root.scrollTop,
            viewportHeight: root.clientHeight,
            index: selectedDisplayIndex,
            itemStridePx,
            maxScrollTop,
          });
      }
    }
  }

  if (nextScrollTop == null && fromWaveform && useVirtualList && !rowVisibleInListViewport) {
    nextScrollTop =
      scrollSegmentListIndexIntoView({
        ...scrollInput,
        align: scrollAlign,
      }) ??
      scrollSegmentListIndexIntoViewForMount({
        scrollTop: root.scrollTop,
        viewportHeight: root.clientHeight,
        index: selectedDisplayIndex,
        itemStridePx,
        maxScrollTop,
      });
  }

  if (nextScrollTop != null) {
    return {
      kind: "write-scroll",
      nextScrollTop,
      syncEpoch: fromListKeyboard,
      skipDomCorrection: fromListKeyboard,
    };
  }

  if (fromWaveform || fromListKeyboard) {
    return { kind: "skip" };
  }

  return { kind: "fallback-dom-correct" };
}
