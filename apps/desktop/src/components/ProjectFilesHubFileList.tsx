import { Pencil, Trash2 } from "lucide-react";
import { CONTROL_BTN_LINK, CONTROL_BTN_ICON_GHOST } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { WORKSPACE_FILE_ROW_CLASS } from "../config/workspaceShellLayout";
import { WorkspaceFileRow } from "./WorkspaceFileRow";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { formatProjectFileType, formatWorkspaceFileTime } from "../utils/projectFileDisplay";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { FileSummary } from "../tauri/projectTypes";

const HUB_FILE_ACTION_BTN = `${CONTROL_BTN_ICON_GHOST} text-notion-text-light opacity-0 transition-[color,background-color,opacity] group-hover:opacity-100 group-focus-visible:opacity-100 hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40`;

type Props = {
  controller: ProjectControllerApi;
  files: FileSummary[];
  highlightFileId: string | null;
  busy: boolean;
};

export function ProjectFilesHubFileList({ controller: c, files, highlightFileId, busy }: Props) {
  return (
    <section className="flex flex-col gap-2" aria-label="项目文件">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title font-medium text-notion-text-muted">项目文件</h2>
        <span className={`${PANEL_TYPOGRAPHY.meta} tabular-nums text-notion-text-muted`}>
          {files.length} 个文件
        </span>
      </div>

      <ul className="list-none space-y-1">
        {files.map((f) => {
          const isRenaming = c.renamingProjectFileId === f.id;

          return (
            <li key={f.id} data-hub-file-id={f.id}>
              {isRenaming ? (
                <form
                  className={`${WORKSPACE_FILE_ROW_CLASS} gap-2 px-2.5 py-2`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    c.commitRenameProjectFile();
                  }}
                >
                  <input
                    type="text"
                    className="min-w-0 flex-1 rounded-sm border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
                    value={c.renameProjectFileDraft}
                    disabled={busy}
                    autoFocus
                    onChange={(e) => c.setRenameProjectFileDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") c.cancelRenameProjectFile();
                    }}
                  />
                  <button
                    type="submit"
                    className={`${CONTROL_BTN_LINK} shrink-0 text-label text-accent-action`}
                    disabled={busy || !c.renameProjectFileDraft.trim()}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className={`${CONTROL_BTN_LINK} shrink-0 text-label text-notion-text-muted`}
                    disabled={busy}
                    onClick={() => c.cancelRenameProjectFile()}
                  >
                    取消
                  </button>
                </form>
              ) : (
                <WorkspaceFileRow
                  name={f.name}
                  meta={`${formatProjectFileType(f.file_type)} · ${formatWorkspaceFileTime(f.updated_at_ms)}`}
                  busy={busy}
                  selected={highlightFileId === f.id}
                  onOpen={() => void c.openFile(f.id)}
                  actionSlot={
                    <>
                      <button
                        type="button"
                        className={HUB_FILE_ACTION_BTN}
                        disabled={busy}
                        aria-label={`重命名 ${f.name}`}
                        onClick={() => c.beginRenameProjectFile(f.id, f.name)}
                      >
                        <Pencil
                          className={LUCIDE_ICON_SIZE_MD}
                          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                          aria-hidden
                        />
                      </button>
                      <button
                        type="button"
                        className={`${HUB_FILE_ACTION_BTN} hover:text-zen-cinnabar`}
                        disabled={busy}
                        aria-label={`删除 ${f.name}`}
                        onClick={() => c.requestDeleteProjectFile(f.id, f.name)}
                      >
                        <Trash2
                          className={LUCIDE_ICON_SIZE_MD}
                          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                          aria-hidden
                        />
                      </button>
                    </>
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
