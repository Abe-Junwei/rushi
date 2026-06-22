import { useCallback, useLayoutEffect, useRef, memo, type MouseEvent as ReactMouseEvent } from "react";
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
import { useSelectionChromePrimaryIdx } from "../../hooks/useSegmentRowSelection";

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

export const EditorSegmentList = memo(function EditorSegmentList({
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
  const chromePrimaryIdx = useSelectionChromePrimaryIdx();
  // Imperative chrome updates before React selectedIdx (startTransition); scroll/pin must follow chrome.
  const listScrollSegmentIdx =
    chromePrimaryIdx >= 0 ? chromePrimaryIdx : c.selectedIdx;
  const selectedDisplayIndex =
    listScrollSegmentIdx >= 0
      ? filterActive
        ? filteredIndices.indexOf(listScrollSegmentIdx)
        : listScrollSegmentIdx < displayCount
          ? listScrollSegmentIdx
          : -1
      : -1;

  const { useVirtualList, itemStridePx, handleScroll, virtualWindow } = useEditorSegmentListScroll({
    segmentListRef,
    filterNavRef,
    filteredIndices,
    filterActive,
    displayCount,
    selectedDisplayIndex,
    selectedIdx: listScrollSegmentIdx,
    currentFileId: c.currentFileId,
    transcriptRowHeightPx: tx.transcriptRowHeightPx,
    lastSegmentSelectSourceRef: tx.lastSegmentSelectSourceRef,
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
    filterActive && listScrollSegmentIdx >= 0 && selectedDisplayIndex < 0;

  return (
    <div
      ref={segmentListRef}
      {...{ [SEGMENT_LIST_SCROLL_ATTR]: "" }}
      className="h-0 min-h-0 flex-1 overflow-y-auto bg-notion-bg p-2.5 [contain:layout_paint]"
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
                  overflow: segIdx === chromePrimaryIdx ? "visible" : "hidden",
                  zIndex: segIdx === chromePrimaryIdx ? 1 : undefined,
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
}, areEditorSegmentListPropsEqual);

function areEditorSegmentListPropsEqual(
  prev: EditorSegmentListProps,
  next: EditorSegmentListProps,
): boolean {
  if (prev.controller.busy !== next.controller.busy) return false;
  if (prev.controller.currentFileId !== next.controller.currentFileId) return false;
  if (prev.controller.selectedIdx !== next.controller.selectedIdx) return false;
  if (prev.controller.selectionCount !== next.controller.selectionCount) return false;
  if (prev.controller.selectedIndicesArray !== next.controller.selectedIndicesArray) return false;
  if (prev.controller.segments !== next.controller.segments) return false;
  if (prev.controller.segments.length !== next.controller.segments.length) return false;
  if (prev.filteredIndices !== next.filteredIndices) return false;
  if (prev.filterActive !== next.filterActive) return false;
  if (prev.controller.findReplaceEditorHighlight !== next.controller.findReplaceEditorHighlight) {
    return false;
  }
  if (prev.controller.correctionRulesEditorHighlight !== next.controller.correctionRulesEditorHighlight) {
    return false;
  }
  if (prev.controller.updateSegmentText !== next.controller.updateSegmentText) return false;
  if (prev.controller.editorSpansForText !== next.controller.editorSpansForText) return false;
  if (prev.tx.transcriptFontPx !== next.tx.transcriptFontPx) return false;
  if (prev.tx.transcriptRowHeightPx !== next.tx.transcriptRowHeightPx) return false;
  if (prev.tx.selectSegmentFromList !== next.tx.selectSegmentFromList) return false;
  if (prev.tx.onSegmentTextareaKeyDown !== next.tx.onSegmentTextareaKeyDown) return false;
  if (prev.appearance !== next.appearance) return false;
  if (prev.onResetSegmentListFilter !== next.onResetSegmentListFilter) return false;
  if (prev.onOpenSegmentContextMenu !== next.onOpenSegmentContextMenu) return false;
  return true;
}
