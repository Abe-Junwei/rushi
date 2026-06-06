import type { ProjectControllerApi } from "../../pages/useProjectController";
import { EditorSegmentTranscribeActions } from "./EditorSegmentToolbarActions";

interface EditorSegmentToolbarProps {
  controller: ProjectControllerApi;
}

/** @deprecated 请使用 EditorWorkbenchToolbar；保留供独立语段动作条场景。 */
export function EditorSegmentToolbar({ controller: c }: EditorSegmentToolbarProps) {
  return (
    <div className="waveform-bottom-toolbar editor-workbench-toolbar">
      <div className="waveform-bottom-toolbar-track editor-workbench-toolbar-track">
        <div className="workbench-toolbar-left" aria-hidden />
        <div className="workbench-toolbar-center">
          <EditorSegmentTranscribeActions controller={c} />
        </div>
        <div className="workbench-toolbar-right" aria-hidden />
      </div>
    </div>
  );
}

export {
  EditorSegmentEditActions,
  EditorSegmentTranscribeActions,
  EditorSegmentToolbarActions,
} from "./EditorSegmentToolbarActions";
