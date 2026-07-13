/** Scroll-into-view, DOM metrics, and scheduled scroll for segment lists. */

import {
  scrollSegmentListIndexIntoView,
  type SegmentListScrollAlign,
  type SegmentListVirtualWindow,
} from "./segmentListVirtualWindowCore";

export type { SegmentListScrollAlign, SegmentListVirtualWindow };

/** 语段列表滚动容器标记（`EditorSegmentList` 根节点） */
export const SEGMENT_LIST_SCROLL_ATTR = "data-segment-list-scroll";

/** 筛选后可见语段的绝对 idx 列表（逗号分隔）；无属性 = 全表顺序展示。 */
export const SEGMENT_LIST_FILTER_INDICES_ATTR = "data-segment-list-filter-indices";

const SEGMENT_LIST_ROW_GAP_PX = 10;
const SEGMENT_LIST_ROW_MIN_HEIGHT_ATTR = "data-segment-list-row-min-height";
const SEGMENT_LIST_ITEM_STRIDE_ATTR = "data-segment-list-item-stride";

export function querySegmentListScrollRoot(): HTMLElement | null {
  const el = document.querySelector(`[${SEGMENT_LIST_SCROLL_ATTR}]`);
  return el instanceof HTMLElement ? el : null;
}

export function writeSegmentListFilterIndices(
  root: HTMLElement,
  filteredIndices: readonly number[],
  isFiltered: boolean,
): void {
  if (!isFiltered || filteredIndices.length === 0) {
    root.removeAttribute(SEGMENT_LIST_FILTER_INDICES_ATTR);
    return;
  }
  root.setAttribute(SEGMENT_LIST_FILTER_INDICES_ATTR, filteredIndices.join(","));
}

export function readSegmentListFilterIndices(root: HTMLElement | null): number[] | null {
  if (!root) return null;
  const raw = root.getAttribute(SEGMENT_LIST_FILTER_INDICES_ATTR);
  if (!raw) return null;
  const indices = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return indices.length > 0 ? indices : null;
}

function segmentIdxToDisplayIndex(
  filteredIndices: readonly number[] | null,
  segmentIdx: number,
): number | null {
  if (!filteredIndices) return segmentIdx;
  const displayIdx = filteredIndices.indexOf(segmentIdx);
  return displayIdx >= 0 ? displayIdx : null;
}

function displayIndexToSegmentIdx(
  filteredIndices: readonly number[] | null,
  displayIdx: number,
): number | null {
  if (!filteredIndices) return displayIdx;
  const segmentIdx = filteredIndices[displayIdx];
  return segmentIdx === undefined ? null : segmentIdx;
}

function resolveSegmentListDisplayCount(
  scrollRoot: HTMLElement | null,
  fallbackSegmentCount: number,
): { filteredIndices: number[] | null; displayCount: number } {
  const filteredIndices = readSegmentListFilterIndices(scrollRoot);
  if (filteredIndices) {
    return { filteredIndices, displayCount: filteredIndices.length };
  }
  return { filteredIndices: null, displayCount: fallbackSegmentCount };
}

export function annotateSegmentListScrollMetrics(
  root: HTMLElement,
  metrics: { rowMinHeightPx: number; itemStridePx: number },
): void {
  root.setAttribute(SEGMENT_LIST_ROW_MIN_HEIGHT_ATTR, String(metrics.rowMinHeightPx));
  root.setAttribute(SEGMENT_LIST_ITEM_STRIDE_ATTR, String(metrics.itemStridePx));
}

function readSegmentListScrollMetrics(root: HTMLElement): {
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
  fallbackSegmentCount: number,
): number | null {
  const { filteredIndices, displayCount } = resolveSegmentListDisplayCount(
    scrollRoot,
    fallbackSegmentCount,
  );
  if (!scrollRoot || displayCount <= 0) return null;

  const hit =
    typeof document.elementFromPoint === "function"
      ? document.elementFromPoint(clientX, clientY)
      : null;
  const rowEl = hit?.closest("[data-seg-row]");
  if (rowEl instanceof HTMLElement) {
    const idx = Number(rowEl.getAttribute("data-seg-row"));
    if (Number.isFinite(idx) && idx >= 0) {
      if (!filteredIndices || filteredIndices.includes(idx)) return idx;
      return null;
    }
  }

  const metrics = readSegmentListScrollMetrics(scrollRoot);
  if (!metrics) return null;
  const rect = scrollRoot.getBoundingClientRect();
  if (clientY < rect.top || clientY > rect.bottom) return null;
  const yInContent = clientY - rect.top + scrollRoot.scrollTop;
  const displayIdx = Math.floor(yInContent / metrics.itemStridePx);
  const clampedDisplay = Math.max(0, Math.min(displayCount - 1, displayIdx));
  return displayIndexToSegmentIdx(filteredIndices, clampedDisplay);
}

