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
export function EditorSegmentWorkbench({
  controller: c,
  tx,
  appearance: a,
  editHistory: h,
  onOpenSegmentContextMenu,
}: EditorSegmentWorkbenchProps) {
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-notion-bg">
      <EditorSegmentToolbar controller={c} tx={tx} appearance={a} editHistory={h} />
      <EditorSegmentList controller={c} tx={tx} appearance={a} onOpenSegmentContextMenu={onOpenSegmentContextMenu} />
      <ResizeBottomHit
        busy={c.busy}
        ariaLabel="上下拖动调节语段高度（字号联动）"
        onPointerDown={tx.beginTranscriptRowHeightDrag}
      />
    </div>
  );
}
