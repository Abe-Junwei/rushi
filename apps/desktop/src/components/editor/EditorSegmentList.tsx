import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { SegmentContextMenuOpen } from "../../utils/segmentContextMenuModel";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import {
  annotateSegmentListScrollMetrics,
  computeSegmentListVirtualWindow,
  maybePinSegmentListVirtualWindow,
  scrollSegmentListIndexIntoView,
  scrollSegmentRowIntoViewContainer,
  SEGMENT_LIST_SCROLL_ATTR,
  SEGMENT_LIST_VIRTUAL_OVERSCAN,
  SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
  writeSegmentListFilterIndices,
} from "../../utils/segmentListVirtualWindow";
import { LIST_ADVANCE_PLAY_COALESCE_MS } from "../../utils/scheduleListAdvanceSegmentPlayback";
import { SegmentTextListRow } from "../SegmentTextListRow";
import { segmentHasUnsavedText } from "../../services/segmentConfirmEligible";
import type { SegmentListFilterNavState } from "../../utils/segmentListFilterNav";
import { blurActiveTranscriptTextarea } from "../../utils/transcriptSelection";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";

type SegmentCtxMenuState = SegmentContextMenuOpen;

type AppearanceApi = ReturnType<typeof useEditorTranscriptAppearance>;

/** clientHeight 尚未量到时的保守视口，避免 0 导致整表挂载 */
const SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX = 480;

interface EditorSegmentListProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  appearance: AppearanceApi;
  listRef: React.RefObject<HTMLDivElement | null>;
  filterNavRef: React.MutableRefObject<SegmentListFilterNavState>;
  filteredIndices: number[];
  filterActive: boolean;
  onOpenSegmentContextMenu: (menu: SegmentCtxMenuState) => void;
}

function readScrollMetrics(root: HTMLElement | null): { scrollTop: number; viewportHeight: number } {
  if (!root) {
    return { scrollTop: 0, viewportHeight: SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX };
  }
  return {
    scrollTop: root.scrollTop,
    viewportHeight: root.clientHeight > 0 ? root.clientHeight : SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX,
  };
}

