import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconFolderOpen as FolderOpen,
  IconNotebook as NotebookText,
  IconPencil as Pencil,
  IconTrash as Trash2,
} from "@tabler/icons-react";
import { CONTROL_BTN_ICON_GHOST, CONTROL_BTN_LINK } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  WELCOME_LEDGER_INSET_X,
  WELCOME_LEDGER_NESTED_FILE_INSET_X,
  WELCOME_LEDGER_ROW_Y,
  WORKSPACE_FILE_ROW_CLASS,
  WORKSPACE_SIDEBAR_ROW_SURFACE,
} from "../config/workspaceShellLayout";
import {
  PROJECT_LIBRARY_PROJECT_ID_ATTR,
  useProjectLibraryFileDrag,
} from "../hooks/useProjectLibraryFileDrag";
import { useViewportHeight } from "../hooks/useViewportHeight";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { ProjectSummary } from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import { formatHubFileAudioMetaLine } from "../utils/projectFileDisplay";
import {
  clampProjectLibraryPage,
  projectLibraryFilePageSizeForHeight,
  projectLibraryPageCount,
  projectLibraryPageForId,
  projectLibraryPageSizeForHeight,
  sliceProjectLibraryPage,
} from "../utils/projectLibraryPagination";
import {
  buildProjectContextMenuItems,
  buildProjectFileContextMenuItems,
  isProjectContextMenuKey,
  isProjectFileContextMenuKey,
  parseCopyDestProjectId,
  parseMoveDestProjectId,
} from "../utils/projectWorkspaceContextMenuModel";
import { HoverRevealText } from "./HoverRevealText";
import { HubFileStageMeter } from "./HubFileStageMeter";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import {
  ensureLibraryProjectActive,
  ProjectLibraryActionBar,
} from "./ProjectLibraryActionBar";
import { SegmentContextMenu } from "./SegmentContextMenu";
import {
  formatRecentProjectDate,
  formatRecentProjectName,
  projectFileCountLabel,
  WELCOME_PROJECT_ACTION_BTN,
  WELCOME_PROJECT_ROW_ICON,
  WELCOME_SIDEBAR_PROJECT_META,
  WELCOME_SIDEBAR_PROJECT_NAME,
} from "./welcomeSidebarFormatters";

const LIBRARY_FILE_ACTION_BTN = `${CONTROL_BTN_ICON_GHOST} text-notion-text-light opacity-0 transition-[color,background-color,opacity] group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40`;

/** 项目信息 / 删除：行悬停才显示 */
const LIBRARY_PROJECT_HOVER_ACTION_BTN = `${WELCOME_PROJECT_ACTION_BTN} opacity-0 transition-opacity group-hover/project:opacity-100 group-focus-within/project:opacity-100`;

/** 与 WelcomeFileLedgerRow 同构：左标题+meta · 右图例+细轨。 */
function ProjectLibraryFileRow({
  file,
  busy,
  onOpen,
  onContextMenu,
  actionSlot,
}: {
  file: fileApi.FileSummary;
  busy?: boolean;
  onOpen: () => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
  actionSlot?: ReactNode;
}) {
  const [rowHovered, setRowHovered] = useState(false);
  const meta = formatHubFileAudioMetaLine(file);
  const warning = Boolean(file.media_missing);

  return (
    <div className={WORKSPACE_FILE_ROW_CLASS} onContextMenu={onContextMenu}>
      <div
        className={`flex w-full min-w-0 items-center gap-2 ${WELCOME_LEDGER_NESTED_FILE_INSET_X} ${WELCOME_LEDGER_ROW_Y}`}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-4 border-0 bg-transparent text-left disabled:opacity-40"
          disabled={busy}
          onClick={() => void onOpen()}
          title={file.name}
          onMouseEnter={() => setRowHovered(true)}
          onMouseLeave={() => setRowHovered(false)}
          onFocus={() => setRowHovered(true)}
          onBlur={() => setRowHovered(false)}
        >
          <span className="min-w-0 flex-1">
            <HoverRevealText
              text={file.name}
              revealed={rowHovered}
              className="text-title font-medium leading-5 text-notion-text"
            />
            <span
              className={[
                "mt-0.5 block truncate text-label leading-4",
                PANEL_TYPOGRAPHY.meta,
                warning ? "text-zen-cinnabar" : "text-notion-text-muted",
              ].join(" ")}
            >
              {meta}
            </span>
          </span>
          <span className="w-[12rem] shrink-0">
            <HubFileStageMeter file={file} variant="ledger" />
          </span>
        </button>
        {actionSlot ? <div className="flex shrink-0 items-center">{actionSlot}</div> : null}
      </div>
    </div>
  );
}

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
  expandedProjectId: string | null;
  projectFilesById: Record<string, fileApi.FileSummary[]>;
  loadingFilesById: Record<string, boolean>;
  onOpenProjectFile: (projectId: string, fileId: string) => void;
  onToggleProjectExpanded: (projectId: string, isExpanded: boolean) => void;
};

