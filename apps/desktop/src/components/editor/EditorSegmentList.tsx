import { useCallback, type MouseEvent as ReactMouseEvent } from "react";
import type { SegmentContextMenuOpen } from "../../utils/segmentContextMenuModel";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import { SEGMENT_LIST_SCROLL_ATTR } from "../../utils/segmentListVirtualWindow";
import { SegmentTextListRow } from "../SegmentTextListRow";
import { segmentHasUnsavedText } from "../../services/segmentConfirmEligible";
import type { SegmentListFilterNavState } from "../../utils/segmentListFilterNav";
import { blurActiveTranscriptTextarea } from "../../utils/transcriptSelection";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";
import { useEditorSegmentListScroll } from "./useEditorSegmentListScroll";

type SegmentCtxMenuState = SegmentContextMenuOpen;

type AppearanceApi = ReturnType<typeof useEditorTranscriptAppearance>;

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
  const displayCount = filteredIndices.length;
  const selectedDisplayIndex =
    c.selectedIdx >= 0
      ? filterActive
        ? filteredIndices.indexOf(c.selectedIdx)
        : c.selectedIdx < displayCount
          ? c.selectedIdx
          : -1
      : -1;

  const { useVirtualList, handleScroll, virtualWindow } = useEditorSegmentListScroll({
    segmentListRef,
    filterNavRef,
    filteredIndices,
    filterActive,
    displayCount,
    selectedDisplayIndex,
    selectedIdx: c.selectedIdx,
    currentFileId: c.currentFileId,
    transcriptRowHeightPx: tx.transcriptRowHeightPx,
    lastSegmentSelectSourceRef: tx.lastSegmentSelectSourceRef,
  });

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
      <div className="flex h-0 min-h-0 flex-1 items-center justify-center px-6 text-title leading-relaxed text-notion-text-muted">
        尚未有语段：请先点击「自动转录」。
      </div>
    );
  }

  if (displayCount === 0) {
    return (
      <div
        ref={segmentListRef}
        className="flex h-0 min-h-0 flex-1 items-center justify-center px-6 text-title leading-relaxed text-notion-text-muted"
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
}
