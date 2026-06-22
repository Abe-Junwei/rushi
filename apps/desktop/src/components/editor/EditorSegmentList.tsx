import { memo } from "react";
import type { SegmentContextMenuOpen } from "../../utils/segmentContextMenuModel";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import type { SegmentListFilterNavState } from "../../utils/segmentListFilterNav";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";
import { EditorSegmentListViewport } from "./EditorSegmentListViewport";

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

  return (
    <EditorSegmentListViewport
      controller={c}
      tx={tx}
      appearance={a}
      listRef={segmentListRef}
      filterNavRef={filterNavRef}
      filteredIndices={filteredIndices}
      filterActive={filterActive}
      displayCount={displayCount}
      onResetSegmentListFilter={onResetSegmentListFilter}
      onOpenSegmentContextMenu={onOpenSegmentContextMenu}
    />
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
