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

export type SegmentListScrollAlign = "minimal" | "center";

/** 语段数达到此阈值时启用列表虚拟化（SEG-TEXT-P1）。 */
export const SEGMENT_LIST_VIRTUALIZE_MIN_COUNT = 200;

/** 虚拟列表默认 overscan（行数）。 */
export const SEGMENT_LIST_VIRTUAL_OVERSCAN = 12;

/** selectedIdx 距当前 scroll 窗口超过此行数时不 pin（避免远距合并整表）。 */
export const SEGMENT_LIST_VIRTUAL_PIN_MAX_DISTANCE = 48;

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
export const SEGMENT_LIST_RANGE_DRAG_SLOP_PX = 5;

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

/** 语段列表滚动容器标记（`EditorSegmentList` 根节点） */
export const SEGMENT_LIST_SCROLL_ATTR = "data-segment-list-scroll";

export function querySegmentListScrollRoot(): HTMLElement | null {
  const el = document.querySelector(`[${SEGMENT_LIST_SCROLL_ATTR}]`);
  return el instanceof HTMLElement ? el : null;
}

const SEGMENT_LIST_ROW_MIN_HEIGHT_ATTR = "data-segment-list-row-min-height";
const SEGMENT_LIST_ITEM_STRIDE_ATTR = "data-segment-list-item-stride";

export function annotateSegmentListScrollMetrics(
  root: HTMLElement,
  metrics: { rowMinHeightPx: number; itemStridePx: number },
): void {
  root.setAttribute(SEGMENT_LIST_ROW_MIN_HEIGHT_ATTR, String(metrics.rowMinHeightPx));
  root.setAttribute(SEGMENT_LIST_ITEM_STRIDE_ATTR, String(metrics.itemStridePx));
}

export function readSegmentListScrollMetrics(root: HTMLElement): {
  rowMinHeightPx: number;
  itemStridePx: number;
} | null {
  const stride = Number(root.getAttribute(SEGMENT_LIST_ITEM_STRIDE_ATTR));
  const rowMin = Number(root.getAttribute(SEGMENT_LIST_ROW_MIN_HEIGHT_ATTR));
  if (!Number.isFinite(stride) || stride <= 0) return null;
  return {
    itemStridePx: stride,
    rowMinHeightPx:
      Number.isFinite(rowMin) && rowMin > 0 ? rowMin : Math.max(1, stride - SEGMENT_LIST_ROW_GAP_PX),
  };
}

/** 列表 range 拖选：pointer capture 会阻断 pointerenter，故用 hit-test + stride 回退。 */
export function resolveSegmentListRowIndexFromPoint(
  scrollRoot: HTMLElement | null,
  clientX: number,
  clientY: number,
  segmentCount: number,
): number | null {
  if (!scrollRoot || segmentCount <= 0) return null;

  const hit =
    typeof document.elementFromPoint === "function"
      ? document.elementFromPoint(clientX, clientY)
      : null;
  const rowEl = hit?.closest("[data-seg-row]");
  if (rowEl instanceof HTMLElement) {
    const idx = Number(rowEl.getAttribute("data-seg-row"));
    if (Number.isFinite(idx) && idx >= 0 && idx < segmentCount) return idx;
  }

  const metrics = readSegmentListScrollMetrics(scrollRoot);
  if (!metrics) return null;
  const rect = scrollRoot.getBoundingClientRect();
  if (clientY < rect.top || clientY > rect.bottom) return null;
  const yInContent = clientY - rect.top + scrollRoot.scrollTop;
  const idx = Math.floor(yInContent / metrics.itemStridePx);
  return Math.max(0, Math.min(segmentCount - 1, idx));
}

/**
 * 将语段滚入列表可视区：优先按真实 DOM 校正；行未挂载时按虚拟 stride 估算并二次校正。
 */
