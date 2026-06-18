/** Core virtual-window math for fixed-height segment rows. */

const SEGMENT_LIST_ROW_GAP_PX = 10;

export function segmentListItemStridePx(rowMinHeightPx: number): number {
  return Math.max(1, Math.round(rowMinHeightPx)) + SEGMENT_LIST_ROW_GAP_PX;
}

export function segmentListRowMinHeightPx(segmentRowHeightPx: number): number {
  return Math.max(60, Math.round(segmentRowHeightPx + 2));
}

export function computeSegmentListVirtualWindow(input: {
  scrollTop: number;
  viewportHeight: number;
  itemStridePx: number;
  totalCount: number;
  overscan?: number;
}): SegmentListVirtualWindow {
  const { scrollTop, viewportHeight, itemStridePx, totalCount, overscan = 8 } = input;
  if (totalCount <= 0 || itemStridePx <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      paddingTopPx: 0,
      paddingBottomPx: 0,
      totalHeightPx: 0,
    };
  }
  const totalHeightPx = totalCount * itemStridePx;
  if (viewportHeight <= 0) {
    return {
      startIndex: 0,
      endIndex: totalCount,
      paddingTopPx: 0,
      paddingBottomPx: 0,
      totalHeightPx,
    };
  }
  const startIndex = Math.max(0, Math.floor(scrollTop / itemStridePx) - overscan);
  const visibleCount = Math.ceil(viewportHeight / itemStridePx) + overscan * 2;
  const endIndex = Math.min(totalCount, startIndex + visibleCount);
  return {
    startIndex,
    endIndex,
    paddingTopPx: startIndex * itemStridePx,
    paddingBottomPx: Math.max(0, totalHeightPx - endIndex * itemStridePx),
    totalHeightPx,
  };
}

export type SegmentListScrollAlign = "minimal" | "center";

/** 语段数达到此阈值时启用列表虚拟化（SEG-TEXT-P1）。 */
export const SEGMENT_LIST_VIRTUALIZE_MIN_COUNT = 90;

/** 虚拟列表默认 overscan（行数）。 */
export const SEGMENT_LIST_VIRTUAL_OVERSCAN = 12;

function clampSegmentListScrollTop(
  scrollTop: number,
  maxScrollTop: number | undefined,
): number {
  const max = maxScrollTop ?? Number.POSITIVE_INFINITY;
  return Math.round(Math.min(max, Math.max(0, scrollTop)));
}

export function scrollSegmentListIndexIntoView(input: {
  scrollTop: number;
  viewportHeight: number;
  index: number;
  rowMinHeightPx: number;
  itemStridePx: number;
  align?: SegmentListScrollAlign;
  maxScrollTop?: number;
}): number | null {
  if (input.index < 0 || input.viewportHeight <= 0) return null;
  const rowTop = input.index * input.itemStridePx;
  const rowBottom = rowTop + input.rowMinHeightPx;

  if (input.align === "center") {
    const rowCenter = rowTop + input.rowMinHeightPx / 2;
    const target = clampSegmentListScrollTop(
      rowCenter - input.viewportHeight / 2,
      input.maxScrollTop,
    );
    if (Math.abs(target - input.scrollTop) < 1) return null;
    return target;
  }

  const viewTop = input.scrollTop;
  const viewBottom = viewTop + input.viewportHeight;
  if (rowTop < viewTop) return rowTop;
  if (rowBottom > viewBottom) return Math.max(0, rowBottom - input.viewportHeight);
  return null;
}

/** 列表 range 拖选：低于此像素位移视为点击，不扩展多选。 */
const SEGMENT_LIST_RANGE_DRAG_SLOP_PX = 5;

export function segmentListRangeDragExceededSlop(
  startClientX: number,
  startClientY: number,
  clientX: number,
  clientY: number,
  slopPx = SEGMENT_LIST_RANGE_DRAG_SLOP_PX,
): boolean {
  const dx = clientX - startClientX;
  const dy = clientY - startClientY;
  return dx * dx + dy * dy >= slopPx * slopPx;
}

/** 可编辑正文 textarea 上：仅当垂直位移主导时才视为语段 range 拖选（保留横向选字）。 */
export function segmentListRangeDragVerticalIntentExceededSlop(
  startClientX: number,
  startClientY: number,
  clientX: number,
  clientY: number,
  slopPx = SEGMENT_LIST_RANGE_DRAG_SLOP_PX,
): boolean {
  const dx = clientX - startClientX;
  const dy = clientY - startClientY;
  return Math.abs(dy) >= slopPx && Math.abs(dy) > Math.abs(dx);
}

export function isEditableSegmentBodyTextarea(el: Element | null): el is HTMLTextAreaElement {
  return (
    el instanceof HTMLTextAreaElement &&
    el.getAttribute("aria-label") === "语段正文" &&
    !el.readOnly &&
    !el.disabled
  );
}

export type SegmentListVirtualWindow = {
  startIndex: number;
  endIndex: number;
  paddingTopPx: number;
  paddingBottomPx: number;
  totalHeightPx: number;
};
