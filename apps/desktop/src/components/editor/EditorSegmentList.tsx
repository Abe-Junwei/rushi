import { useCallback, useLayoutEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { CspLayout } from "../CspLayout";
import type { SegmentContextMenuOpen } from "../../utils/segmentContextMenuModel";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import {
  SEGMENT_LIST_SCROLL_ATTR,
  segmentListVirtualRowTopPx,
} from "../../utils/segmentListVirtualWindow";
import { SegmentTextListRow } from "../SegmentTextListRow";
import { segmentHasUnsavedText } from "../../services/segmentConfirmEligible";
import type { SegmentListFilterNavState } from "../../utils/segmentListFilterNav";
import { blurActiveTranscriptTextarea } from "../../utils/transcriptSelection";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";
import { peekWelcomeSearchEditorHighlight } from "../../services/welcome/welcomeSearch";
import { useEditorSegmentListScroll } from "./useEditorSegmentListScroll";
import { logSegmentRowLayoutProbe } from "../../utils/releaseFrontendProbe";
import { CONTROL_BTN_LINK } from "../../config/controlStyles";

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
  onResetSegmentListFilter?: () => void;
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
  onResetSegmentListFilter,
  onOpenSegmentContextMenu,
}: EditorSegmentListProps) {
  const controllerRef = useRef(c);
  controllerRef.current = c;

  const displayCount = filteredIndices.length;
  const selectedDisplayIndex =
    c.selectedIdx >= 0
      ? filterActive
        ? filteredIndices.indexOf(c.selectedIdx)
        : c.selectedIdx < displayCount
          ? c.selectedIdx
          : -1
      : -1;

  const { useVirtualList, itemStridePx, handleScroll, virtualWindow } = useEditorSegmentListScroll({
    segmentListRef,
    filterNavRef,
    filteredIndices,
    filterActive,
    displayCount,
    selectedDisplayIndex,
    selectedIdx: c.selectedIdx,
    currentFileId: c.currentFileId,
    transcriptRowHeightPx: tx.transcriptRowHeightPx,
  });

  useLayoutEffect(() => {
    if (c.segments.length === 0) return;
    logSegmentRowLayoutProbe();
  }, [c.segments.length, displayCount]);

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

  const onOpenTextContextMenu = useCallback(
    (
      e: ReactMouseEvent<HTMLElement>,
      segmentIdx: number,
      pointerTimeSec: number,
      selectionText: string,
    ) => {
      onOpenRowContextMenu(e, segmentIdx, pointerTimeSec, selectionText);
    },
    [onOpenRowContextMenu],
  );

  const onCorrectableSpanClick = useCallback(
    (
      segmentIdx: number,
      span: Parameters<ProjectControllerApi["openEditorCorrectPopover"]>[1],
      event: ReactMouseEvent<HTMLButtonElement>,
    ) => {
      controllerRef.current.openEditorCorrectPopover(segmentIdx, span, event.clientX, event.clientY);
    },
    [],
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
        onOpenTextContextMenu={onOpenTextContextMenu}
        findReplaceHighlight={(() => {
          if (c.findReplaceEditorHighlight?.segmentIdx === segIdx) {
            return {
              charStart: c.findReplaceEditorHighlight.charStart,
              charEnd: c.findReplaceEditorHighlight.charEnd,
            };
          }
          const welcome = peekWelcomeSearchEditorHighlight(segIdx);
          if (welcome) {
            return { charStart: welcome.charStart, charEnd: welcome.charEnd };
          }
          return null;
        })()}
        correctionRulesHighlight={
          c.correctionRulesEditorHighlight?.segmentIdx === segIdx
            ? {
                charStart: c.correctionRulesEditorHighlight.charStart,
                charEnd: c.correctionRulesEditorHighlight.charEnd,
              }
            : null
        }
        spansForText={c.editorSpansForText}
        onCorrectableSpanClick={onCorrectableSpanClick}
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

  const showFilteredSelectedBanner =
    filterActive && c.selectedIdx >= 0 && selectedDisplayIndex < 0;

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
      {showFilteredSelectedBanner ? (
        <div className="sticky top-0 z-20 mb-2 flex items-center justify-between gap-3 rounded-md bg-notion-sidebar px-3 py-2 text-sm text-notion-text">
          <span>所选语段不在当前筛选结果中</span>
          {onResetSegmentListFilter ? (
            <button
              type="button"
              className={`shrink-0 ${CONTROL_BTN_LINK}`}
              onClick={onResetSegmentListFilter}
            >
              清除过滤并定位
            </button>
          ) : null}
        </div>
      ) : null}
      {useVirtualList ? (
        <CspLayout
          layout={{
            height: virtualWindow.totalHeightPx,
            position: "relative",
          }}
        >
          {visibleIndices.map((segIdx, offset) => {
            const displayIdx = virtualWindow.startIndex + offset;
            return (
              <CspLayout
                key={segIdx}
                className="segment-list-virtual-row-slot"
                layout={{
                  position: "absolute",
                  top: segmentListVirtualRowTopPx(displayIdx, itemStridePx),
                  left: 0,
                  right: 0,
                  height: itemStridePx,
                  overflow: segIdx === c.selectedIdx ? "visible" : "hidden",
                  zIndex: segIdx === c.selectedIdx ? 1 : undefined,
                  boxSizing: "border-box",
                }}
              >
                {renderSegmentRow(segIdx)}
              </CspLayout>
            );
          })}
        </CspLayout>
      ) : (
        <div className="space-y-2.5">{visibleIndices.map((segIdx) => renderSegmentRow(segIdx))}</div>
      )}
    </div>
  );
}
