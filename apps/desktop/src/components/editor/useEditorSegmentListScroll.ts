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
import {
  clearListKeyboardImperativeScrollKey,
  clearListKeyboardVirtualDisplayPin,
  notifyListKeyboardLayoutSettled,
  registerListKeyboardScrollEpochNotifier,
  resetListKeyboardBurstScrollState,
  shouldSkipLayoutScrollForListKeyboard,
} from "../../services/selection/listKeyboardBurstCoordinator";
import { buildListKeyboardScrollKey } from "../../utils/listKeyboardListScrollIndex";
import type { SegmentSelectSource } from "../../utils/waveformViewMode";
import { shouldSkipListScrollWhenInViewport } from "../../utils/waveformViewMode";
import { computeEditorSegmentListVirtualWindow } from "./computeEditorSegmentListVirtualWindow";
import {
  editorSegmentListScrollMetricsEqual,
  readEditorSegmentListScrollMetrics,
} from "./editorSegmentListScrollMetrics";
import {
  isListKeyboardSelectSource,
  planEditorSegmentListSelectionScroll,
} from "./planEditorSegmentListSelectionScroll";

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
  const [selectSourceEpoch, setSelectSourceEpoch] = useState(0);
  const prevSelectSourceRef = useRef<SegmentSelectSource | undefined>(undefined);
  const scrollEpochRafRef = useRef<number | null>(null);
  const lastSelectedScrollKeyRef = useRef<string | null>(null);
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

  const selectedDisplayIndexRef = useRef(selectedDisplayIndex);
  selectedDisplayIndexRef.current = selectedDisplayIndex;

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

  useLayoutEffect(() => {
    registerListKeyboardScrollEpochNotifier(bumpScrollEpoch);
    return () => registerListKeyboardScrollEpochNotifier(null);
  }, [bumpScrollEpoch]);

  const writeScrollTop = useCallback((root: HTMLElement, scrollTop: number) => {
    suppressScrollGenerationBumpRef.current = true;
    root.scrollTop = scrollTop;
    suppressScrollGenerationBumpRef.current = false;
  }, []);

  const handleScroll = useCallback(() => {
    if (!suppressScrollGenerationBumpRef.current) {
      scrollGenerationRef.current += 1;
    }
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
    const source = lastSegmentSelectSourceRef?.current;
    if (source !== prevSelectSourceRef.current) {
      prevSelectSourceRef.current = source;
      setSelectSourceEpoch((n) => n + 1);
    }
  });

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    if (!root || selectedDisplayIndex < 0) return;

    const scrollKey = buildListKeyboardScrollKey({
      fileId: currentFileId,
      selectedIdx,
      selectedDisplayIndex,
      filteredIndicesScrollKey,
    });
    const source = lastSegmentSelectSourceRef?.current;
    const fromListKeyboard = isListKeyboardSelectSource(source);
    const fromWaveform = shouldSkipListScrollWhenInViewport(source ?? "waveform");
    const maybeNotifyListKeyboardLayoutSettled = () => {
      if (fromListKeyboard) {
        notifyListKeyboardLayoutSettled(scrollKey);
      }
    };

    if (lastSelectedScrollKeyRef.current === scrollKey) {
      if (fromWaveform) {
        selectionProfileMarkListCommit();
      }
      maybeNotifyListKeyboardLayoutSettled();
      return;
    }

    if (fromListKeyboard && shouldSkipLayoutScrollForListKeyboard(scrollKey)) {
      lastSelectedScrollKeyRef.current = scrollKey;
      clearListKeyboardImperativeScrollKey();
      clearListKeyboardVirtualDisplayPin();
      maybeNotifyListKeyboardLayoutSettled();
      return;
    }

    if (shouldSkipLayoutScrollForListKeyboard(scrollKey)) {
      lastSelectedScrollKeyRef.current = scrollKey;
      maybeNotifyListKeyboardLayoutSettled();
      return;
    }

    lastSelectedScrollKeyRef.current = scrollKey;
    cancelPendingListScrollCorrection();

    if (fromWaveform) {
      selectionProfileMarkListCommit();
    }
    if (fromListKeyboard) {
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
      maybeNotifyListKeyboardLayoutSettled();
      return;
    }

    if (plan.kind === "fallback-dom-correct") {
      const corrected = selectionProfileTime("listScrollCorrect", () =>
        scrollSegmentRowIntoViewContainer(selectedIdx, root, {
          align: fromWaveform ? "center" : "minimal",
        }),
      );
      if (corrected == null || Math.abs(corrected - root.scrollTop) < 1) {
        maybeNotifyListKeyboardLayoutSettled();
        return;
      }
      writeScrollTop(root, corrected);
      bumpScrollEpoch();
      maybeNotifyListKeyboardLayoutSettled();
      return;
    }

    layoutScrollCorrectionRef.current = { generation: scrollGenerationRef.current };
    const scrollTopBefore = root.scrollTop;
    writeScrollTop(root, plan.nextScrollTop);
    const scrollChanged = Math.abs(root.scrollTop - scrollTopBefore) >= 1;

    scrollMetricsRef.current = readEditorSegmentListScrollMetrics(root);

    if (scrollChanged) {
      if (fromListKeyboard && scrollEpochRafRef.current != null) {
        window.cancelAnimationFrame(scrollEpochRafRef.current);
        scrollEpochRafRef.current = null;
      }
      bumpScrollEpoch({ sync: true, force: true });
    }

    if (plan.skipDomCorrection) {
      maybeNotifyListKeyboardLayoutSettled();
      return;
    }

    cancelPendingListScrollCorrection();
    listScrollCorrectionRafRef.current = window.requestAnimationFrame(() => {
      listScrollCorrectionRafRef.current = null;
      if (layoutScrollCorrectionRef.current?.generation !== scrollGenerationRef.current) {
        return;
      }
      const corrected = selectionProfileTime("listScrollCorrect", () =>
        scrollSegmentRowIntoViewContainer(selectedIdx, root, {
          align: fromWaveform ? "center" : "minimal",
        }),
      );
      if (corrected == null) {
        layoutScrollCorrectionRef.current = null;
        return;
      }
      if (Math.abs(corrected - root.scrollTop) < 1) {
        layoutScrollCorrectionRef.current = null;
        return;
      }
      writeScrollTop(root, corrected);
      bumpScrollEpoch();
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
    cancelPendingListScrollCorrection();
    resetListKeyboardBurstScrollState();
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
        selectedDisplayIndex: selectedDisplayIndexRef.current,
        displayCount,
        itemStridePx,
        useVirtualList,
        source: lastSegmentSelectSourceRef?.current,
      }),
    [
      scrollEpoch,
      selectSourceEpoch,
      useVirtualList,
      itemStridePx,
      displayCount,
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