export function scrollSegmentListIndexToView(segmentIdx: number): boolean {
  const root = querySegmentListScrollRoot();
  if (!root || segmentIdx < 0) return false;

  const scrollOpts = { align: "center" as const };
  const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);

  const domNext = scrollSegmentRowIntoViewContainer(segmentIdx, root, scrollOpts);
  if (domNext != null) {
    root.scrollTop = domNext;
    return true;
  }

  const metrics = readSegmentListScrollMetrics(root);
  if (!metrics) return false;

  const indexNext = scrollSegmentListIndexIntoView({
    scrollTop: root.scrollTop,
    viewportHeight: root.clientHeight,
    index: segmentIdx,
    rowMinHeightPx: metrics.rowMinHeightPx,
    itemStridePx: metrics.itemStridePx,
    align: "center",
    maxScrollTop,
  });
  if (indexNext != null) root.scrollTop = indexNext;

  window.requestAnimationFrame(() => {
    const corrected = scrollSegmentRowIntoViewContainer(segmentIdx, root, scrollOpts);
    if (corrected != null) root.scrollTop = corrected;
  });
  return true;
}

/**
 * 在列表滚动容器内将语段行滚入可视区（按真实 DOM 高度，修正虚拟列表固定 stride 偏差）。
 * @returns 建议的 scrollTop；无需滚动时返回 null
 */
export function scrollSegmentRowIntoViewContainer(
  segmentIdx: number,
  scrollRoot: HTMLElement,
  options?: { align?: SegmentListScrollAlign },
): number | null {
  if (segmentIdx < 0) return null;
  const row = scrollRoot.querySelector<HTMLElement>(`[data-seg-row="${segmentIdx}"]`);
  if (!row) return null;

  const rowRect = row.getBoundingClientRect();
  const rootRect = scrollRoot.getBoundingClientRect();
  const maxScrollTop = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);

  if (options?.align === "center") {
    const rowCenter = rowRect.top + rowRect.height / 2;
    const rootCenter = rootRect.top + rootRect.height / 2;
    const delta = rowCenter - rootCenter;
    if (Math.abs(delta) < 1) return null;
    return clampSegmentListScrollTop(scrollRoot.scrollTop + delta, maxScrollTop);
  }

  const margin = 12;
  let next = scrollRoot.scrollTop;

  if (rowRect.top < rootRect.top + margin) {
    next += rowRect.top - rootRect.top - margin;
  } else if (rowRect.bottom > rootRect.bottom - margin) {
    next += rowRect.bottom - rootRect.bottom + margin;
  } else {
    return null;
  }

  return clampSegmentListScrollTop(next, maxScrollTop);
}

/** 虚拟窗口未包含索引时，与当前 scroll 窗口 **合并**（禁止整窗替换导致远距 pin 空白屏）。 */
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

  const pinStart = Math.max(0, index - overscan);
  const pinEnd = Math.min(totalCount, index + overscan + 1);
  const startIndex = Math.min(window.startIndex, pinStart);
  const endIndex = Math.max(window.endIndex, pinEnd);
  return {
    startIndex,
    endIndex,
    paddingTopPx: startIndex * itemStridePx,
    paddingBottomPx: Math.max(0, window.totalHeightPx - endIndex * itemStridePx),
    totalHeightPx: window.totalHeightPx,
  };
}

export type SegmentListVirtualWindow = {
  startIndex: number;
  endIndex: number;
  paddingTopPx: number;
  paddingBottomPx: number;
  totalHeightPx: number;
};

/** 仅当 selected 距 scroll 窗口不远时 union 扩展，避免远距 pin 空白屏或整表挂载。 */
export function maybePinSegmentListVirtualWindow(
  window: SegmentListVirtualWindow,
  pinIndex: number,
  totalCount: number,
  itemStridePx: number,
  options?: { overscan?: number; maxDistance?: number },
): SegmentListVirtualWindow {
  if (pinIndex < 0 || pinIndex >= totalCount) return window;
  if (pinIndex >= window.startIndex && pinIndex < window.endIndex) return window;

  const maxDistance = options?.maxDistance ?? SEGMENT_LIST_VIRTUAL_PIN_MAX_DISTANCE;
  const distance =
    pinIndex < window.startIndex
      ? window.startIndex - pinIndex
      : pinIndex - window.endIndex + 1;
  if (distance > maxDistance) return window;

  return ensureSegmentListVirtualWindowIncludesIndex(
    window,
    pinIndex,
    totalCount,
    itemStridePx,
    options?.overscan,
  );
}
