import { useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  IconChevronRight as ChevronRight,
  IconFolderOpen as FolderOpen,
} from "@tabler/icons-react";
import { CONTROL_BTN_LINK } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { WORKSPACE_SIDEBAR_EMPTY_HINT_BTN, WORKSPACE_SIDEBAR_ROW_SURFACE } from "../config/workspaceShellLayout";
import { useSidebarFileProjectDrag } from "../hooks/useSidebarFileProjectDrag";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { ProjectSummary } from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import { formatProjectFileType, formatWorkspaceFileTime } from "../utils/projectFileDisplay";
import {
  buildProjectContextMenuItems,
  buildProjectFileContextMenuItems,
  isProjectContextMenuKey,
  isProjectFileContextMenuKey,
  parseCopyDestProjectId,
  parseMoveDestProjectId,
} from "../utils/projectWorkspaceContextMenuModel";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { SegmentContextMenu } from "./SegmentContextMenu";
import { WorkspaceFileRow } from "./WorkspaceFileRow";
import {
  formatRecentProjectDate,
  formatRecentProjectName,
  projectFileCountLabel,
  WELCOME_PROJECT_ACTION_BTN,
  WELCOME_PROJECT_ROW_ICON,
  WELCOME_SIDEBAR_PROJECT_META,
  WELCOME_SIDEBAR_PROJECT_NAME,
  WELCOME_SIDEBAR_SECTION_INSET_X,
} from "./welcomeSidebarFormatters";

type CtxMenu =
  | { kind: "project"; projectId: string; x: number; y: number }
  | {
      kind: "file";
      projectId: string;
      fileId: string;
      fileName: string;
      x: number;
      y: number;
    };

type Props = {
  controller: ProjectControllerApi;
  projects: ProjectSummary[];
  inProjectContext: boolean;
  activeProjectId: string | null;
  editorMode: boolean;
  activeFileId: string | null;
  expandedProjectId: string | null;
  projectFilesById: Record<string, fileApi.FileSummary[]>;
  loadingFilesById: Record<string, boolean>;
  onOpenProject: (projectId: string) => void;
  onOpenProjectFile: (projectId: string, fileId: string) => void;
  onToggleProjectExpanded: (projectId: string, isExpanded: boolean) => void;
};

