import { useMemo } from "react";
import { FileAudio, FileText, NotebookText, Pencil, Trash2 } from "lucide-react";
import { CONTROL_BTN_GHOST, CONTROL_BTN_LINK } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { WORKSPACE_FILE_ROW_CLASS, WORKSPACE_PAGE_PANEL_CLASS } from "../config/workspaceShellLayout";
import { WorkspaceFileRow } from "./WorkspaceFileRow";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { FileSummary } from "../tauri/projectTypes";
import { formatProjectFileType, formatProjectHubMetadataLine, formatWorkspaceFileTime } from "../utils/projectFileDisplay";
import { findDuplicateProjectNames, suggestUniqueProjectName } from "../utils/projectDuplicateName";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const HUB_ICON_BTN =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border-0 bg-transparent text-notion-text-light transition-[color,background-color] hover:bg-notion-sidebar-hover hover:text-notion-text disabled:cursor-not-allowed disabled:opacity-40";

const HUB_FILE_ACTION_BTN =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border-0 bg-transparent text-notion-text-light opacity-0 transition-[color,background-color,opacity] group-hover:opacity-100 group-focus-visible:opacity-100 hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40";

const HUB_IMPORT_ACTION_BTN = `${CONTROL_BTN_GHOST} h-7 min-h-[28px] gap-1.5 px-2 text-[12px] font-medium`;

function sortFilesNewestFirst(files: FileSummary[]): FileSummary[] {
  return [...files].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
}

export function ProjectFilesHubPanel({ controller: c }: { controller: ProjectControllerApi }) {
  const files = useMemo(
    () => sortFilesNewestFirst(c.current?.files ?? []),
    [c.current?.files],
  );
  const projectName = c.current?.name ?? "当前项目";
  const projectMetadataLine = useMemo(
    () =>
      formatProjectHubMetadataLine({
        recorded_at: c.current?.recorded_at,
        subject: c.current?.subject,
        narrator: c.current?.narrator,
      }),
    [c.current?.recorded_at, c.current?.subject, c.current?.narrator],
  );
  const busy = c.busy;
  const projectId = c.current?.id;
  const renameDuplicates = useMemo(
    () =>
      c.isRenamingProject
        ? findDuplicateProjectNames(c.projects, c.renameProjectDraft, projectId)
        : [],
    [c.isRenamingProject, c.projects, c.renameProjectDraft, projectId],
  );
  const runImport = async (kind: "audio" | "text") => {
    if (!c.current || busy) return;
    try {
      await c.pickAndImportFileToProject(kind);
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section
      className={`${WORKSPACE_PAGE_PANEL_CLASS} gap-6`}
      aria-label={`${projectName} 工作区`}
      data-purpose="project-files-hub-page"
    >
          <header className="relative">
            {c.isRenamingProject ? (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void c.commitRenameProject();
                }}
              >
                <input
                  type="text"
                  className="w-full rounded-sm border border-notion-border bg-notion-bg px-3 py-2 text-lg font-semibold text-notion-text"
                  value={c.renameProjectDraft}
                  disabled={busy}
                  autoFocus
                  onChange={(e) => c.setRenameProjectDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") c.cancelRenameProject();
                  }}
                />
                {renameDuplicates.length > 0 ? (
                  <p className={`${PANEL_TYPOGRAPHY.meta} text-zen-saffron`}>
                    已有同名项目「{renameDuplicates[0].name}」。仍可保存，或改用
                    <button
                      type="button"
                      className={`${CONTROL_BTN_LINK} ml-1 text-zen-saffron`}
                      disabled={busy}
                      onClick={() =>
                        c.setRenameProjectDraft(
                          suggestUniqueProjectName(c.projects, c.renameProjectDraft),
                        )
                      }
                    >
                      {suggestUniqueProjectName(c.projects, c.renameProjectDraft)}
                    </button>
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className={`${CONTROL_BTN_LINK} text-zen-saffron`}
                    disabled={busy || !c.renameProjectDraft.trim()}
                  >
                    保存名称
                  </button>
                  <button
                    type="button"
                    className={`${CONTROL_BTN_LINK} text-notion-text-muted`}
                    disabled={busy}
                    onClick={() => c.cancelRenameProject()}
                  >
                    取消
                  </button>
                </div>
              </form>
            ) : (
              <div className="relative flex items-start">
                <div className="min-w-0 flex-1 pr-16">
                  <h1 className="truncate text-[28px] font-semibold leading-[1.25] tracking-[-0.015em] text-notion-text">
                    {projectName}
                  </h1>
                  {projectMetadataLine ? (
                    <p
                      className={`mt-1 truncate ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}
                      title={projectMetadataLine}
                    >
                      {projectMetadataLine}
                    </p>
                  ) : null}
                </div>
                <div className="absolute right-0 top-0 flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={HUB_ICON_BTN}
                    disabled={busy}
                    aria-label="项目信息"
                    onClick={() => c.openProjectMetadataDialog()}
                  >
                    <NotebookText
                      className={LUCIDE_ICON_SIZE_MD}
                      strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                      aria-hidden
                    />
                  </button>
                  {projectId ? (
                    <button
                      type="button"
                      className={`${HUB_ICON_BTN} hover:text-zen-cinnabar`}
                      disabled={busy}
                      aria-label="删除项目"
                      onClick={() => c.requestDeleteProject(projectId, projectName)}
                    >
                      <Trash2 className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </header>

          <section className="flex flex-col gap-2" aria-label="项目文件">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium text-notion-text-muted">项目文件</h2>
              <span className={`${PANEL_TYPOGRAPHY.meta} tabular-nums text-notion-text-muted`}>
                {files.length} 个文件
              </span>
            </div>

            <ul className="list-none space-y-1">
              {files.map((f) => {
                const isRenaming = c.renamingProjectFileId === f.id;

                return (
                  <li key={f.id}>
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
                          className={`${CONTROL_BTN_LINK} shrink-0 text-[11px] text-zen-saffron`}
                          disabled={busy || !c.renameProjectFileDraft.trim()}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          className={`${CONTROL_BTN_LINK} shrink-0 text-[11px] text-notion-text-muted`}
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
                              <Pencil className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={`${HUB_FILE_ACTION_BTN} hover:text-zen-cinnabar`}
                              disabled={busy}
                              aria-label={`删除 ${f.name}`}
                              onClick={() => c.requestDeleteProjectFile(f.id, f.name)}
                            >
                              <Trash2 className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
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

          <section className="flex flex-col gap-2 pt-1" aria-label="继续导入">
            <p className={`${PANEL_TYPOGRAPHY.fieldLabel} text-notion-text-muted`}>
              继续导入
            </p>
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                className={`${HUB_IMPORT_ACTION_BTN} w-full justify-start sm:w-auto`}
                disabled={busy}
                onClick={() => void runImport("audio")}
              >
                <FileAudio className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                导入音频
              </button>
              <button
                type="button"
                className={`${HUB_IMPORT_ACTION_BTN} w-full justify-start sm:w-auto`}
                disabled={busy}
                onClick={() => void runImport("text")}
              >
                <FileText className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                导入转录文本
              </button>
            </div>
          </section>
        </section>
  );
}
