import { FileAudio, FileText, ListOrdered } from "lucide-react";
import { CONTROL_BTN_WORKSPACE_IMPORT } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import type { ProjectControllerApi } from "../pages/useProjectController";

const HUB_IMPORT_ACTION_BTN = CONTROL_BTN_WORKSPACE_IMPORT;

type Props = {
  controller: ProjectControllerApi;
  busy: boolean;
};

export function ProjectFilesHubImportSection({ controller: c, busy }: Props) {
  const runImportAudio = async () => {
    if (!c.current || busy) return;
    try {
      await c.pickAndImportAudioPathsToProject();
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runImportText = async () => {
    if (!c.current || busy) return;
    try {
      await c.pickAndImportFileToProject("text");
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="flex flex-col gap-2 pt-1" aria-label="继续导入">
      <p className={`${PANEL_TYPOGRAPHY.fieldLabel} text-notion-text-muted`}>继续导入</p>
      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          className={`${HUB_IMPORT_ACTION_BTN} w-full justify-start sm:w-auto`}
          disabled={busy}
          onClick={() => void runImportAudio()}
        >
          <FileAudio
            className={LUCIDE_ICON_SIZE_MD}
            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
            aria-hidden
          />
          导入音频
        </button>
        <button
          type="button"
          className={`${HUB_IMPORT_ACTION_BTN} w-full justify-start sm:w-auto`}
          disabled={busy}
          onClick={() => void runImportText()}
        >
          <FileText
            className={LUCIDE_ICON_SIZE_MD}
            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
            aria-hidden
          />
          导入转录文本
        </button>
        <button
          type="button"
          className={`${HUB_IMPORT_ACTION_BTN} w-full justify-start sm:w-auto`}
          disabled={busy || !c.canStartBatchTranscribe}
          title={
            c.batchTranscribableCount === 0
              ? "项目中暂无可转写音频"
              : "按顺序转写项目内全部音频"
          }
          onClick={() => void c.startBatchTranscribe()}
        >
          <ListOrdered
            className={LUCIDE_ICON_SIZE_MD}
            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
            aria-hidden
          />
          批量转写
          {c.batchTranscribableCount > 0 ? ` (${c.batchTranscribableCount})` : ""}
        </button>
      </div>
    </section>
  );
}
