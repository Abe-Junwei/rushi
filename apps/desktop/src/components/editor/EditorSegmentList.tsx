import { memo, useEffect } from "react";
import type { SegmentContextMenuOpen } from "../../utils/segmentContextMenuModel";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import {
  isSegmentListFilterHidingPrimary,
  type SegmentListFilterNavState,
} from "../../utils/segmentListFilterNav";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";
import { TranscriptEditorCore } from "./core/TranscriptEditorCore";
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
  const displayCount = filteredIndices.length;

  useEffect(() => {
    filterNavRef.current = { active: filterActive, indices: filteredIndices };
  }, [filterActive, filteredIndices, filterNavRef]);

  if (c.segments.length === 0) {
    return (
      <div className="flex h-0 min-h-0 flex-1 items-center justify-center px-6 text-title leading-relaxed text-notion-text-muted">
        尚未有语段：请先点击「自动转录」。
      </div>
    );
  }

  if (filterActive && displayCount === 0) {
    return (
      <div
        ref={segmentListRef}
        className="flex h-0 min-h-0 flex-1 items-center justify-center px-6 text-title leading-relaxed text-notion-text-muted"
      >
        无匹配语段。
      </div>
    );
  }

  const panelHighlight =
    c.findReplaceEditorHighlight ?? c.correctionRulesEditorHighlight ?? null;
  const showFilteredSelectedBanner = isSegmentListFilterHidingPrimary({
    filterActive,
    filteredIndices,
    primaryIdx: c.selectedIdx,
    segmentCount: c.segments.length,
  });

  return (
    <div className="relative flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
      {showFilteredSelectedBanner ? (
        <div className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-notion-border bg-notion-sidebar px-3 py-2 text-sm text-notion-text">
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
      <TranscriptEditorCore
        segments={c.segments}
        fileId={c.currentFileId}
        initialPrimaryIdxRef={c.selectedIdxRef}
        busy={c.busy}
        fontPx={tx.transcriptFontPx}
        fontFamily={a.transcriptFontFamily}
        fontWeight={a.transcriptFontWeight}
        fontItalic={a.transcriptFontItalic}
        transcriptMetaWidthPx={a.transcriptMetaWidthPx}
        onMetaWidthPointerDown={a.beginTranscriptMetaWidthDrag}
        updateSegmentText={c.updateSegmentText}
        panelHighlight={panelHighlight}
        filterActive={filterActive}
        filteredIndices={filteredIndices}
        listRef={segmentListRef}
        onOpenContextMenu={({ x, y, segmentIdx, pointerTimeSec, selectionText }) => {
          onOpenSegmentContextMenu({
            x,
            y,
            segmentIdx,
            pointerTimeSec,
            origin: "segmentList",
            selectionText,
          });
        }}
        onSelectSegment={(idx, opts) => {
          tx.selectSegmentFromList(idx, {
            shiftKey: opts?.shiftKey,
            toggle: opts?.toggle,
          });
        }}
        isSelectedSegmentPlaying={tx.isSelectedSegmentPlaying}
        onToggleSegmentPlay={(idx) => {
          if (tx.isSelectedSegmentPlaying && c.selectedIdx === idx) {
            void tx.handleToggleSelectedWaveformPlay();
            return;
          }
          if (c.selectedIdx !== idx) {
            tx.selectSegmentFromList(idx);
          }
          void tx.playSegmentAtIndex(idx);
        }}
      />
    </div>
  );
}, areEditorSegmentListPropsEqual);

function areEditorSegmentListPropsEqual(
  prev: EditorSegmentListProps,
  next: EditorSegmentListProps,
): boolean {
  if (prev.controller.busy !== next.controller.busy) return false;
  if (prev.controller.currentFileId !== next.controller.currentFileId) return false;
  if (prev.controller.segments !== next.controller.segments) return false;
  if (prev.controller.segments.length !== next.controller.segments.length) return false;
  if (prev.controller.selectedIdx !== next.controller.selectedIdx) return false;
  if (prev.filteredIndices !== next.filteredIndices) return false;
  if (prev.filterActive !== next.filterActive) return false;
  if (prev.controller.findReplaceEditorHighlight !== next.controller.findReplaceEditorHighlight) {
    return false;
  }
  if (prev.controller.correctionRulesEditorHighlight !== next.controller.correctionRulesEditorHighlight) {
    return false;
  }
  if (prev.controller.updateSegmentText !== next.controller.updateSegmentText) return false;
  if (prev.tx.transcriptFontPx !== next.tx.transcriptFontPx) return false;
  if (prev.appearance.transcriptMetaWidthPx !== next.appearance.transcriptMetaWidthPx) return false;
  if (prev.appearance.transcriptFontFamily !== next.appearance.transcriptFontFamily) return false;
  if (prev.appearance.transcriptFontWeight !== next.appearance.transcriptFontWeight) return false;
  if (prev.appearance.transcriptFontItalic !== next.appearance.transcriptFontItalic) return false;
  if (prev.tx.selectSegmentFromList !== next.tx.selectSegmentFromList) return false;
  if (prev.tx.isSelectedSegmentPlaying !== next.tx.isSelectedSegmentPlaying) return false;
  if (prev.tx.handleToggleSelectedWaveformPlay !== next.tx.handleToggleSelectedWaveformPlay) {
    return false;
  }
  if (prev.tx.playSegmentAtIndex !== next.tx.playSegmentAtIndex) return false;
  if (prev.appearance !== next.appearance) return false;
  if (prev.onResetSegmentListFilter !== next.onResetSegmentListFilter) return false;
  if (prev.onOpenSegmentContextMenu !== next.onOpenSegmentContextMenu) return false;
  return true;
}