/** Visible display-row indices from current scrollTop (virtual list stride). */
export function resolveSegmentListViewportDisplayRowBounds(
  scrollRoot: HTMLElement,
  displayCount: number,
): { firstDisplayIdx: number; lastDisplayIdx: number } | null {
  const metrics = readSegmentListScrollMetrics(scrollRoot);
  if (!metrics || displayCount <= 0) return null;
  const stride = metrics.itemStridePx;
  const firstDisplayIdx = Math.max(0, Math.floor(scrollRoot.scrollTop / stride));
  const lastDisplayIdx = Math.max(
    0,
    Math.min(
      displayCount - 1,
      Math.floor((scrollRoot.scrollTop + scrollRoot.clientHeight - 1) / stride),
    ),
  );
  return { firstDisplayIdx, lastDisplayIdx };
}

/** Range drag: clamp hover to first/last visible row when pointer leaves the list viewport. */
export function resolveSegmentListRangeDragHoverIndex(
  scrollRoot: HTMLElement | null,
  clientX: number,
  clientY: number,
  fallbackSegmentCount: number,
): number | null {
  const { filteredIndices, displayCount } = resolveSegmentListDisplayCount(
    scrollRoot,
    fallbackSegmentCount,
  );
  if (!scrollRoot || displayCount <= 0) return null;

  const rect = scrollRoot.getBoundingClientRect();
  if (clientY >= rect.top && clientY <= rect.bottom) {
    return resolveSegmentListRowIndexFromPoint(scrollRoot, clientX, clientY, fallbackSegmentCount);
  }

  const bounds = resolveSegmentListViewportDisplayRowBounds(scrollRoot, displayCount);
  if (!bounds) return null;
  const clampedDisplay =
    clientY < rect.top ? bounds.firstDisplayIdx : bounds.lastDisplayIdx;
  return displayIndexToSegmentIdx(filteredIndices, clampedDisplay);
}

function clampSegmentListScrollTop(
  scrollTop: number,
  maxScrollTop: number | undefined,
): number {
  const max = maxScrollTop ?? Number.POSITIVE_INFINITY;
  return Math.round(Math.min(max, Math.max(0, scrollTop)));
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

/**
 * 将语段滚入列表可视区：优先按真实 DOM 校正；行未挂载时按虚拟 stride 估算并二次校正。
 */
export function scrollSegmentListIndexToView(segmentIdx: number): boolean {
  const root = querySegmentListScrollRoot();
  if (!root || segmentIdx < 0) return false;

  const filteredIndices = readSegmentListFilterIndices(root);
  const displayIndex = segmentIdxToDisplayIndex(filteredIndices, segmentIdx);
  if (displayIndex == null) return false;

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
    index: displayIndex,
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

const SCHEDULED_SCROLL_COALESCE_MS = 32;

let scheduledScrollTimer: ReturnType<typeof setTimeout> | null = null;
let scheduledScrollIdx: number | null = null;

function runScheduledSegmentListScroll(): void {
  scheduledScrollTimer = null;
  const idx = scheduledScrollIdx;
  scheduledScrollIdx = null;
  if (idx != null) scrollSegmentListIndexToView(idx);
}

export function scheduleScrollSegmentListIndexToView(segmentIdx: number): void {
  scheduledScrollIdx = segmentIdx;
  if (scheduledScrollTimer != null) {
    clearTimeout(scheduledScrollTimer);
  }
  scheduledScrollTimer = setTimeout(runScheduledSegmentListScroll, SCHEDULED_SCROLL_COALESCE_MS);
}

export function resetScheduledSegmentListScrollForTests(): void {
  if (scheduledScrollTimer != null) clearTimeout(scheduledScrollTimer);
  scheduledScrollTimer = null;
  scheduledScrollIdx = null;
}

/** pin 合并后允许的最大挂载行数；超出则仅保留 scroll 窗口（选中远距时靠 scroll-into-view）。 */
const SEGMENT_LIST_VIRTUAL_MAX_PIN_MERGE_SPAN = 160;

/** 虚拟窗口未包含索引时，与当前 scroll 窗口 **合并**（禁止整窗替换导致远距 pin 空白屏）。 */
export function ensureSegmentListVirtualWindowIncludesIndex(
  window: SegmentListVirtualWindow,
  index: number,
  totalCount: number,
  itemStridePx: number,
  overscan = 8,
): SegmentListVirtualWindow {
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

/** 将 selected 合并进 scroll 窗口；合并跨度过大时放弃 pin，避免远距整段挂载。 */
export function maybePinSegmentListVirtualWindow(
  window: SegmentListVirtualWindow,
  pinIndex: number,
  totalCount: number,
  itemStridePx: number,
  options?: { overscan?: number; maxMergeSpan?: number },
): SegmentListVirtualWindow {
  if (pinIndex < 0 || pinIndex >= totalCount) return window;
  if (pinIndex >= window.startIndex && pinIndex < window.endIndex) return window;

  const merged = ensureSegmentListVirtualWindowIncludesIndex(
    window,
    pinIndex,
    totalCount,
    itemStridePx,
    options?.overscan,
  );
  const maxMergeSpan = options?.maxMergeSpan ?? SEGMENT_LIST_VIRTUAL_MAX_PIN_MERGE_SPAN;
  if (merged.endIndex - merged.startIndex > maxMergeSpan) return window;
  return merged;
}
