import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  FolderOpen,
  List,
  Mic,
  Pencil,
  Settings,
  Trash2,
} from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { WelcomePageId } from "./welcomeTypes";
import type { ProjectSummary } from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import { formatProjectFileType, formatWorkspaceFileTime } from "../utils/projectFileDisplay";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { WorkspaceFileRow } from "./WorkspaceFileRow";

const PROJECT_ROW_ICON =
  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-notion-text-muted";
const PROJECT_ACTION_BTN =
  "flex h-7 w-7 shrink-0 appearance-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-notion-text-muted transition-[color,background-color,opacity] hover:bg-notion-sidebar-active hover:text-notion-text disabled:opacity-40";
const PROJECT_DELETE_BTN = `${PROJECT_ACTION_BTN} opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100`;

function sortProjects(list: ProjectSummary[]): ProjectSummary[] {
  return [...list].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
}

function formatRecentProjectDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) {
    return `${month}月${day}日更新`;
  }
  return `${d.getFullYear()}年${month}月${day}日更新`;
}

function formatRecentProjectName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function projectFileCountLabel(count: number): string {
  if (count <= 0) return "暂无文件";
  return `${count} 个文件`;
}

export interface WelcomeSidebarProps {
  controller: ProjectControllerApi;
  onOpenSettings: () => void;
  page: WelcomePageId;
  onPageChange: (page: WelcomePageId) => void;
  /** 项目 Hub：侧栏常驻「项目与文件」列表，并高亮当前项目 */
  hubMode?: boolean;
  activeProjectId?: string | null;
  /** Hub 下跳转欢迎页其它分区时先关闭当前项目 */
  onLeaveProjectForWelcome?: (page: WelcomePageId) => void;
}

