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
import { LIST_ADVANCE_PLAY_COALESCE_MS } from "../../utils/scheduleListAdvanceSegmentPlayback";
import type { SegmentListFilterNavState } from "../../utils/segmentListFilterNav";

/** clientHeight 尚未量到时的保守视口，避免 0 导致整表挂载 */
const SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX = 480;

function readScrollMetrics(root: HTMLElement | null): { scrollTop: number; viewportHeight: number } {
  if (!root) {
    return { scrollTop: 0, viewportHeight: SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX };
  }
  return {
    scrollTop: root.scrollTop,
    viewportHeight: root.clientHeight > 0 ? root.clientHeight : SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX,
  };
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
  const pendingSelectedScrollKeyRef = useRef<string | null>(null);
  const pendingSelectedScrollIdxRef = useRef<number>(-1);
  const pendingSelectedDisplayIndexRef = useRef<number>(-1);
  const selectedScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rowMinHeightPx = segmentListRowMinHeightPx(transcriptRowHeightPx);
  const itemStridePx = segmentListItemStridePx(rowMinHeightPx);
  const useVirtualList = displayCount >= SEGMENT_LIST_VIRTUALIZE_MIN_COUNT;

  const filteredIndicesScrollKey = useMemo(() => {
    const first = filteredIndices[0] ?? -1;
    const last = filteredIndices[filteredIndices.length - 1] ?? -1;
    return `${filterActive ? "filtered" : "all"}:${displayCount}:${first}:${last}`;
  }, [displayCount, filterActive, filteredIndices]);

  const scheduleScrollEpochBump = useCallback(() => {
    if (scrollEpochRafRef.current != null) return;
    scrollEpochRafRef.current = window.requestAnimationFrame(() => {
      scrollEpochRafRef.current = null;
      setScrollEpoch((n) => n + 1);
    });
  }, []);

  const syncScrollMetrics = useCallback(() => {
    scrollMetricsRef.current = readScrollMetrics(segmentListRef.current);
  }, [segmentListRef]);

  const bumpScrollEpoch = useCallback(() => {
    syncScrollMetrics();
    scheduleScrollEpochBump();
  }, [scheduleScrollEpochBump, syncScrollMetrics]);

  const handleScroll = useCallback(() => {
    syncScrollMetrics();
    scheduleScrollEpochBump();
  }, [scheduleScrollEpochBump, syncScrollMetrics]);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    if (!root) return;
    annotateSegmentListScrollMetrics(root, { rowMinHeightPx, itemStridePx });
    bumpScrollEpoch();
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
    pendingSelectedScrollKeyRef.current = scrollKey;
    pendingSelectedScrollIdxRef.current = selectedIdx;
    pendingSelectedDisplayIndexRef.current = selectedDisplayIndex;
    if (selectedScrollTimerRef.current != null) clearTimeout(selectedScrollTimerRef.current);
    selectedScrollTimerRef.current = setTimeout(() => {
      selectedScrollTimerRef.current = null;
      const pendingKey = pendingSelectedScrollKeyRef.current;
      pendingSelectedScrollKeyRef.current = null;
      if (!pendingKey || lastSelectedScrollKeyRef.current === pendingKey) return;
      lastSelectedScrollKeyRef.current = pendingKey;

      const segmentIdx = pendingSelectedScrollIdxRef.current;
      const displayIndex = pendingSelectedDisplayIndexRef.current;
      if (segmentIdx < 0 || displayIndex < 0) return;

      const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
      const nextScrollTop = scrollSegmentListIndexIntoView({
        scrollTop: root.scrollTop,
        viewportHeight: root.clientHeight,
        index: displayIndex,
        rowMinHeightPx,
        itemStridePx,
        align: "minimal",
        maxScrollTop,
      });
      if (nextScrollTop != null) {
        root.scrollTop = nextScrollTop;
        bumpScrollEpoch();
        window.requestAnimationFrame(() => {
          const corrected = scrollSegmentRowIntoViewContainer(segmentIdx, root, { align: "minimal" });
          if (corrected == null) return;
          if (Math.abs(corrected - root.scrollTop) < 1) return;
          root.scrollTop = corrected;
          bumpScrollEpoch();
        });
        return;
      }

      const corrected = scrollSegmentRowIntoViewContainer(segmentIdx, root, { align: "minimal" });
      if (corrected == null) return;
      if (Math.abs(corrected - root.scrollTop) < 1) return;
      root.scrollTop = corrected;
      bumpScrollEpoch();
    }, LIST_ADVANCE_PLAY_COALESCE_MS);

    return () => {
      if (selectedScrollTimerRef.current != null) {
        clearTimeout(selectedScrollTimerRef.current);
        selectedScrollTimerRef.current = null;
      }
    };
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