export function EditorSegmentList({
  controller: c,
  tx,
  appearance: a,
  listRef: segmentListRef,
  filterNavRef,
  filteredIndices,
  filterActive,
  onOpenSegmentContextMenu,
}: EditorSegmentListProps) {
  const scrollMetricsRef = useRef(readScrollMetrics(null));
  const [scrollEpoch, setScrollEpoch] = useState(0);
  const scrollEpochRafRef = useRef<number | null>(null);
  const lastSelectedScrollKeyRef = useRef<string | null>(null);
  const pendingSelectedScrollKeyRef = useRef<string | null>(null);
  const pendingSelectedScrollIdxRef = useRef<number>(-1);
  const pendingSelectedDisplayIndexRef = useRef<number>(-1);
  const selectedScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rowMinHeightPx = segmentListRowMinHeightPx(tx.transcriptRowHeightPx);
  const itemStridePx = segmentListItemStridePx(rowMinHeightPx);
  const displayCount = filteredIndices.length;
  const useVirtualList = displayCount >= SEGMENT_LIST_VIRTUALIZE_MIN_COUNT;
  const selectedDisplayIndex =
    c.selectedIdx >= 0
      ? filterActive
        ? filteredIndices.indexOf(c.selectedIdx)
        : c.selectedIdx < displayCount
          ? c.selectedIdx
          : -1
      : -1;
  const filteredIndicesScrollKey = useMemo(() => {
    const first = filteredIndices[0] ?? -1;
    const last = filteredIndices[filteredIndices.length - 1] ?? -1;
    // Keep this O(1): rapid ↑↓ selection runs this path for every row change.
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

    const scrollKey = `${c.currentFileId ?? ""}:${c.selectedIdx}:${selectedDisplayIndex}:${filteredIndicesScrollKey}`;
    if (lastSelectedScrollKeyRef.current === scrollKey) return;
    pendingSelectedScrollKeyRef.current = scrollKey;
    pendingSelectedScrollIdxRef.current = c.selectedIdx;
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
    c.currentFileId,
    c.selectedIdx,
    displayCount,
    filteredIndicesScrollKey,
    itemStridePx,
    rowMinHeightPx,
    segmentListRef,
    selectedDisplayIndex,
  ]);

  useLayoutEffect(() => {
    lastSelectedScrollKeyRef.current = null;
  }, [c.currentFileId]);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    filterNavRef.current = { active: filterActive, indices: filteredIndices };
    if (!root) return;
    writeSegmentListFilterIndices(root, filteredIndices, filterActive);
  }, [filterActive, filteredIndices, filterNavRef, segmentListRef]);

  const onOpenRowContextMenu = useCallback(
    (
      e: ReactMouseEvent<HTMLElement>,
      segmentIdx: number,
      pointerTimeSec: number,
      selectionText = "",
    ) => {
      if (c.busy) return;
      e.preventDefault();
      e.stopPropagation();
      blurActiveTranscriptTextarea();
      onOpenSegmentContextMenu({
        x: e.clientX,
        y: e.clientY,
        segmentIdx,
        pointerTimeSec,
        origin: "segmentList",
        selectionText,
      });
    },
    [c.busy, onOpenSegmentContextMenu],
  );

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

  const savedSnapshot = c.getSavedSnapshot();

  const renderSegmentRow = (segIdx: number) => {
    const s = c.segments[segIdx];
    if (!s) return null;
    return (
      <SegmentTextListRow
        key={s.uid ? `${s.uid}#${segIdx}` : `seg-${segIdx}`}
        segment={s}
        index={segIdx}
        selected={segIdx === c.selectedIdx}
        inSelection={tx.isIndexInSelection(segIdx) && segIdx !== c.selectedIdx}
        busy={c.busy}
        transcriptFontPx={tx.transcriptFontPx}
        segmentRowHeightPx={tx.transcriptRowHeightPx}
        transcriptFontFamily={a.transcriptFontFamily}
        transcriptFontWeight={a.transcriptFontWeight}
        transcriptFontItalic={a.transcriptFontItalic}
        segmentMetaWidthPx={a.transcriptMetaWidthPx}
        onSegmentMetaWidthPointerDown={a.beginTranscriptMetaWidthDrag}
        onSegmentRowHeightPointerDown={tx.beginTranscriptRowHeightDrag}
        selectSegmentAt={tx.selectSegmentFromList}
        onTimestampPointerDown={tx.onTimestampPointerDown}
        onRowRangePointerDown={tx.onSegmentListRangePointerDown}
        consumeRowRangeClickSuppress={tx.consumeSegmentListRangeClickSuppress}
        updateSegmentText={c.updateSegmentText}
        onTextareaKeyDown={tx.onSegmentTextareaKeyDown}
        onOpenContextMenu={onOpenRowContextMenu}
        onOpenTextContextMenu={(e, selectionText) =>
          onOpenRowContextMenu(e, segIdx, (s.start_sec + s.end_sec) / 2, selectionText)
        }
        onRevealSelectedSegment={tx.revealSelectedSegmentInViewport}
        findReplaceHighlight={
          c.findReplaceEditorHighlight?.segmentIdx === segIdx
            ? {
                charStart: c.findReplaceEditorHighlight.charStart,
                charEnd: c.findReplaceEditorHighlight.charEnd,
              }
            : null
        }
        correctionRulesHighlight={
          c.correctionRulesEditorHighlight?.segmentIdx === segIdx
            ? {
                charStart: c.correctionRulesEditorHighlight.charStart,
                charEnd: c.correctionRulesEditorHighlight.charEnd,
              }
            : null
        }
        spansForText={c.editorSpansForText}
        onCorrectableSpanClick={(span, event) =>
          c.openEditorCorrectPopover(segIdx, span, event.clientX, event.clientY)
        }
        hasUnsavedDraft={segmentHasUnsavedText(c.segments, savedSnapshot, segIdx)}
        onOpenAnnotation={c.openSegmentAnnotationDialog}
      />
    );
  };

  if (c.segments.length === 0) {
    return (
      <div className="flex h-0 min-h-0 flex-1 items-center justify-center px-6 text-[14px] leading-relaxed text-notion-text-muted">
        尚未有语段：请先点击「自动转录」。
      </div>
    );
  }

  if (displayCount === 0) {
    return (
      <div
        ref={segmentListRef}
        className="flex h-0 min-h-0 flex-1 items-center justify-center px-6 text-[14px] leading-relaxed text-notion-text-muted"
      >
        无匹配语段。
      </div>
    );
  }

  const visibleIndices = useVirtualList
    ? filteredIndices.slice(virtualWindow.startIndex, virtualWindow.endIndex)
    : filteredIndices;

  return (
    <div
      ref={segmentListRef}
      {...{ [SEGMENT_LIST_SCROLL_ATTR]: "" }}
      className="h-0 min-h-0 flex-1 overflow-y-auto bg-notion-bg p-2.5"
      role="list"
      aria-label="语段文本列表"
      onScroll={handleScroll}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-seg-row]")) return;
        if (c.isMultiSegmentSelection) c.clearMultiSelection();
      }}
    >
      {useVirtualList ? (
        <div
          style={{
            height: virtualWindow.totalHeightPx,
            position: "relative",
          }}
        >
          <div
            className="will-change-transform"
            style={{
              transform: `translate3d(0, ${virtualWindow.paddingTopPx}px, 0)`,
            }}
          >
            {visibleIndices.map((segIdx) => renderSegmentRow(segIdx))}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">{visibleIndices.map((segIdx) => renderSegmentRow(segIdx))}</div>
      )}
    </div>
  );
};
