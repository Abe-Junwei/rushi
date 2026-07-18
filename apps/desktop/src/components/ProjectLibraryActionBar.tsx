import {
  IconFileMusic as FileAudio,
  IconFileText as FileText,
  IconListNumbers as ListOrdered,
} from "@tabler/icons-react";
import { CONTROL_BTN_WORKSPACE_IMPORT } from "../config/controlStyles";
import { WELCOME_LEDGER_NESTED_FILE_INSET_X } from "../config/workspaceShellLayout";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type Props = {
  controller: ProjectControllerApi;
  projectId: string;
  busy: boolean;
};

/** 确保项目为 current 后执行（导入 / 批量 / 元数据依赖 c.current）。 */
export async function ensureLibraryProjectActive(
  c: ProjectControllerApi,
  projectId: string,
): Promise<boolean> {
  if (c.busy) return false;
  if (c.current?.id === projectId) return true;
  try {
    await c.loadProject(projectId);
    return true;
  } catch (e) {
    c.setError(e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * 「所有文件」展开区动作条 — 自 Hub 导入区 / 顶栏迁入。
 */
export function ProjectLibraryActionBar({ controller: c, projectId, busy }: Props) {
  const isCurrent = c.current?.id === projectId;
  const batchCount = isCurrent ? c.batchTranscribableCount : 0;
  const canBatch = isCurrent && c.canStartBatchTranscribe;

  const runImportAudio = async () => {
    if (!(await ensureLibraryProjectActive(c, projectId))) return;
    try {
      await c.pickAndImportAudioPathsToProject();
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runImportText = async () => {
    if (!(await ensureLibraryProjectActive(c, projectId))) return;
    try {
      await c.pickAndImportFileToProject("text");
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runBatch = async () => {
    if (!(await ensureLibraryProjectActive(c, projectId))) return;
    await c.startBatchTranscribe();
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1 py-1.5 ${WELCOME_LEDGER_NESTED_FILE_INSET_X}`}
      aria-label="项目操作"
      data-purpose="project-library-action-bar"
    >
      <button
        type="button"
        className={CONTROL_BTN_WORKSPACE_IMPORT}
        disabled={busy}
        onClick={() => void runImportAudio()}
      >
        <FileAudio className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        导入音频
      </button>
      <button
        type="button"
        className={CONTROL_BTN_WORKSPACE_IMPORT}
        disabled={busy}
        onClick={() => void runImportText()}
      >
        <FileText className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        导入转录文本
      </button>
      <button
        type="button"
        className={CONTROL_BTN_WORKSPACE_IMPORT}
        disabled={busy || (isCurrent && !canBatch)}
        title={
          isCurrent && batchCount === 0
            ? "项目中暂无可转写音频"
            : "按顺序转写项目内全部音频"
        }
        onClick={() => void runBatch()}
      >
        <ListOrdered className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        批量转写
        {isCurrent && batchCount > 0 ? ` (${batchCount})` : ""}
      </button>
    </div>
  );
}