/** 欢迎页「所有」：可展开项目树 + Hub 迁入动作 + 项目/文件右键 + 底部分页。 */
export function WorkspaceProjectLibrary({
  controller: c,
  projects,
  expandedProjectId,
  projectFilesById,
  loadingFilesById,
  onOpenProjectFile,
  onToggleProjectExpanded,
}: Props) {
  const [ctx, setCtx] = useState<CtxMenu | null>(null);
  const [page, setPage] = useState(0);
  const [filePage, setFilePage] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportH = useViewportHeight(rootRef);
  const projectPageSize = projectLibraryPageSizeForHeight(viewportH);
  const filePageSize = projectLibraryFilePageSizeForHeight(viewportH);
  const fileDrag = useProjectLibraryFileDrag({
    busy: c.busy,
    onMove: (args) => c.moveProjectFileNow(args),
  });

  const pageCount = projectLibraryPageCount(projects.length, projectPageSize);
  const safePage = clampProjectLibraryPage(page, projects.length, projectPageSize);
  const pageProjects = useMemo(
    () => sliceProjectLibraryPage(projects, safePage, projectPageSize),
    [projects, safePage, projectPageSize],
  );
  /** 展开时只渲染该项目，避免同页多项目 + 文件列表撑破视口 */
  const visibleProjects = useMemo(() => {
    if (!expandedProjectId) return pageProjects;
    const hit = pageProjects.find((p) => p.id === expandedProjectId);
    return hit ? [hit] : pageProjects;
  }, [expandedProjectId, pageProjects]);

  const expandedFilesSorted = useMemo(() => {
    if (!expandedProjectId) return [] as fileApi.FileSummary[];
    const files = projectFilesById[expandedProjectId] ?? [];
    return [...files].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
  }, [expandedProjectId, projectFilesById]);

  const filePageCount = projectLibraryPageCount(expandedFilesSorted.length, filePageSize);
  const safeFilePage = clampProjectLibraryPage(
    filePage,
    expandedFilesSorted.length,
    filePageSize,
  );
  const pageFiles = useMemo(
    () => sliceProjectLibraryPage(expandedFilesSorted, safeFilePage, filePageSize),
    [expandedFilesSorted, safeFilePage, filePageSize],
  );

  const collapsedShowPager = projects.length > projectPageSize;
  const expandedShowPager = Boolean(expandedProjectId) && expandedFilesSorted.length > filePageSize;
  const showPager = expandedProjectId ? expandedShowPager : collapsedShowPager;

  useEffect(() => {
    setPage((prev) => clampProjectLibraryPage(prev, projects.length, projectPageSize));
  }, [projects.length, projectPageSize]);

  useEffect(() => {
    setFilePage(0);
  }, [expandedProjectId, filePageSize]);

  useEffect(() => {
    setFilePage((prev) =>
      clampProjectLibraryPage(prev, expandedFilesSorted.length, filePageSize),
    );
  }, [expandedFilesSorted.length, filePageSize]);

  useEffect(() => {
    if (!expandedProjectId) return;
    const target = projectLibraryPageForId(
      projects.map((p) => p.id),
      expandedProjectId,
      projectPageSize,
    );
    setPage((prev) => (prev === target ? prev : target));
  }, [expandedProjectId, projects, projectPageSize]);

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

  const runProjectLibraryAction = async (
    projectId: string,
    key: "projectInfo" | "importAudio" | "importText" | "batchTranscribe",
  ) => {
    if (!(await ensureLibraryProjectActive(c, projectId))) return;
    try {
      if (key === "projectInfo") c.openProjectMetadataDialog();
      else if (key === "importAudio") await c.pickAndImportAudioPathsToProject();
      else if (key === "importText") await c.pickAndImportFileToProject("text");
      else await c.startBatchTranscribe();
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (projects.length === 0) {
    return (
      <div
        ref={rootRef}
        className={`flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden py-10 text-center ${WELCOME_LEDGER_INSET_X}`}
        data-purpose="workspace-project-library"
      >
        <p className="m-0 text-title text-notion-text-muted">还没有项目</p>
        <p className="m-0 mt-1 text-label text-notion-text-light">在上方新建第一个转写项目</p>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      data-purpose="workspace-project-library"
    >
      <div className="min-h-0 flex-1 overflow-hidden">
      {visibleProjects.map((p) => {
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
        const isRenamingThis = c.isRenamingProject && c.renamingProjectId === p.id;

        const isDropTarget =
          fileDrag.dragging != null &&
          fileDrag.dropTargetId === p.id &&
          fileDrag.dragging.projectId !== p.id;

        return (
          <div
            key={p.id}
            {...{ [PROJECT_LIBRARY_PROJECT_ID_ATTR]: p.id }}
            className={[
              "group/project",
              WORKSPACE_SIDEBAR_ROW_SURFACE,
              isDropTarget
                ? "bg-notion-sidebar-active ring-1 ring-inset ring-accent-action/35"
                : "hover:bg-notion-sidebar-hover",
            ].join(" ")}
            onContextMenu={(e) => openProjectMenu(e, p.id)}
          >
            {isRenamingThis ? (
              <form
                className={`flex items-center gap-2 ${WELCOME_LEDGER_ROW_Y} ${WELCOME_LEDGER_INSET_X}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  c.commitRenameProject();
                }}
              >
                <input
                  type="text"
                  className="min-w-0 flex-1 rounded-sm border border-notion-border bg-notion-bg px-2 py-1 text-title text-notion-text"
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
              <div className={`flex items-center gap-1 ${WELCOME_LEDGER_ROW_Y} ${WELCOME_LEDGER_INSET_X}`}>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 appearance-none items-center gap-2 border-0 bg-transparent p-0 text-left disabled:opacity-40"
                  disabled={c.busy}
                  title={isExpanded ? `收起：${formatRecentProjectName(p.name)}` : `展开：${formatRecentProjectName(p.name)}`}
                  aria-expanded={isExpanded}
                  onClick={() => onToggleProjectExpanded(p.id, isExpanded)}
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
                  className={LIBRARY_PROJECT_HOVER_ACTION_BTN}
                  disabled={c.busy}
                  aria-label="项目信息"
                  title="项目信息"
                  onClick={() => void runProjectLibraryAction(p.id, "projectInfo")}
                >
                  <NotebookText
                    className={LUCIDE_ICON_SIZE_MD}
                    strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  className={`${LIBRARY_PROJECT_HOVER_ACTION_BTN} hover:text-zen-cinnabar`}
                  disabled={c.busy}
                  aria-label="删除项目"
                  title="删除项目"
                  onClick={() =>
                    c.requestDeleteProject(p.id, formatRecentProjectName(p.name))
                  }
                >
                  <Trash2
                    className={LUCIDE_ICON_SIZE_MD}
                    strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                    aria-hidden
                  />
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
              <div>
                {loadingFiles ? (
                  <p className={`m-0 py-2 ${WELCOME_LEDGER_NESTED_FILE_INSET_X} ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
                    正在加载文件…
                  </p>
                ) : files.length > 0 ? (
                  <ul className="m-0 list-none overflow-hidden p-0">
                    {pageFiles.map((f) => (
                        <li
                          key={f.id}
                          className={[
                            "group",
                            fileDrag.dragging?.fileId === f.id ? "opacity-50" : undefined,
                          ]
                            .filter(Boolean)
                            .join(" ")}
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
                              className={`flex items-center gap-2 py-1.5 ${WELCOME_LEDGER_NESTED_FILE_INSET_X}`}
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
                            <ProjectLibraryFileRow
                              file={f}
                              busy={c.busy}
                              onOpen={() => {
                                if (fileDrag.consumeOpenClickSuppression()) return;
                                void onOpenProjectFile(p.id, f.id);
                              }}
                              onContextMenu={(e) => openFileMenu(e, p.id, f.id, f.name)}
                              actionSlot={
                                <>
                                  <button
                                    type="button"
                                    className={LIBRARY_FILE_ACTION_BTN}
                                    disabled={c.busy}
                                    aria-label={`重命名 ${f.name}`}
                                    onClick={() => c.beginRenameProjectFile(f.id, f.name, p.id)}
                                  >
                                    <Pencil
                                      className={LUCIDE_ICON_SIZE_MD}
                                      strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                                      aria-hidden
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    className={`${LIBRARY_FILE_ACTION_BTN} hover:text-zen-cinnabar`}
                                    disabled={c.busy}
                                    aria-label={`删除 ${f.name}`}
                                    onClick={() => c.requestDeleteProjectFile(f.id, f.name, p.id)}
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
                      ))}
                  </ul>
                ) : (
                  <p className={`m-0 py-3 ${WELCOME_LEDGER_NESTED_FILE_INSET_X} text-sm text-notion-text-muted`}>
                    暂无文件。请使用下方按钮导入音频或转录文本。
                  </p>
                )}
                <ProjectLibraryActionBar controller={c} projectId={p.id} busy={c.busy} />
              </div>
            ) : null}
          </div>
        );
      })}
      </div>

      {showPager ? (
        <nav
          className={`mt-auto flex shrink-0 items-center justify-end gap-2 border-t border-notion-border/70 py-2 ${WELCOME_LEDGER_INSET_X}`}
          aria-label={expandedProjectId ? "项目文件翻页" : "项目列表翻页"}
          data-purpose="project-library-pager"
        >
          <span className={`${PANEL_TYPOGRAPHY.meta} tabular-nums text-notion-text-muted`}>
            {`第 ${(expandedProjectId ? safeFilePage : safePage) + 1} / ${
              expandedProjectId ? filePageCount : pageCount
            } 页`}
          </span>
          <button
            type="button"
            className={CONTROL_BTN_ICON_GHOST}
            disabled={
              c.busy || (expandedProjectId ? safeFilePage <= 0 : safePage <= 0)
            }
            aria-label="上一页"
            title="上一页"
            onClick={() => {
              if (expandedProjectId) {
                setFilePage((p) =>
                  clampProjectLibraryPage(p - 1, expandedFilesSorted.length, filePageSize),
                );
              } else {
                setPage((p) => clampProjectLibraryPage(p - 1, projects.length, projectPageSize));
              }
            }}
          >
            <ChevronLeft
              className={LUCIDE_ICON_SIZE_MD}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
          </button>
          <button
            type="button"
            className={CONTROL_BTN_ICON_GHOST}
            disabled={
              c.busy ||
              (expandedProjectId
                ? safeFilePage >= filePageCount - 1
                : safePage >= pageCount - 1)
            }
            aria-label="下一页"
            title="下一页"
            onClick={() => {
              if (expandedProjectId) {
                setFilePage((p) =>
                  clampProjectLibraryPage(p + 1, expandedFilesSorted.length, filePageSize),
                );
              } else {
                setPage((p) => clampProjectLibraryPage(p + 1, projects.length, projectPageSize));
              }
            }}
          >
            <ChevronRight
              className={LUCIDE_ICON_SIZE_MD}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
          </button>
        </nav>
      ) : null}

      {ctx?.kind === "project" ? (
        <SegmentContextMenu
          x={ctx.x}
          y={ctx.y}
          items={buildProjectContextMenuItems({
            isExpanded: expandedProjectId === ctx.projectId,
            busy: c.busy,
            canBatchTranscribe:
              c.current?.id === ctx.projectId ? c.canStartBatchTranscribe : undefined,
          })}
          onClose={() => setCtx(null)}
          onSelect={(key) => {
            const project = projects.find((p) => p.id === ctx.projectId);
            if (!project || !isProjectContextMenuKey(key)) {
              setCtx(null);
              return;
            }
            const isExpanded = expandedProjectId === ctx.projectId;
            const projectId = ctx.projectId;
            setCtx(null);
            if (key === "toggleExpand") onToggleProjectExpanded(projectId, isExpanded);
            else if (key === "revealLocation") void c.revealProjectLocation(projectId);
            else if (key === "rename") {
              c.beginRenameProject(formatRecentProjectName(project.name), projectId);
            } else if (key === "delete") {
              c.requestDeleteProject(projectId, formatRecentProjectName(project.name));
            } else if (
              key === "projectInfo" ||
              key === "importAudio" ||
              key === "importText" ||
              key === "batchTranscribe"
            ) {
              void runProjectLibraryAction(projectId, key);
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
