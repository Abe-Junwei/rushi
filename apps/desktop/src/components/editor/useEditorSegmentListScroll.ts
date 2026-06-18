import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  annotateSegmentListScrollMetrics,
  computeSegmentListVirtualWindow,
  maybePinSegmentListVirtualWindow,
  scrollSegmentListIndexIntoView,
  scrollSegmentRowIntoViewContainer,
  SEGMENT_LIST_VIRTUAL_OVERSCAN,
  SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
  writeSegmentListFilterIndices,
} from "../../utils/segmentListVirtualWindow";
import type { SegmentListFilterNavState } from "../../utils/segmentListFilterNav";
import { selectionProfileTime } from "../../services/ui/selectionLatencyProfile";

/** clientHeight 尚未量到时的保守视口，避免 0 导致整表挂载 */
const SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX = 480;
const SCROLL_METRICS_EPSILON_PX = 0.5;

function readScrollMetrics(root: HTMLElement | null): { scrollTop: number; viewportHeight: number } {
  if (!root) {
    return { scrollTop: 0, viewportHeight: SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX };
  }
  return {
    scrollTop: root.scrollTop,
    viewportHeight: root.clientHeight > 0 ? root.clientHeight : SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX,
  };
}

function scrollMetricsEqual(
  a: { scrollTop: number; viewportHeight: number },
  b: { scrollTop: number; viewportHeight: number },
): boolean {
  return (
    Math.abs(a.scrollTop - b.scrollTop) < SCROLL_METRICS_EPSILON_PX &&
    Math.abs(a.viewportHeight - b.viewportHeight) < SCROLL_METRICS_EPSILON_PX
  );
}

export type UseEditorSegmentListScrollArgs = {
  segmentListRef: React.RefObject<HTMLDivElement | null>;
  filterNavRef: React.MutableRefObject<SegmentListFilterNavState>;
  filteredIndices: number[];
  filterActive: boolean;
  displayCount: number;
  selectedDisplayIndex: number;
  selectedIdx: number;
  currentFileId: string | null;
  transcriptRowHeightPx: number;
};

