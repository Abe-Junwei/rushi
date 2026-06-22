import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  annotateSegmentListScrollMetrics,
  scrollSegmentRowIntoViewContainer,
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
  SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
  writeSegmentListFilterIndices,
} from "../../utils/segmentListVirtualWindow";
import type { SegmentListFilterNavState } from "../../utils/segmentListFilterNav";
import { selectionProfileMarkListCommit, selectionProfileTime } from "../../services/ui/selectionLatencyProfile";
import type { SegmentSelectSource } from "../../utils/waveformViewMode";
import { shouldSkipListScrollWhenInViewport } from "../../utils/waveformViewMode";
import { computeEditorSegmentListVirtualWindow } from "./computeEditorSegmentListVirtualWindow";
import {
  editorSegmentListScrollMetricsEqual,
  readEditorSegmentListScrollMetrics,
} from "./editorSegmentListScrollMetrics";
import { planEditorSegmentListSelectionScroll } from "./planEditorSegmentListSelectionScroll";

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
  const scrollMetricsRef = useRef(readEditorSegmentListScrollMetrics(segmentListRef.current));
  const [scrollEpoch, setScrollEpoch] = useState(0);
  const scrollEpochRafRef = useRef<number | null>(null);
  const lastSelectedScrollKeyRef = useRef<string | null>(null);
  const prevSelectedDisplayIndexForProjectionRef = useRef(selectedDisplayIndex);
  const selectionScrollProjectionRef = useRef(false);
  const scrollGenerationRef = useRef(0);
  const suppressScrollGenerationBumpRef = useRef(false);
  const layoutScrollCorrectionRef = useRef<{ generation: number } | null>(null);
  const listScrollCorrectionRafRef = useRef<number | null>(null);

  const cancelPendingListScrollCorrection = useCallback(() => {
    if (listScrollCorrectionRafRef.current != null) {
      window.cancelAnimationFrame(listScrollCorrectionRafRef.current);
      listScrollCorrectionRafRef.current = null;
    }
    layoutScrollCorrectionRef.current = null;
  }, []);

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
    (options?: { force?: boolean; sync?: boolean }) => {
      const next = readEditorSegmentListScrollMetrics(segmentListRef.current);
      const prev = scrollMetricsRef.current;
      const changed = !editorSegmentListScrollMetricsEqual(next, prev);
      scrollMetricsRef.current = next;
      if (!useVirtualList) return;
      if (!options?.force && !changed) return;
      if (options?.sync) {
        setScrollEpoch((n) => n + 1);
        return;
      }
      scheduleScrollEpochBump();
    },
    [scheduleScrollEpochBump, segmentListRef, useVirtualList],
  );

  const writeScrollTop = useCallback((root: HTMLElement, scrollTop: number) => {
    suppressScrollGenerationBumpRef.current = true;
    root.scrollTop = scrollTop;
    suppressScrollGenerationBumpRef.current = false;
  }, []);

  const handleScroll = useCallback(() => {
    if (!suppressScrollGenerationBumpRef.current) {
      scrollGenerationRef.current += 1;
    }
    selectionScrollProjectionRef.current = false;
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
      cancelPendingListScrollCorrection();
      if (scrollEpochRafRef.current != null) {
        window.cancelAnimationFrame(scrollEpochRafRef.current);
        scrollEpochRafRef.current = null;
      }
      observer.disconnect();
    };
  }, [
    bumpScrollEpoch,
    cancelPendingListScrollCorrection,
    itemStridePx,
    rowMinHeightPx,
    segmentListRef,
    displayCount,
    useVirtualList,
  ]);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    if (!root || selectedDisplayIndex < 0) return;

    const scrollKey = `${currentFileId ?? ""}:${selectedIdx}:${selectedDisplayIndex}:${filteredIndicesScrollKey}`;
    if (lastSelectedScrollKeyRef.current === scrollKey) return;
    lastSelectedScrollKeyRef.current = scrollKey;
    cancelPendingListScrollCorrection();

    const source = lastSegmentSelectSourceRef?.current;
    const fromWaveform = shouldSkipListScrollWhenInViewport(source ?? "waveform");

    if (fromWaveform) {
      selectionProfileMarkListCommit();
    }

    const plan = selectionProfileTime("listScroll", () =>
      planEditorSegmentListSelectionScroll({
        root,
        selectedDisplayIndex,
        selectedIdx,
        rowMinHeightPx,
        itemStridePx,
        useVirtualList,
        source,
      }),
    );

    if (plan.kind === "skip") {
      selectionScrollProjectionRef.current = false;
      return;
    }

    if (plan.kind === "fallback-dom-correct") {
      const corrected = selectionProfileTime("listScrollCorrect", () =>
        scrollSegmentRowIntoViewContainer(selectedIdx, root, { align: "minimal" }),
      );
      if (corrected == null || Math.abs(corrected - root.scrollTop) < 1) {
        selectionScrollProjectionRef.current = false;
        return;
      }
      writeScrollTop(root, corrected);
      bumpScrollEpoch();
      selectionScrollProjectionRef.current = false;
      return;
    }

    layoutScrollCorrectionRef.current = { generation: scrollGenerationRef.current };
    writeScrollTop(root, plan.nextScrollTop);
    bumpScrollEpoch({ sync: plan.syncEpoch, force: plan.syncEpoch });

    if (plan.skipDomCorrection) {
      selectionScrollProjectionRef.current = false;
      return;
    }

    cancelPendingListScrollCorrection();
    listScrollCorrectionRafRef.current = window.requestAnimationFrame(() => {
      listScrollCorrectionRafRef.current = null;
      if (layoutScrollCorrectionRef.current?.generation !== scrollGenerationRef.current) {
        selectionScrollProjectionRef.current = false;
        return;
      }
      const corrected = selectionProfileTime("listScrollCorrect", () =>
        scrollSegmentRowIntoViewContainer(selectedIdx, root, { align: "minimal" }),
      );
      if (corrected == null) {
        selectionScrollProjectionRef.current = false;
        layoutScrollCorrectionRef.current = null;
        return;
      }
      if (Math.abs(corrected - root.scrollTop) < 1) {
        selectionScrollProjectionRef.current = false;
        layoutScrollCorrectionRef.current = null;
        return;
      }
      writeScrollTop(root, corrected);
      bumpScrollEpoch();
      selectionScrollProjectionRef.current = false;
      layoutScrollCorrectionRef.current = null;
    });
  }, [
    bumpScrollEpoch,
    cancelPendingListScrollCorrection,
    currentFileId,
    filteredIndicesScrollKey,
    itemStridePx,
    rowMinHeightPx,
    segmentListRef,
    selectedDisplayIndex,
    selectedIdx,
    useVirtualList,
    writeScrollTop,
    lastSegmentSelectSourceRef,
  ]);

  useLayoutEffect(() => {
    lastSelectedScrollKeyRef.current = null;
    selectionScrollProjectionRef.current = false;
    prevSelectedDisplayIndexForProjectionRef.current = -1;
    cancelPendingListScrollCorrection();
  }, [cancelPendingListScrollCorrection, currentFileId]);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    filterNavRef.current = { active: filterActive, indices: filteredIndices };
    if (!root) return;
    writeSegmentListFilterIndices(root, filteredIndices, filterActive);
  }, [filterActive, filteredIndices, filterNavRef, segmentListRef]);

  const virtualWindow = useMemo(
    () =>
      computeEditorSegmentListVirtualWindow({
        segmentListRoot: segmentListRef.current,
        scrollMetricsRef,
        selectionScrollProjectionRef,
        prevSelectedDisplayIndexRef: prevSelectedDisplayIndexForProjectionRef,
        selectedDisplayIndex,
        displayCount,
        itemStridePx,
        rowMinHeightPx,
        useVirtualList,
        source: lastSegmentSelectSourceRef?.current,
      }),
    // selectedDisplayIndex drives projection/pin on list path; scrollEpoch forces recompute after user scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      scrollEpoch,
      useVirtualList,
      itemStridePx,
      displayCount,
      selectedDisplayIndex,
      rowMinHeightPx,
      segmentListRef,
      lastSegmentSelectSourceRef,
    ],
  );

  return {
    useVirtualList,
    itemStridePx,
    handleScroll,
    virtualWindow,
  };
}