export function WelcomeSidebar({
  controller: c,
  onOpenSettings,
  page,
  onPageChange,
  hubMode = false,
  activeProjectId = null,
  onLeaveProjectForWelcome,
}: WelcomeSidebarProps) {
  const projects = useMemo(() => sortProjects(c.projects), [c.projects]);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [projectFilesById, setProjectFilesById] = useState<Record<string, fileApi.FileSummary[]>>({});
  const [loadingFilesById, setLoadingFilesById] = useState<Record<string, boolean>>({});
  const projectListRef = useRef<HTMLDivElement | null>(null);

  const ensureProjectFilesLoaded = useCallback(async (projectId: string) => {
    if (projectFilesById[projectId] || loadingFilesById[projectId]) return;
    setLoadingFilesById((prev) => ({ ...prev, [projectId]: true }));
    try {
      const files = await fileApi.listFiles(projectId);
      setProjectFilesById((prev) => ({ ...prev, [projectId]: files }));
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingFilesById((prev) => ({ ...prev, [projectId]: false }));
    }
  }, [c, loadingFilesById, projectFilesById]);

  const handleOpenProject = useCallback(
    (projectId: string) => {
      if (c.current?.id !== projectId) {
        void c.loadProject(projectId);
      }
    },
    [c],
  );

  const handleOpenProjectFile = useCallback(async (projectId: string, fileId: string) => {
    if (c.current?.id !== projectId) {
      await c.loadProject(projectId);
    }
    await c.openFile(fileId);
  }, [c]);

  const handleOpenEditor = useCallback(() => {
    void c.openLastEditorWorkspace();
  }, [c]);

  const toggleProjectExpanded = useCallback(
    (projectId: string, isExpanded: boolean) => {
      setExpandedProjectId((prev) => (prev === projectId ? null : projectId));
      if (!isExpanded) void ensureProjectFilesLoaded(projectId);
    },
    [ensureProjectFilesLoaded],
  );

  const navigateWelcomePage = useCallback(
    (nextPage: WelcomePageId) => {
      if (hubMode && onLeaveProjectForWelcome) {
        onLeaveProjectForWelcome(nextPage);
        return;
      }
      onPageChange(nextPage);
    },
    [hubMode, onLeaveProjectForWelcome, onPageChange],
  );

  useEffect(() => {
    if (!hubMode || !activeProjectId) return;
    setExpandedProjectId(activeProjectId);
    void ensureProjectFilesLoaded(activeProjectId);
  }, [activeProjectId, ensureProjectFilesLoaded, hubMode]);

  const showProjectList = page === "home" || hubMode;

  const navItems = [
    {
      icon: <List className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
      label: "项目与文件",
      active: page === "home" || hubMode,
      onClick: () => {
        if (!hubMode) onPageChange("home");
        window.requestAnimationFrame(() => {
          projectListRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        });
      },
    },
    {
      icon: <BookOpen className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
      label: "热词与记忆",
      active: page === "glossary",
      onClick: () => navigateWelcomePage("glossary"),
    },
    {
      icon: <BarChart3 className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
      label: "质量概览",
      active: page === "quality",
      onClick: () => navigateWelcomePage("quality"),
    },
    {
      icon: <Pencil className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
      label: "编辑器",
      active: false,
      disabled: false,
      onClick: handleOpenEditor,
      title: "打开上次编辑的文件",
    },
    ...(hubMode && onLeaveProjectForWelcome
      ? [
          {
            icon: (
              <ChevronRight
                className={`${LUCIDE_ICON_SIZE_MD} shrink-0 rotate-180`}
                strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                aria-hidden
              />
            ),
            label: "返回欢迎页",
            active: false,
            disabled: false,
            onClick: () => onLeaveProjectForWelcome("home"),
          },
        ]
      : []),
  ];

  return (
    <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col border-r border-notion-divider bg-notion-sidebar">
      <div className="border-b border-notion-divider px-5 py-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-zen-saffron text-notion-bg">
            <Mic className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </div>
          <div>
            <h1 className="m-0 font-serif text-[18px] font-medium leading-[1.4] text-notion-text">如是我闻</h1>
            <p className="m-0 mt-0.5 text-[11px] font-medium leading-snug text-notion-text-muted">口述史转写工作台</p>
          </div>
        </div>
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled || c.busy}
              title={item.title}
              onClick={() => item.onClick?.()}
              className={[
                "flex w-full items-center gap-3 rounded-md border-0 px-3 py-2 text-sm font-medium transition-colors",
                item.active
                  ? "bg-notion-sidebar-active font-semibold text-notion-text"
                  : item.disabled
                    ? "cursor-not-allowed bg-transparent text-notion-text-light opacity-40"
                    : "bg-transparent text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text",
              ].join(" ")}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
      {showProjectList ? (
        <div ref={projectListRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
          <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
            <h2 className={`m-0 ${PANEL_TYPOGRAPHY.badge} text-notion-text-muted`}>
              最近项目
            </h2>
            {projects.length > 0 ? (
              <span className={`${PANEL_TYPOGRAPHY.meta} tabular-nums text-notion-text-light`}>
                {projects.length}
              </span>
            ) : null}
          </div>
          <div className="space-y-1">
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

                const isActiveProject = hubMode && p.id === activeProjectId;

                return (
                  <div
                    key={p.id}
                    className={[
                      "group rounded-md border transition-colors",
                      isActiveProject
                        ? "border-notion-border bg-notion-sidebar-active"
                        : "border-transparent hover:border-notion-border hover:bg-notion-sidebar-hover",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-1 px-1.5 py-1.5">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 appearance-none items-start gap-2 border-0 bg-transparent p-0.5 text-left disabled:opacity-40"
                        disabled={c.busy}
                        title={`打开项目：${formatRecentProjectName(p.name)}`}
                        onClick={() => handleOpenProject(p.id)}
                      >
                        <span className={PROJECT_ROW_ICON}>
                          <FolderOpen
                            className={LUCIDE_ICON_SIZE_SM}
                            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                            aria-hidden
                          />
                        </span>
                        <span className="min-w-0 flex-1 pt-0.5">
                          <span className="block truncate text-[13px] font-semibold leading-5 text-notion-text">
                            {formatRecentProjectName(p.name)}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] leading-4 text-notion-text-muted">
                            {metaLine}
                          </span>
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center pt-0.5">
                        <button
                          type="button"
                          className={PROJECT_ACTION_BTN}
                          onClick={() => toggleProjectExpanded(p.id, isExpanded)}
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
                          className={PROJECT_DELETE_BTN}
                          onClick={() =>
                            c.requestDeleteProject(p.id, formatRecentProjectName(p.name))
                          }
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
                      <div className="border-t border-notion-divider/70 px-2 pb-2 pt-1">
                        {loadingFiles ? (
                          <p className={`m-0 px-2 py-1.5 ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
                            正在加载文件…
                          </p>
                        ) : files.length > 0 ? (
                          <ul className="m-0 list-none space-y-0.5 p-0">
                            {[...files]
                              .sort((a, b) => b.updated_at_ms - a.updated_at_ms)
                              .map((f) => (
                                <li key={f.id}>
                                  <WorkspaceFileRow
                                    name={f.name}
                                    meta={`${formatProjectFileType(f.file_type)} · ${formatWorkspaceFileTime(f.updated_at_ms)}`}
                                    busy={c.busy}
                                    onOpen={() => handleOpenProjectFile(p.id, f.id)}
                                  />
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <button
                            type="button"
                            className={`w-full appearance-none border-0 bg-transparent px-2 py-1.5 text-left ${PANEL_TYPOGRAPHY.meta} transition-colors hover:text-notion-text disabled:opacity-40`}
                            disabled={c.busy}
                            onClick={() => handleOpenProject(p.id)}
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
              <div className="flex flex-col items-center justify-center px-2 py-10 text-center">
                <p className="m-0 text-[13px] text-notion-text-muted">还没有项目</p>
                <p className="m-0 mt-1 text-[11px] text-notion-text-light">在右侧新建第一个转写项目</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center px-5 py-8 text-center">
          <p className="text-[13px] leading-relaxed text-notion-text-muted">
            热词与记忆为全局设置：术语表影响转写热词；纠错记忆影响全文规则与提示。
          </p>
        </div>
      )}
      <div className="border-t border-notion-divider p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md border-0 bg-transparent px-3 py-2 text-sm font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text"
          onClick={onOpenSettings}
          disabled={c.busy}
        >
          <Settings className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}
