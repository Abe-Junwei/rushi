import {
  scrollSegmentListIndexIntoView,
  scrollSegmentListIndexIntoViewForMount,
  segmentListIndexNeedsScrollAdjustment,
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
  const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
  const needsListScroll = segmentListIndexNeedsScrollAdjustment({
    scrollTop: root.scrollTop,
    viewportHeight: root.clientHeight,
    index: selectedDisplayIndex,
    rowMinHeightPx,
    itemStridePx,
    maxScrollTop,
  });

  if (fromWaveform && !needsListScroll) {
    return { kind: "skip" };
  }

  const projected = scrollSegmentListIndexIntoView({
    scrollTop: root.scrollTop,
    viewportHeight: root.clientHeight,
    index: selectedDisplayIndex,
    rowMinHeightPx,
    itemStridePx,
    align: "minimal",
    maxScrollTop,
  });
  let nextScrollTop = projected;
  if (nextScrollTop == null && !fromWaveform && useVirtualList) {
    if (root.querySelector(`[data-seg-row="${selectedIdx}"]`) == null) {
      nextScrollTop = scrollSegmentListIndexIntoViewForMount({
        scrollTop: root.scrollTop,
        viewportHeight: root.clientHeight,
        index: selectedDisplayIndex,
        itemStridePx,
        maxScrollTop,
      });
    }
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
