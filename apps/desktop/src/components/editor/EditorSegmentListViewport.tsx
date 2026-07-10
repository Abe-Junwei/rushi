import { useCallback, useLayoutEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from "react";
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
import { useReconcileSelectionChromeFromReact } from "../../hooks/useReconcileSelectionChromeFromReact";

type SegmentCtxMenuState = SegmentContextMenuOpen;

type AppearanceApi = ReturnType<typeof useEditorTranscriptAppearance>;

export type EditorSegmentListViewportProps = {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  appearance: AppearanceApi;
  listRef: React.RefObject<HTMLDivElement | null>;
  filterNavRef: React.MutableRefObject<SegmentListFilterNavState>;
  filteredIndices: number[];
  filterActive: boolean;
  displayCount: number;
  onResetSegmentListFilter?: () => void;
  onOpenSegmentContextMenu: (menu: SegmentCtxMenuState) => void;
};

/**
 * List viewport. Selection chrome is row-subscribed (useSegmentRowSelection);
 * do not subscribe chrome primary here — that re-renders the whole list on SC2 (U12).
 * Scroll backup uses SC1 selectedIdx; pointerdown already ran imperative scroll.
 */
export function EditorSegmentListViewport({
  controller: c,
  tx,
  appearance: a,
  listRef: segmentListRef,
  filterNavRef,
  filteredIndices,
  filterActive,
  displayCount,
  onResetSegmentListFilter,
  onOpenSegmentContextMenu,
}: EditorSegmentListViewportProps) {
  const controllerRef = useRef(c);
  controllerRef.current = c;

  const listScrollSegmentIdx = c.selectedIdx;
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

  useReconcileSelectionChromeFromReact({
    controller: c,
    segmentListRef,
    tierScrollRef: tx.tierScrollRef,
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

  const rowEditorHighlights = useMemo(() => {
    const findReplace = c.findReplaceEditorHighlight;
    const correction = c.correctionRulesEditorHighlight;
    return {
      findReplaceSegIdx: findReplace?.segmentIdx ?? -1,
      findReplaceRange: findReplace
        ? { charStart: findReplace.charStart, charEnd: findReplace.charEnd }
        : null,
      correctionSegIdx: correction?.segmentIdx ?? -1,
      correctionRange: correction
        ? { charStart: correction.charStart, charEnd: correction.charEnd }
        : null,
    };
  }, [c.correctionRulesEditorHighlight, c.findReplaceEditorHighlight]);

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
        findReplaceHighlight={
          rowEditorHighlights.findReplaceSegIdx === segIdx
            ? rowEditorHighlights.findReplaceRange
            : (() => {
                const welcome = peekWelcomeSearchEditorHighlight(segIdx);
                return welcome
                  ? { charStart: welcome.charStart, charEnd: welcome.charEnd }
                  : null;
              })()
        }
        correctionRulesHighlight={
          rowEditorHighlights.correctionSegIdx === segIdx
            ? rowEditorHighlights.correctionRange
            : null
        }
        spansForText={c.editorSpansForText}
        onCorrectableSpanClick={onCorrectableSpanClick}
        hasUnsavedDraft={segmentHasUnsavedText(c.segments, savedSnapshot, segIdx)}
        onOpenAnnotation={c.openSegmentAnnotationDialog}
      />
    );
  };

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
