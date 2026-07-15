import { memo } from "react";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";
import type { SegmentContextMenuOpen } from "../../utils/segmentContextMenuModel";
import type { SegmentListFilterState } from "../../services/segmentListFilter";
import { EditorSegmentList } from "./EditorSegmentList";

type AppearanceApi = ReturnType<typeof useEditorTranscriptAppearance>;
interface EditorSegmentWorkbenchProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  appearance: AppearanceApi;
  filteredIndices: number[];
  filterActive: boolean;
  filterCriteria?: SegmentListFilterState | null;
  visibleIndexSet?: ReadonlySet<number> | null;
  displayPositionByIndex?: ReadonlyMap<number, number> | null;
  onResetSegmentListFilter?: () => void;
  onOpenSegmentContextMenu: (menu: SegmentContextMenuOpen) => void;
}
export const EditorSegmentWorkbench = memo(function EditorSegmentWorkbench({
  controller: c,
  tx,
  appearance: a,
  filteredIndices,
  filterActive,
  filterCriteria = null,
  visibleIndexSet = null,
  displayPositionByIndex = null,
  onResetSegmentListFilter,
  onOpenSegmentContextMenu,
}: EditorSegmentWorkbenchProps) {
  return (
    <div className="flex h-0 min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-notion-bg">
      <EditorSegmentList
        controller={c}
        tx={tx}
        appearance={a}
        listRef={tx.segmentListRef}
        filterNavRef={tx.segmentListFilterNavRef}
        filteredIndices={filteredIndices}
        filterActive={filterActive}
        filterCriteria={filterCriteria}
        visibleIndexSet={visibleIndexSet}
        displayPositionByIndex={displayPositionByIndex}
        onResetSegmentListFilter={onResetSegmentListFilter}
        onOpenSegmentContextMenu={onOpenSegmentContextMenu}
      />
    </div>
  );
}, areEditorSegmentWorkbenchPropsEqual);

function areEditorSegmentWorkbenchPropsEqual(
  prev: EditorSegmentWorkbenchProps,
  next: EditorSegmentWorkbenchProps,
) {
  return (
    prev.controller.busy === next.controller.busy &&
    prev.controller.currentFileId === next.controller.currentFileId &&
    prev.controller.segments === next.controller.segments &&
    prev.controller.segments.length === next.controller.segments.length &&
    prev.filteredIndices === next.filteredIndices &&
    prev.filterActive === next.filterActive &&
    prev.filterCriteria === next.filterCriteria &&
    prev.visibleIndexSet === next.visibleIndexSet &&
    prev.displayPositionByIndex === next.displayPositionByIndex &&
    prev.onResetSegmentListFilter === next.onResetSegmentListFilter &&
    prev.controller.findReplaceEditorHighlight === next.controller.findReplaceEditorHighlight &&
    prev.controller.correctionRulesEditorHighlight === next.controller.correctionRulesEditorHighlight &&
    prev.controller.updateSegmentText === next.controller.updateSegmentText &&
    prev.controller.editorSpansForText === next.controller.editorSpansForText &&
    prev.tx.transcriptFontPx === next.tx.transcriptFontPx &&
    prev.tx.transcriptRowHeightPx === next.tx.transcriptRowHeightPx &&
    prev.appearance === next.appearance &&
    prev.onOpenSegmentContextMenu === next.onOpenSegmentContextMenu
  );
}