export function WelcomeSidebarProjectList({
  controller: c,
  projects,
  inProjectContext,
  activeProjectId,
  editorMode,
  activeFileId,
  expandedProjectId,
  projectFilesById,
  loadingFilesById,
  onOpenProject,
  onOpenProjectFile,
  onToggleProjectExpanded,
}: Props) {
  const [ctx, setCtx] = useState<CtxMenu | null>(null);
  const fileDrag = useSidebarFileProjectDrag({
    busy: c.busy,
    onMove: (args) => c.moveProjectFileNow(args),
  });

  const openProjectMenu = (e: ReactMouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ kind: "project", projectId, x: e.clientX, y: e.clientY });
  };

  const openFileMenu = (
    e: ReactMouseEvent,
    projectId: string,
    fileId: string,
    fileName: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ kind: "file", projectId, fileId, fileName, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-6">
      <div className={`mb-3 flex items-baseline justify-between gap-2 ${WELCOME_SIDEBAR_SECTION_INSET_X}`}>
        <h2 className={`m-0 ${PANEL_TYPOGRAPHY.badge} text-notion-text-muted`}>项目列表</h2>
        {projects.length > 0 ? (
          <span className={`${PANEL_TYPOGRAPHY.meta} tabular-nums text-notion-text-light`}>
            {projects.length}
          </span>
        ) : null}
      </div>
      <div>
        {projects.length > 0 ? (
          projects.map((p) => {
            const isExpanded = expandedProjectId === p.id;
            const files = projectFilesById[p.id] ?? [];
            const loadingFiles = !!loadingFilesById[p.id];
            const fileCount = p.file_count ?? (files.length > 0 ? files.length : undefined);
            const metaLine = [
              formatRecentProjectDate(p.updated_at_ms),
              fileCount != null ? projectFileCountLabel(fileCount) : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const isActiveProject = inProjectContext && p.id === activeProjectId;
            const isRenamingThis =
              c.isRenamingProject && (c.renamingProjectId === p.id || (!c.renamingProjectId && isActiveProject));

            const isDropTarget =
              fileDrag.dragging != null &&
              fileDrag.dropTargetId === p.id &&
              fileDrag.dragging.projectId !== p.id;

            return (
              <div
                key={p.id}
                data-sidebar-project-id={p.id}
                className={[
                  "group",
                  WORKSPACE_SIDEBAR_ROW_SURFACE,
                  isDropTarget
                    ? "bg-notion-sidebar-active ring-1 ring-inset ring-accent-action/35"
                    : isActiveProject
                      ? "bg-notion-sidebar-active"
                      : "hover:bg-notion-sidebar-hover",
                ].join(" ")}
                onContextMenu={(e) => openProjectMenu(e, p.id)}
              >
                {isRenamingThis ? (
                  <form
                    className="flex items-center gap-2 px-5 py-2.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      c.commitRenameProject();
                    }}
                  >
                    <input
                      type="text"
                      className="min-w-0 flex-1 rounded-sm border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
                      value={c.renameProjectDraft}
                      disabled={c.busy}
                      autoFocus
                      onChange={(e) => c.setRenameProjectDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") c.cancelRenameProject();
                      }}
                    />
                    <button
                      type="submit"
                      className={`${CONTROL_BTN_LINK} shrink-0 text-label text-accent-action`}
                      disabled={c.busy || !c.renameProjectDraft.trim()}
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      className={`${CONTROL_BTN_LINK} shrink-0 text-label text-notion-text-muted`}
                      disabled={c.busy}
                      onClick={() => c.cancelRenameProject()}
                    >
                      取消
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1 px-5 py-2.5">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 appearance-none items-center gap-2 border-0 bg-transparent p-0 text-left disabled:opacity-40"
                      disabled={c.busy}
                      title={`打开项目：${formatRecentProjectName(p.name)}`}
                      onClick={() => onOpenProject(p.id)}
                    >
                      <span className={WELCOME_PROJECT_ROW_ICON}>
                        <FolderOpen
                          className={LUCIDE_ICON_SIZE_SM}
                          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                          aria-hidden
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={WELCOME_SIDEBAR_PROJECT_NAME}>
                          {formatRecentProjectName(p.name)}
                        </span>
                        <span className={WELCOME_SIDEBAR_PROJECT_META}>{metaLine}</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      className={WELCOME_PROJECT_ACTION_BTN}
                      onClick={() => onToggleProjectExpanded(p.id, isExpanded)}
                      disabled={c.busy}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? "收起文件列表" : "展开文件列表"}
                    >
                      <span className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                        <ChevronRight
                          className={LUCIDE_ICON_SIZE_SM}
                          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                          aria-hidden
                        />
                      </span>
                    </button>
                  </div>
                )}

                {isExpanded ? (
                  <div className="border-t border-notion-divider">
                    {loadingFiles ? (
                      <p className={`m-0 px-5 py-2 ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
                        正在加载文件…
                      </p>
                    ) : files.length > 0 ? (
                      <ul className="m-0 list-none p-0">
                        {[...files]
                          .sort((a, b) => b.updated_at_ms - a.updated_at_ms)
                          .map((f) => (
                            <li
                              key={f.id}
                              className={
                                fileDrag.dragging?.fileId === f.id ? "opacity-50" : undefined
                              }
                              onPointerDown={(e) => {
                                if (c.renamingProjectFileId === f.id) return;
                                fileDrag.beginFilePointerDrag(e, {
                                  fileId: f.id,
                                  projectId: p.id,
                                  fileName: f.name,
                                });
                              }}
                            >
                              {c.renamingProjectFileId === f.id ? (
                                <form
                                  className="flex items-center gap-2 px-5 py-1.5"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    c.commitRenameProjectFile();
                                  }}
                                >
                                  <input
                                    type="text"
                                    className="min-w-0 flex-1 rounded-sm border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
                                    value={c.renameProjectFileDraft}
                                    disabled={c.busy}
                                    autoFocus
                                    onChange={(e) => c.setRenameProjectFileDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") c.cancelRenameProjectFile();
                                    }}
                                  />
                                  <button
                                    type="submit"
                                    className={`${CONTROL_BTN_LINK} shrink-0 text-label text-accent-action`}
                                    disabled={c.busy || !c.renameProjectFileDraft.trim()}
                                  >
                                    保存
                                  </button>
                                  <button
                                    type="button"
                                    className={`${CONTROL_BTN_LINK} shrink-0 text-label text-notion-text-muted`}
                                    disabled={c.busy}
                                    onClick={() => c.cancelRenameProjectFile()}
                                  >
                                    取消
                                  </button>
                                </form>
                              ) : (
                                <WorkspaceFileRow
                                  variant="sidebar"
                                  name={f.name}
                                  meta={`${formatProjectFileType(f.file_type)} · ${formatWorkspaceFileTime(f.updated_at_ms)}`}
                                  busy={c.busy}
                                  selected={editorMode && activeFileId === f.id}
                                  onOpen={() => {
                                    if (fileDrag.consumeOpenClickSuppression()) return;
                                    void onOpenProjectFile(p.id, f.id);
                                  }}
                                  onContextMenu={(e) => openFileMenu(e, p.id, f.id, f.name)}
                                />
                              )}
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <button
                        type="button"
                        className={WORKSPACE_SIDEBAR_EMPTY_HINT_BTN}
                        disabled={c.busy}
                        onClick={() => onOpenProject(p.id)}
                      >
                        暂无文件 · 进入项目后导入音频或文本
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
            <p className="m-0 text-title text-notion-text-muted">还没有项目</p>
            <p className="m-0 mt-1 text-label text-notion-text-light">在右侧新建第一个转写项目</p>
          </div>
        )}
      </div>

      {ctx?.kind === "project" ? (
        <SegmentContextMenu
          x={ctx.x}
          y={ctx.y}
          items={buildProjectContextMenuItems({
            isExpanded: expandedProjectId === ctx.projectId,
            busy: c.busy,
          })}
          onClose={() => setCtx(null)}
          onSelect={(key) => {
            const project = projects.find((p) => p.id === ctx.projectId);
            if (!project || !isProjectContextMenuKey(key)) {
              setCtx(null);
              return;
            }
            const isExpanded = expandedProjectId === ctx.projectId;
            setCtx(null);
            if (key === "toggleExpand") onToggleProjectExpanded(ctx.projectId, isExpanded);
            else if (key === "revealLocation") void c.revealProjectLocation(ctx.projectId);
            else if (key === "rename") {
              c.beginRenameProject(formatRecentProjectName(project.name), ctx.projectId);
            } else if (key === "delete") {
              c.requestDeleteProject(ctx.projectId, formatRecentProjectName(project.name));
            }
          }}
        />
      ) : null}

      {ctx?.kind === "file" ? (
        <SegmentContextMenu
          x={ctx.x}
          y={ctx.y}
          items={buildProjectFileContextMenuItems({
            sourceProjectId: ctx.projectId,
            projects,
            busy: c.busy,
          })}
          onClose={() => setCtx(null)}
          onSelect={(key) => {
            if (!isProjectFileContextMenuKey(key)) {
              setCtx(null);
              return;
            }
            const fileCtx = ctx;
            setCtx(null);
            if (key === "open") void onOpenProjectFile(fileCtx.projectId, fileCtx.fileId);
            else if (key === "revealLocation") void c.revealFileLocation(fileCtx.fileId);
            else if (key === "rename") {
              c.beginRenameProjectFile(fileCtx.fileId, fileCtx.fileName, fileCtx.projectId);
            } else if (key === "delete") {
              c.requestDeleteProjectFile(fileCtx.fileId, fileCtx.fileName, fileCtx.projectId);
            } else {
              const moveDestId = parseMoveDestProjectId(key);
              if (moveDestId) {
                const dest = projects.find((p) => p.id === moveDestId);
                if (!dest) return;
                c.requestMoveProjectFile({
                  fileId: fileCtx.fileId,
                  fileName: fileCtx.fileName,
                  sourceProjectId: fileCtx.projectId,
                  destProjectId: moveDestId,
                  destProjectName: formatRecentProjectName(dest.name),
                });
                return;
              }
              const copyDestId = parseCopyDestProjectId(key);
              if (copyDestId) {
                const dest = projects.find((p) => p.id === copyDestId);
                if (!dest) return;
                c.requestCopyProjectFile({
                  fileId: fileCtx.fileId,
                  fileName: fileCtx.fileName,
                  sourceProjectId: fileCtx.projectId,
                  destProjectId: copyDestId,
                  destProjectName: formatRecentProjectName(dest.name),
                });
              }
            }
          }}
        />
      ) : null}
    </div>
  );
}
