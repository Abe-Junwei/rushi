/** Core virtual-window math for fixed-height segment rows. */

const SEGMENT_LIST_ROW_GAP_PX = 10;

export function segmentListItemStridePx(rowMinHeightPx: number): number {
  return Math.max(1, Math.round(rowMinHeightPx)) + SEGMENT_LIST_ROW_GAP_PX;
}

/** 虚拟列表：按 display index 固定槽位 top，避免文档流堆叠与 stride 漂移。 */
export function segmentListVirtualRowTopPx(displayIndex: number, itemStridePx: number): number {
  return Math.max(0, displayIndex) * itemStridePx;
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

export type SegmentListScrollAlign = "minimal" | "center" | "keyboard";

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

/** 选中换行时 layout 尚未写 scrollTop；仅在选择变更首帧启用投影（见 useEditorSegmentListScroll）。 */
export function resolveVirtualListScrollTopForWindow(input: {
  rootScrollTop: number;
  rootScrollHeight: number;
  rootClientHeight: number;
  scrollMetrics: { scrollTop: number; viewportHeight: number };
  selectedDisplayIndex: number;
  rowMinHeightPx: number;
  itemStridePx: number;
  /** 仅选中变更触发的首帧为 true；用户手动滚动须为 false。 */
  useSelectionProjection?: boolean;
  scrollAlign?: SegmentListScrollAlign;
}): number {
  const {
    rootScrollTop,
    rootScrollHeight,
    rootClientHeight,
    scrollMetrics,
    selectedDisplayIndex,
    rowMinHeightPx,
    itemStridePx,
    useSelectionProjection = false,
  } = input;
  if (!useSelectionProjection || selectedDisplayIndex < 0) return scrollMetrics.scrollTop;
  const viewportHeight = rootClientHeight > 0 ? rootClientHeight : scrollMetrics.viewportHeight;
  const maxScrollTop = Math.max(0, rootScrollHeight - rootClientHeight);
  const projected = scrollSegmentListIndexIntoView({
    scrollTop: rootScrollTop,
    viewportHeight,
    index: selectedDisplayIndex,
    rowMinHeightPx,
    itemStridePx,
    align: input.scrollAlign ?? "minimal",
    maxScrollTop,
  });
  return projected ?? scrollMetrics.scrollTop;
}

/** 选中行是否已完全落在列表 scroll 视口内（无需 scroll-into-view）。 */
export function segmentListIndexNeedsScrollAdjustment(input: {
  scrollTop: number;
  viewportHeight: number;
  index: number;
  rowMinHeightPx: number;
  itemStridePx: number;
  maxScrollTop?: number;
  align?: SegmentListScrollAlign;
}): boolean {
  if (input.index < 0 || input.viewportHeight <= 0) return false;
  return (
    scrollSegmentListIndexIntoView({
      ...input,
      align: input.align ?? "minimal",
    }) != null
  );
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

  if (input.align === "keyboard") {
    const bottomMarginPx = input.itemStridePx;
    if (rowTop < viewTop) {
      const target = clampSegmentListScrollTop(rowTop, input.maxScrollTop);
      if (Math.abs(target - input.scrollTop) < 1) return null;
      return target;
    }
    if (rowBottom > viewBottom - bottomMarginPx) {
      const target = clampSegmentListScrollTop(
        rowBottom - input.viewportHeight + bottomMarginPx,
        input.maxScrollTop,
      );
      if (Math.abs(target - input.scrollTop) < 1) return null;
      return target;
    }
    return null;
  }

  if (rowTop < viewTop) {
    const target = clampSegmentListScrollTop(rowTop, input.maxScrollTop);
    if (Math.abs(target - input.scrollTop) < 1) return null;
    return target;
  }
  if (rowBottom > viewBottom) {
    const target = clampSegmentListScrollTop(
      rowBottom - input.viewportHeight,
      input.maxScrollTop,
    );
    if (Math.abs(target - input.scrollTop) < 1) return null;
    return target;
  }
  return null;
}

export function segmentListVirtualWindowIncludesDisplayIndex(
  window: SegmentListVirtualWindow,
  displayIndex: number,
): boolean {
  return displayIndex >= window.startIndex && displayIndex < window.endIndex;
}

/** 选中行未挂载时强制滚到 stride 槽位（pin 合并超 cap 时的回退）。 */
export function scrollSegmentListIndexIntoViewForMount(input: {
  scrollTop: number;
  viewportHeight: number;
  index: number;
  itemStridePx: number;
  maxScrollTop?: number;
}): number | null {
  if (input.index < 0 || input.viewportHeight <= 0) return null;
  const rowTop = input.index * input.itemStridePx;
  return clampSegmentListScrollTop(rowTop, input.maxScrollTop);
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

export function isSegmentBodyTextarea(el: Element | null): el is HTMLTextAreaElement {
  return (
    el instanceof HTMLTextAreaElement &&
    el.getAttribute("aria-label") === "语段正文"
  );
}

/** List range drag uses vertical slop on timestamp gutter (horizontal ≠ multi-select). */
export function isSegmentListTimestampColumn(el: Element | null): boolean {
  return el instanceof Element && el.closest(".segment-row-meta-column-fallback") != null;
}

export function segmentListRangeDragRequiresVerticalIntent(target: Element | null): boolean {
  return (
    isSegmentBodyTextarea(target?.closest('textarea[aria-label="语段正文"]') ?? null) ||
    isSegmentListTimestampColumn(target)
  );
}

export function isEditableSegmentBodyTextarea(el: Element | null): el is HTMLTextAreaElement {
  return (
    isSegmentBodyTextarea(el) &&
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
