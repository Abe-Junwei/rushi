import { ChevronRight, FolderOpen, Trash2 } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { WORKSPACE_SIDEBAR_ROW_SURFACE } from "../config/workspaceShellLayout";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { ProjectSummary } from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import { formatProjectFileType, formatWorkspaceFileTime } from "../utils/projectFileDisplay";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { WorkspaceFileRow } from "./WorkspaceFileRow";
import {
  formatRecentProjectDate,
  formatRecentProjectName,
  projectFileCountLabel,
  WELCOME_PROJECT_ACTION_BTN,
  WELCOME_PROJECT_DELETE_BTN,
  WELCOME_PROJECT_ROW_ICON,
  WELCOME_SIDEBAR_PROJECT_META,
  WELCOME_SIDEBAR_PROJECT_NAME,
} from "./welcomeSidebarFormatters";

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
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-4">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-5">
        <h2 className={`m-0 ${PANEL_TYPOGRAPHY.badge} text-notion-text-muted`}>最近项目</h2>
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

            return (
              <div
                key={p.id}
                className={[
                  "group",
                  WORKSPACE_SIDEBAR_ROW_SURFACE,
                  isActiveProject
                    ? "bg-notion-sidebar-active"
                    : "hover:bg-notion-sidebar-hover",
                ].join(" ")}
              >
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

                  <div className="flex shrink-0 items-center">
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
                    <button
                      type="button"
                      className={WELCOME_PROJECT_DELETE_BTN}
                      onClick={() => c.requestDeleteProject(p.id, formatRecentProjectName(p.name))}
                      disabled={c.busy}
                      aria-label={`删除项目 ${formatRecentProjectName(p.name)}`}
                    >
                      <Trash2
                        className={LUCIDE_ICON_SIZE_SM}
                        strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                        aria-hidden
                      />
                    </button>
                  </div>
                </div>

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
                            <li key={f.id}>
                              <WorkspaceFileRow
                                variant="sidebar"
                                name={f.name}
                                meta={`${formatProjectFileType(f.file_type)} · ${formatWorkspaceFileTime(f.updated_at_ms)}`}
                                busy={c.busy}
                                selected={editorMode && activeFileId === f.id}
                                onOpen={() => void onOpenProjectFile(p.id, f.id)}
                              />
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <button
                        type="button"
                        className={`w-full appearance-none border-0 bg-transparent px-5 py-2 text-left ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40`}
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
    </div>
  );
}
