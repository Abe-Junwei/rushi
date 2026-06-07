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
  ensureSegmentListVirtualWindowIncludesIndex,
  scrollSegmentListIndexIntoView,
  scrollSegmentRowIntoViewContainer,
  SEGMENT_LIST_SCROLL_ATTR,
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
} from "../../utils/segmentListVirtualWindow";
import { SegmentTextListRow } from "../SegmentTextListRow";
import { segmentHasUnsavedText } from "../../services/segmentConfirmEligible";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";

type SegmentCtxMenuState = SegmentContextMenuOpen;

type AppearanceApi = ReturnType<typeof useEditorTranscriptAppearance>;

/** clientHeight 尚未量到时的保守视口，避免 0 导致整表挂载 */
const SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX = 480;

/** 低于此规模直接全量渲染，避免虚拟窗口与 flex 滚动偶发不同步 */
const SEGMENT_LIST_VIRTUALIZE_MIN_COUNT = 900;

interface EditorSegmentListProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  appearance: AppearanceApi;
  listRef: React.RefObject<HTMLDivElement | null>;
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
  onOpenSegmentContextMenu,
}: EditorSegmentListProps) {
  const scrollMetricsRef = useRef(readScrollMetrics(null));
  const [scrollEpoch, setScrollEpoch] = useState(0);

  const rowMinHeightPx = segmentListRowMinHeightPx(tx.transcriptRowHeightPx);
  const itemStridePx = segmentListItemStridePx(rowMinHeightPx);
  const useVirtualList = c.segments.length >= SEGMENT_LIST_VIRTUALIZE_MIN_COUNT;

  const bumpScrollEpoch = useCallback(() => {
    const next = readScrollMetrics(segmentListRef.current);
    const prev = scrollMetricsRef.current;
    scrollMetricsRef.current = next;
    if (prev.scrollTop !== next.scrollTop || prev.viewportHeight !== next.viewportHeight) {
      setScrollEpoch((n) => n + 1);
    }
  }, [segmentListRef]);

  const handleScroll = useCallback(() => {
    bumpScrollEpoch();
  }, [bumpScrollEpoch]);

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
      observer.disconnect();
    };
  }, [bumpScrollEpoch, itemStridePx, rowMinHeightPx, segmentListRef, c.segments.length, useVirtualList]);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    if (!root || c.selectedIdx < 0) return;
    const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
    const nextScrollTop = scrollSegmentListIndexIntoView({
      scrollTop: root.scrollTop,
      viewportHeight: root.clientHeight,
      index: c.selectedIdx,
      rowMinHeightPx,
      itemStridePx,
      align: "center",
      maxScrollTop,
    });
    if (nextScrollTop != null) {
      root.scrollTop = nextScrollTop;
      bumpScrollEpoch();
    }
  }, [bumpScrollEpoch, c.currentFileId, c.selectedIdx, itemStridePx, rowMinHeightPx, segmentListRef]);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    if (!root || c.selectedIdx < 0) return;
    const raf = window.requestAnimationFrame(() => {
      const corrected = scrollSegmentRowIntoViewContainer(c.selectedIdx, root, { align: "center" });
      if (corrected == null) return;
      if (Math.abs(corrected - root.scrollTop) < 1) return;
      root.scrollTop = corrected;
      bumpScrollEpoch();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [bumpScrollEpoch, c.selectedIdx, segmentListRef]);

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
        endIndex: c.segments.length,
        paddingTopPx: 0,
        paddingBottomPx: 0,
        totalHeightPx: 0,
      };
    }
    const { scrollTop, viewportHeight } = scrollMetricsRef.current;
    let win = computeSegmentListVirtualWindow({
      scrollTop,
      viewportHeight,
      itemStridePx,
      totalCount: c.segments.length,
    });
    const pinIndices = [
      c.selectedIdx,
      c.findReplaceEditorHighlight?.segmentIdx ?? -1,
      c.correctionRulesEditorHighlight?.segmentIdx ?? -1,
    ];
    for (const idx of pinIndices) {
      if (idx >= 0) {
        win = ensureSegmentListVirtualWindowIncludesIndex(win, idx, c.segments.length, itemStridePx);
      }
    }
    return win;
  }, [
    scrollEpoch,
    useVirtualList,
    itemStridePx,
    c.segments.length,
    c.selectedIdx,
    c.findReplaceEditorHighlight?.segmentIdx,
    c.correctionRulesEditorHighlight?.segmentIdx,
  ]);

  const savedSnapshot = c.getSavedSnapshot();

  const renderSegmentRow = (s: (typeof c.segments)[number], i: number) => (
    <SegmentTextListRow
      key={s.uid ? `${s.uid}#${i}` : `seg-${i}`}
      segment={s}
      index={i}
      selected={i === c.selectedIdx}
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
      updateSegmentText={c.updateSegmentText}
      onTextareaKeyDown={tx.onSegmentTextareaKeyDown}
      onOpenContextMenu={onOpenRowContextMenu}
      onOpenTextContextMenu={(e, selectionText) =>
        onOpenRowContextMenu(e, i, (s.start_sec + s.end_sec) / 2, selectionText)
      }
      onRevealSelectedSegment={tx.revealSelectedSegmentInViewport}
      findReplaceHighlight={
        c.findReplaceEditorHighlight?.segmentIdx === i
          ? {
              charStart: c.findReplaceEditorHighlight.charStart,
              charEnd: c.findReplaceEditorHighlight.charEnd,
            }
          : null
      }
      correctionRulesHighlight={
        c.correctionRulesEditorHighlight?.segmentIdx === i
          ? {
              charStart: c.correctionRulesEditorHighlight.charStart,
              charEnd: c.correctionRulesEditorHighlight.charEnd,
            }
          : null
      }
      spansForText={c.editorSpansForText}
      onCorrectableSpanClick={(span, event) =>
        c.openEditorCorrectPopover(i, span, event.clientX, event.clientY)
      }
      hasUnsavedDraft={segmentHasUnsavedText(c.segments, savedSnapshot, i)}
    />
  );

  if (c.segments.length === 0) {
    return (
      <div className="flex h-0 min-h-0 flex-1 items-center justify-center px-6 text-[14px] leading-relaxed text-notion-text-muted">
        尚未有语段：请先点击「自动转录」。
      </div>
    );
  }

  const visibleSegments = useVirtualList
    ? c.segments.slice(virtualWindow.startIndex, virtualWindow.endIndex)
    : c.segments;

  return (
    <div
      ref={segmentListRef}
      {...{ [SEGMENT_LIST_SCROLL_ATTR]: "" }}
      className="h-0 min-h-0 flex-1 overflow-y-auto bg-notion-bg p-2.5"
      role="list"
      aria-label="语段文本列表"
      onScroll={handleScroll}
    >
      {useVirtualList ? (
        <div
          style={{
            height: virtualWindow.totalHeightPx,
            paddingTop: virtualWindow.paddingTopPx,
            paddingBottom: virtualWindow.paddingBottomPx,
            boxSizing: "border-box",
          }}
        >
          {visibleSegments.map((s, offset) => renderSegmentRow(s, virtualWindow.startIndex + offset))}
        </div>
      ) : (
        <div className="space-y-2.5">{visibleSegments.map((s, i) => renderSegmentRow(s, i))}</div>
      )}
    </div>
  );
}
