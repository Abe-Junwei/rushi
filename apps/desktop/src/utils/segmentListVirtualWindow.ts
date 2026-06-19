/** Vertical list virtualization for fixed-height segment rows. */

export {
  computeSegmentListVirtualWindow,
  isEditableSegmentBodyTextarea,
  scrollSegmentListIndexIntoView,
  segmentListItemStridePx,
  segmentListRangeDragExceededSlop,
  segmentListRangeDragVerticalIntentExceededSlop,
  segmentListRowMinHeightPx,
  segmentListVirtualRowTopPx,
  SEGMENT_LIST_VIRTUAL_OVERSCAN,
  SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
  type SegmentListScrollAlign,
  type SegmentListVirtualWindow,
} from "./segmentListVirtualWindowCore";

export {
  annotateSegmentListScrollMetrics,
  ensureSegmentListVirtualWindowIncludesIndex,
  maybePinSegmentListVirtualWindow,
  querySegmentListScrollRoot,
  readSegmentListFilterIndices,
  resetScheduledSegmentListScrollForTests,
  scheduleScrollSegmentListIndexToView,
  scrollSegmentListIndexToView,
  scrollSegmentRowIntoViewContainer,
  SEGMENT_LIST_FILTER_INDICES_ATTR,
  SEGMENT_LIST_SCROLL_ATTR,
  resolveSegmentListRowIndexFromPoint,
  writeSegmentListFilterIndices,
} from "./segmentListScrollIntoView";
