import { memo } from "react";
import { ResizeBottomHit } from "../ResizeBottomHit";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import type { useEditorEditHistory } from "./useEditorEditHistory";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";
import { EditorSegmentList } from "./EditorSegmentList";
import { EditorSegmentToolbar } from "./EditorSegmentToolbar";

interface SegmentCtxMenuState {
  x: number;
  y: number;
  segmentIdx: number;
  pointerTimeSec: number;
}
type EditHistoryApi = ReturnType<typeof useEditorEditHistory>;
type AppearanceApi = ReturnType<typeof useEditorTranscriptAppearance>;
interface EditorSegmentWorkbenchProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  appearance: AppearanceApi;
  editHistory: EditHistoryApi;
  onOpenSegmentContextMenu: (menu: SegmentCtxMenuState) => void;
}
export const EditorSegmentWorkbench = memo(function EditorSegmentWorkbench({
  controller: c,
  tx,
  appearance: a,
  editHistory: h,
  onOpenSegmentContextMenu,
}: EditorSegmentWorkbenchProps) {
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-notion-bg">
      <EditorSegmentToolbar controller={c} tx={tx} appearance={a} editHistory={h} />
      <EditorSegmentList
        controller={c}
        tx={tx}
        appearance={a}
        listRef={tx.segmentListRef}
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
    prev.controller.selectedIdx === next.controller.selectedIdx &&
    prev.controller.currentFileId === next.controller.currentFileId &&
    prev.controller.segments === next.controller.segments &&
    prev.tx.transcriptFontPx === next.tx.transcriptFontPx &&
    prev.tx.transcriptRowHeightPx === next.tx.transcriptRowHeightPx &&
    prev.tx.beginTranscriptRowHeightDrag === next.tx.beginTranscriptRowHeightDrag &&
    prev.tx.selectSegmentAt === next.tx.selectSegmentAt &&
    prev.tx.onSegmentTextareaKeyDown === next.tx.onSegmentTextareaKeyDown &&
    prev.tx.segmentToolbar === next.tx.segmentToolbar &&
    prev.appearance === next.appearance &&
    prev.editHistory === next.editHistory &&
    prev.onOpenSegmentContextMenu === next.onOpenSegmentContextMenu
  );
}
