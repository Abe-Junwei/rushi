import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { SegmentContextMenuOpen } from "../../utils/segmentContextMenuModel";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import {
  computeSegmentListVirtualWindow,
  scrollSegmentListIndexIntoView,
  scrollSegmentRowIntoViewContainer,
  SEGMENT_LIST_SCROLL_ATTR,
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
} from "../../utils/segmentListVirtualWindow";
import { SegmentTextListRow } from "../SegmentTextListRow";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";

type SegmentCtxMenuState = SegmentContextMenuOpen;

type AppearanceApi = ReturnType<typeof useEditorTranscriptAppearance>;

interface EditorSegmentListProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  appearance: AppearanceApi;
  listRef: React.RefObject<HTMLDivElement | null>;
  onOpenSegmentContextMenu: (menu: SegmentCtxMenuState) => void;
  onOpenSegmentTextContextMenu: (
    e: ReactMouseEvent<HTMLTextAreaElement>,
    selectionText: string,
  ) => void;
}

export function EditorSegmentList({
  controller: c,
  tx,
  appearance: a,
  listRef: segmentListRef,
  onOpenSegmentContextMenu,
  onOpenSegmentTextContextMenu,
}: EditorSegmentListProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const rowMinHeightPx = segmentListRowMinHeightPx(tx.transcriptRowHeightPx);
  const itemStridePx = segmentListItemStridePx(rowMinHeightPx);

  const syncScrollMetrics = useCallback(() => {
    const root = segmentListRef.current;
    if (!root) return;
    setScrollTop(root.scrollTop);
    setViewportHeight(root.clientHeight);
  }, [segmentListRef]);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    if (!root) return;
    syncScrollMetrics();
    root.addEventListener("scroll", syncScrollMetrics, { passive: true });
    const observer = new ResizeObserver(syncScrollMetrics);
    observer.observe(root);
    return () => {
      root.removeEventListener("scroll", syncScrollMetrics);
      observer.disconnect();
    };
  }, [segmentListRef, syncScrollMetrics, c.segments.length]);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    if (!root || c.selectedIdx < 0) return;
    const nextScrollTop = scrollSegmentListIndexIntoView({
      scrollTop: root.scrollTop,
      viewportHeight: root.clientHeight,
      index: c.selectedIdx,
      rowMinHeightPx,
      itemStridePx,
    });
    if (nextScrollTop != null) {
      root.scrollTop = nextScrollTop;
      setScrollTop(nextScrollTop);
    }
  }, [c.currentFileId, c.selectedIdx, itemStridePx, rowMinHeightPx, segmentListRef]);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    if (!root || c.selectedIdx < 0) return;
    const raf = window.requestAnimationFrame(() => {
      const corrected = scrollSegmentRowIntoViewContainer(c.selectedIdx, root);
      if (corrected == null) return;
      if (Math.abs(corrected - root.scrollTop) < 1) return;
      root.scrollTop = corrected;
      setScrollTop(corrected);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [c.selectedIdx, segmentListRef]);

  const onOpenRowContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>, segmentIdx: number, pointerTimeSec: number) => {
      if (c.busy) return;
      e.preventDefault();
      e.stopPropagation();
      onOpenSegmentContextMenu({
        x: e.clientX,
        y: e.clientY,
        segmentIdx,
        pointerTimeSec,
        origin: "segmentList",
      });
    },
    [c.busy, onOpenSegmentContextMenu],
  );

  const virtualWindow = useMemo(
    () =>
      computeSegmentListVirtualWindow({
        scrollTop,
        viewportHeight,
        itemStridePx,
        totalCount: c.segments.length,
      }),
    [scrollTop, viewportHeight, itemStridePx, c.segments.length],
  );

  if (c.segments.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-[14px] leading-relaxed text-notion-text-muted">
        尚未有语段：请先「从 ASR 拉取语段」。
      </div>
    );
  }

  const visibleSegments = c.segments.slice(virtualWindow.startIndex, virtualWindow.endIndex);

  return (
    <div
      ref={segmentListRef}
      {...{ [SEGMENT_LIST_SCROLL_ATTR]: "" }}
      className="min-h-0 flex-1 overflow-y-auto bg-notion-bg p-2.5"
      role="list"
      aria-label="语段文本列表"
    >
      <div
        style={{
          paddingTop: virtualWindow.paddingTopPx,
          paddingBottom: virtualWindow.paddingBottomPx,
          minHeight: virtualWindow.totalHeightPx,
        }}
      >
        {visibleSegments.map((s, offset) => {
          const i = virtualWindow.startIndex + offset;
          return (
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
              findReplaceHighlight={
                c.findReplaceEditorHighlight?.segmentIdx === i ? c.findReplaceEditorHighlight : null
              }
              onOpenTextContextMenu={onOpenSegmentTextContextMenu}
              spansForText={c.editorSpansForText}
              onCorrectableSpanClick={(span, event) =>
                c.openEditorCorrectPopover(i, span, event.clientX, event.clientY)
              }
            />
          );
        })}
      </div>
    </div>
  );
}
