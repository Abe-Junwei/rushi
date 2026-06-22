import { memo } from "react";
import { ResizeBottomHit } from "../ResizeBottomHit";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";
import type { SegmentContextMenuOpen } from "../../utils/segmentContextMenuModel";
import { EditorSegmentList } from "./EditorSegmentList";

type AppearanceApi = ReturnType<typeof useEditorTranscriptAppearance>;
interface EditorSegmentWorkbenchProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  appearance: AppearanceApi;
  filteredIndices: number[];
  filterActive: boolean;
  onResetSegmentListFilter?: () => void;
  onOpenSegmentContextMenu: (menu: SegmentContextMenuOpen) => void;
}
export const EditorSegmentWorkbench = memo(function EditorSegmentWorkbench({
  controller: c,
  tx,
  appearance: a,
  filteredIndices,
  filterActive,
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
        onResetSegmentListFilter={onResetSegmentListFilter}
        onOpenSegmentContextMenu={onOpenSegmentContextMenu}
      />
      <ResizeBottomHit
        busy={c.busy}
        ariaLabel="上下拖动调节语段高度（字号联动）"
        onPointerDown={tx.beginTranscriptRowHeightDrag}
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
    prev.onResetSegmentListFilter === next.onResetSegmentListFilter &&
    prev.controller.findReplaceEditorHighlight === next.controller.findReplaceEditorHighlight &&
    prev.controller.correctionRulesEditorHighlight === next.controller.correctionRulesEditorHighlight &&
    prev.controller.updateSegmentText === next.controller.updateSegmentText &&
    prev.controller.editorSpansForText === next.controller.editorSpansForText &&
    prev.tx.transcriptFontPx === next.tx.transcriptFontPx &&
    prev.tx.transcriptRowHeightPx === next.tx.transcriptRowHeightPx &&
    prev.tx.beginTranscriptRowHeightDrag === next.tx.beginTranscriptRowHeightDrag &&
    prev.tx.selectSegmentAt === next.tx.selectSegmentAt &&
    prev.tx.onSegmentTextareaKeyDown === next.tx.onSegmentTextareaKeyDown &&
    prev.appearance === next.appearance &&
    prev.onOpenSegmentContextMenu === next.onOpenSegmentContextMenu
  );
}
