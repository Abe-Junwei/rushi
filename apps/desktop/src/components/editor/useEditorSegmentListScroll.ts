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
  resolveVirtualListScrollTopForWindow,
  scrollSegmentListIndexIntoView,
  scrollSegmentRowIntoViewContainer,
  SEGMENT_LIST_VIRTUAL_OVERSCAN,
  SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
  writeSegmentListFilterIndices,
} from "../../utils/segmentListVirtualWindow";
import type { SegmentListFilterNavState } from "../../utils/segmentListFilterNav";
import { selectionProfileTime, selectionProfileMarkListCommit } from "../../services/ui/selectionLatencyProfile";
import type { SegmentSelectSource } from "../../utils/waveformViewMode";

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
  lastSegmentSelectSourceRef?: React.MutableRefObject<SegmentSelectSource>;
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
  lastSegmentSelectSourceRef,
}: UseEditorSegmentListScrollArgs) {
  const scrollMetricsRef = useRef(readScrollMetrics(null));
  const [scrollEpoch, setScrollEpoch] = useState(0);
  const scrollEpochRafRef = useRef<number | null>(null);
  const lastSelectedScrollKeyRef = useRef<string | null>(null);
  const prevSelectedDisplayIndexRef = useRef(selectedDisplayIndex);
  const selectionScrollProjectionRef = useRef(false);
  const scrollGenerationRef = useRef(0);
  const suppressScrollGenerationBumpRef = useRef(false);
  const layoutScrollCorrectionRef = useRef<{ generation: number } | null>(null);

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

  const writeScrollTop = useCallback(
    (root: HTMLElement, scrollTop: number) => {
      suppressScrollGenerationBumpRef.current = true;
      root.scrollTop = scrollTop;
      suppressScrollGenerationBumpRef.current = false;
    },
    [],
  );

  const handleScroll = useCallback(() => {
    if (!suppressScrollGenerationBumpRef.current) {
      scrollGenerationRef.current += 1;
    }
    selectionScrollProjectionRef.current = false;
    bumpScrollEpoch();
  }, [bumpScrollEpoch]);

  if (prevSelectedDisplayIndexRef.current !== selectedDisplayIndex) {
    prevSelectedDisplayIndexRef.current = selectedDisplayIndex;
    const fromWaveform = lastSegmentSelectSourceRef?.current === "waveform";
    if (!fromWaveform) {
      selectionScrollProjectionRef.current = true;
      if (useVirtualList) {
        scrollMetricsRef.current = readScrollMetrics(segmentListRef.current);
      }
    } else {
      selectionScrollProjectionRef.current = false;
    }
  }

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

    if (lastSegmentSelectSourceRef?.current === "waveform") {
      selectionProfileMarkListCommit();
    }

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
      layoutScrollCorrectionRef.current = { generation: scrollGenerationRef.current };
      writeScrollTop(root, nextScrollTop);
      bumpScrollEpoch();
      window.requestAnimationFrame(() => {
        if (layoutScrollCorrectionRef.current?.generation !== scrollGenerationRef.current) {
          selectionScrollProjectionRef.current = false;
          return;
        }
        const corrected = selectionProfileTime("listScrollCorrect", () =>
          scrollSegmentRowIntoViewContainer(selectedIdx, root, { align: "minimal" }),
        );
        if (corrected == null) {
          selectionScrollProjectionRef.current = false;
          return;
        }
        if (Math.abs(corrected - root.scrollTop) < 1) {
          selectionScrollProjectionRef.current = false;
          return;
        }
        writeScrollTop(root, corrected);
        bumpScrollEpoch();
        selectionScrollProjectionRef.current = false;
      });
      return;
    }

    if (lastSegmentSelectSourceRef?.current === "waveform") {
      selectionScrollProjectionRef.current = false;
      return;
    }

    const corrected = selectionProfileTime("listScrollCorrect", () =>
      scrollSegmentRowIntoViewContainer(selectedIdx, root, { align: "minimal" }),
    );
    if (corrected == null) {
      selectionScrollProjectionRef.current = false;
      return;
    }
    if (Math.abs(corrected - root.scrollTop) < 1) {
      selectionScrollProjectionRef.current = false;
      return;
    }
    writeScrollTop(root, corrected);
    bumpScrollEpoch();
    selectionScrollProjectionRef.current = false;
  }, [
    bumpScrollEpoch,
    currentFileId,
    filteredIndicesScrollKey,
    itemStridePx,
    rowMinHeightPx,
    segmentListRef,
    selectedDisplayIndex,
    selectedIdx,
    writeScrollTop,
    lastSegmentSelectSourceRef,
  ]);

  useLayoutEffect(() => {
    lastSelectedScrollKeyRef.current = null;
    selectionScrollProjectionRef.current = false;
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
    const scrollMetrics = scrollMetricsRef.current;
    const root = segmentListRef.current;
    const scrollTop = resolveVirtualListScrollTopForWindow({
      rootScrollTop: root?.scrollTop ?? scrollMetrics.scrollTop,
      rootScrollHeight: root?.scrollHeight ?? 0,
      rootClientHeight: root?.clientHeight ?? 0,
      scrollMetrics,
      selectedDisplayIndex,
      rowMinHeightPx,
      itemStridePx,
      useSelectionProjection: selectionScrollProjectionRef.current,
    });
    const base = computeSegmentListVirtualWindow({
      scrollTop,
      viewportHeight: scrollMetrics.viewportHeight,
      itemStridePx,
      totalCount: displayCount,
      overscan: SEGMENT_LIST_VIRTUAL_OVERSCAN,
    });
    if (selectedDisplayIndex < 0) return base;
    if (
      lastSegmentSelectSourceRef?.current === "waveform" &&
      !selectionScrollProjectionRef.current
    ) {
      return base;
    }
    return maybePinSegmentListVirtualWindow(base, selectedDisplayIndex, displayCount, itemStridePx, {
      overscan: SEGMENT_LIST_VIRTUAL_OVERSCAN + 1,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- scrollEpoch intentionally triggers recomputation so virtualWindow reads the latest scrollMetricsRef
  }, [scrollEpoch, useVirtualList, itemStridePx, displayCount, selectedDisplayIndex]);

  return {
    useVirtualList,
    itemStridePx,
    handleScroll,
    virtualWindow,
  };
}
