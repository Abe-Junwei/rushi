/** Vertical list virtualization for fixed-height segment rows. */

export const SEGMENT_LIST_ROW_GAP_PX = 10;

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
}): {
  startIndex: number;
  endIndex: number;
  paddingTopPx: number;
  paddingBottomPx: number;
  totalHeightPx: number;
} {
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

export function scrollSegmentListIndexIntoView(input: {
  scrollTop: number;
  viewportHeight: number;
  index: number;
  rowMinHeightPx: number;
  itemStridePx: number;
}): number | null {
  if (input.index < 0 || input.viewportHeight <= 0) return null;
  const rowTop = input.index * input.itemStridePx;
  const rowBottom = rowTop + input.rowMinHeightPx;
  const viewTop = input.scrollTop;
  const viewBottom = viewTop + input.viewportHeight;
  if (rowTop < viewTop) return rowTop;
  if (rowBottom > viewBottom) return Math.max(0, rowBottom - input.viewportHeight);
  return null;
}