export function useEditorSegmentListScroll({
  segmentListRef,
  filterNavRef,
  filteredIndices,
  filterActive,
  displayCount,
  selectedDisplayIndex,
  selectedIdx,
  currentFileId,
  transcriptRowHeightPx,
}: UseEditorSegmentListScrollArgs) {
  const scrollMetricsRef = useRef(readScrollMetrics(null));
  const [scrollEpoch, setScrollEpoch] = useState(0);
  const scrollEpochRafRef = useRef<number | null>(null);
  const lastSelectedScrollKeyRef = useRef<string | null>(null);

  const rowMinHeightPx = segmentListRowMinHeightPx(transcriptRowHeightPx);
  const itemStridePx = segmentListItemStridePx(rowMinHeightPx);
  const useVirtualList = displayCount >= SEGMENT_LIST_VIRTUALIZE_MIN_COUNT;

  const filteredIndicesScrollKey = useMemo(() => {
    const first = filteredIndices[0] ?? -1;
    const last = filteredIndices[filteredIndices.length - 1] ?? -1;
    return `${filterActive ? "filtered" : "all"}:${displayCount}:${first}:${last}`;
  }, [displayCount, filterActive, filteredIndices]);

  const scheduleScrollEpochBump = useCallback(() => {
    if (!useVirtualList || scrollEpochRafRef.current != null) return;
    scrollEpochRafRef.current = window.requestAnimationFrame(() => {
      scrollEpochRafRef.current = null;
      setScrollEpoch((n) => n + 1);
    });
  }, [useVirtualList]);

  const bumpScrollEpoch = useCallback(
    (options?: { force?: boolean }) => {
      const next = readScrollMetrics(segmentListRef.current);
      const prev = scrollMetricsRef.current;
      const changed = !scrollMetricsEqual(next, prev);
      scrollMetricsRef.current = next;
      if (!useVirtualList) return;
      if (!options?.force && !changed) return;
      scheduleScrollEpochBump();
    },
    [scheduleScrollEpochBump, segmentListRef, useVirtualList],
  );

  const handleScroll = useCallback(() => {
    bumpScrollEpoch();
  }, [bumpScrollEpoch]);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    if (!root) return;
    annotateSegmentListScrollMetrics(root, { rowMinHeightPx, itemStridePx });
    bumpScrollEpoch({ force: useVirtualList });
    const observer = new ResizeObserver(() => bumpScrollEpoch());
    observer.observe(root);
    const raf = window.requestAnimationFrame(() => bumpScrollEpoch());
    return () => {
      window.cancelAnimationFrame(raf);
      if (scrollEpochRafRef.current != null) {
        window.cancelAnimationFrame(scrollEpochRafRef.current);
        scrollEpochRafRef.current = null;
      }
      observer.disconnect();
    };
  }, [bumpScrollEpoch, itemStridePx, rowMinHeightPx, segmentListRef, displayCount, useVirtualList]);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    if (!root || selectedDisplayIndex < 0) return;

    const scrollKey = `${currentFileId ?? ""}:${selectedIdx}:${selectedDisplayIndex}:${filteredIndicesScrollKey}`;
    if (lastSelectedScrollKeyRef.current === scrollKey) return;
    lastSelectedScrollKeyRef.current = scrollKey;

    const nextScrollTop = selectionProfileTime("listScroll", () => {
      const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
      return scrollSegmentListIndexIntoView({
        scrollTop: root.scrollTop,
        viewportHeight: root.clientHeight,
        index: selectedDisplayIndex,
        rowMinHeightPx,
        itemStridePx,
        align: "minimal",
        maxScrollTop,
      });
    });
    if (nextScrollTop != null) {
      root.scrollTop = nextScrollTop;
      bumpScrollEpoch();
      window.requestAnimationFrame(() => {
        const corrected = selectionProfileTime("listScrollCorrect", () =>
          scrollSegmentRowIntoViewContainer(selectedIdx, root, { align: "minimal" }),
        );
        if (corrected == null) return;
        if (Math.abs(corrected - root.scrollTop) < 1) return;
        root.scrollTop = corrected;
        bumpScrollEpoch();
      });
      return;
    }

    const corrected = selectionProfileTime("listScrollCorrect", () =>
      scrollSegmentRowIntoViewContainer(selectedIdx, root, { align: "minimal" }),
    );
    if (corrected == null) return;
    if (Math.abs(corrected - root.scrollTop) < 1) return;
    root.scrollTop = corrected;
    bumpScrollEpoch();
  }, [
    bumpScrollEpoch,
    currentFileId,
    filteredIndicesScrollKey,
    itemStridePx,
    rowMinHeightPx,
    segmentListRef,
    selectedDisplayIndex,
    selectedIdx,
  ]);

  useLayoutEffect(() => {
    lastSelectedScrollKeyRef.current = null;
  }, [currentFileId]);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    filterNavRef.current = { active: filterActive, indices: filteredIndices };
    if (!root) return;
    writeSegmentListFilterIndices(root, filteredIndices, filterActive);
  }, [filterActive, filteredIndices, filterNavRef, segmentListRef]);

  const virtualWindow = useMemo(() => {
    if (!useVirtualList) {
      return {
        startIndex: 0,
        endIndex: displayCount,
        paddingTopPx: 0,
        paddingBottomPx: 0,
        totalHeightPx: 0,
      };
    }
    const { scrollTop, viewportHeight } = scrollMetricsRef.current;
    const base = computeSegmentListVirtualWindow({
      scrollTop,
      viewportHeight,
      itemStridePx,
      totalCount: displayCount,
      overscan: SEGMENT_LIST_VIRTUAL_OVERSCAN,
    });
    if (selectedDisplayIndex < 0) return base;
    return maybePinSegmentListVirtualWindow(base, selectedDisplayIndex, displayCount, itemStridePx, {
      overscan: SEGMENT_LIST_VIRTUAL_OVERSCAN,
    });
  }, [scrollEpoch, useVirtualList, itemStridePx, displayCount, selectedDisplayIndex]);

  return {
    useVirtualList,
    itemStridePx,
    handleScroll,
    virtualWindow,
  };
}
