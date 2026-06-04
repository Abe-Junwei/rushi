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

/** 语段列表滚动容器标记（`EditorSegmentList` 根节点） */
export const SEGMENT_LIST_SCROLL_ATTR = "data-segment-list-scroll";

export function querySegmentListScrollRoot(): HTMLElement | null {
  const el = document.querySelector(`[${SEGMENT_LIST_SCROLL_ATTR}]`);
  return el instanceof HTMLElement ? el : null;
}

/**
 * 在列表滚动容器内将语段行滚入可视区（按真实 DOM 高度，修正虚拟列表固定 stride 偏差）。
 * @returns 建议的 scrollTop；无需滚动时返回 null
 */
export function scrollSegmentRowIntoViewContainer(
  segmentIdx: number,
  scrollRoot: HTMLElement,
): number | null {
  if (segmentIdx < 0) return null;
  const row = scrollRoot.querySelector<HTMLElement>(`[data-seg-row="${segmentIdx}"]`);
  if (!row) return null;

  const rowRect = row.getBoundingClientRect();
  const rootRect = scrollRoot.getBoundingClientRect();
  const margin = 12;
  let next = scrollRoot.scrollTop;

  if (rowRect.top < rootRect.top + margin) {
    next += rowRect.top - rootRect.top - margin;
  } else if (rowRect.bottom > rootRect.bottom - margin) {
    next += rowRect.bottom - rootRect.bottom + margin;
  } else {
    return null;
  }

  return Math.max(0, Math.round(next));
}

/** 虚拟窗口未包含选中行时，向两侧扩展渲染范围（避免跳转后行未挂载） */
export function ensureSegmentListVirtualWindowIncludesIndex(
  window: {
    startIndex: number;
    endIndex: number;
    paddingTopPx: number;
    paddingBottomPx: number;
    totalHeightPx: number;
  },
  index: number,
  totalCount: number,
  itemStridePx: number,
  overscan = 8,
): typeof window {
  if (index < 0 || index >= totalCount) return window;
  if (index >= window.startIndex && index < window.endIndex) return window;

  const startIndex = Math.max(0, index - overscan);
  const endIndex = Math.min(totalCount, index + overscan + 1);
  return {
    startIndex,
    endIndex,
    paddingTopPx: startIndex * itemStridePx,
    paddingBottomPx: Math.max(0, window.totalHeightPx - endIndex * itemStridePx),
    totalHeightPx: window.totalHeightPx,
  };
}
