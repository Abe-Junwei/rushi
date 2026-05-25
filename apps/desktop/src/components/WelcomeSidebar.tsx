import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronRight, FileText, FolderOpen, List, Mic, Pencil, Settings, Trash2, X } from "lucide-react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { WelcomePageId } from "./WelcomeView";
import type { ProjectSummary } from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

function sortProjects(list: ProjectSummary[]): ProjectSummary[] {
  return [...list].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
}

function formatRecentProjectDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function formatRecentProjectName(name: string): string {
  // Collapse accidental repeated spaces to keep card titles visually stable.
  return name.replace(/\s+/g, " ").trim();
}

function formatFileType(type: string): string {
  if (type === "text") return "文本";
  if (type === "paired") return "音视频";
  if (type === "audio_only") return "音频";
  return type;
}

export interface WelcomeSidebarProps {
  controller: ProjectControllerApi;
  onOpenSettings: () => void;
  page: WelcomePageId;
  onPageChange: (page: WelcomePageId) => void;
}

export function WelcomeSidebar({ controller: c, onOpenSettings, page, onPageChange }: WelcomeSidebarProps) {
  const projects = useMemo(() => sortProjects(c.projects), [c.projects]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [projectFilesById, setProjectFilesById] = useState<Record<string, fileApi.FileSummary[]>>({});
  const [loadingFilesById, setLoadingFilesById] = useState<Record<string, boolean>>({});
  const projectListRef = useRef<HTMLDivElement | null>(null);

  // Cancel delete confirmation on Escape or click outside
  useEffect(() => {
    if (!deleteConfirmId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteConfirmId(null);
    };
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-delete-confirm]")) setDeleteConfirmId(null);
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [deleteConfirmId]);

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

  const handleOpenProjectFile = useCallback(async (projectId: string, fileId: string) => {
    if (c.current?.id !== projectId) {
      await c.loadProject(projectId);
    }
    await c.openFile(fileId);
  }, [c]);

  const navItems = [
    {
      icon: <List className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
      label: "项目列表",
      active: page === "home",
      onClick: () => {
        onPageChange("home");
        window.requestAnimationFrame(() => {
          projectListRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        });
      },
    },
    {
      icon: <BookOpen className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
      label: "术语管理",
      active: page === "glossary",
      onClick: () => onPageChange("glossary"),
    },
    { icon: <Pencil className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />, label: "编辑器", active: false, disabled: true },
    { icon: <FileText className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />, label: "转写文本", active: false, disabled: true },
  ];

  return (
    <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col border-r border-notion-divider bg-notion-sidebar">
      {/* Brand */}
      <div className="border-b border-notion-divider px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-zen-saffron text-notion-bg">
            <Mic className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </div>
          <div>
            <h1 className="m-0 font-serif text-[18px] font-medium leading-[1.4] text-notion-text">如是我闻</h1>
            <p className="m-0 mt-1 text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-notion-text-muted">转写任务进行中</p>
          </div>
        </div>
        {/* Nav */}
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled || c.busy}
              onClick={() => item.onClick?.()}
              className={[
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors border-0",
                item.active
                  ? "border border-notion-border bg-notion-sidebar-active text-notion-text"
                  : item.disabled
                    ? "cursor-not-allowed text-notion-text-light opacity-40 bg-transparent"
                    : "text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text bg-transparent",
              ].join(" ")}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
      {page === "home" ? (
      <div ref={projectListRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-notion-text-muted">项目列表</h2>
        <div className="space-y-3">
          {projects.length > 0 ? (
            projects.map((p) => {
              const isExpanded = expandedProjectId === p.id;
              const files = projectFilesById[p.id] ?? [];
              const loadingFiles = !!loadingFilesById[p.id];
              return (
              <div
                key={p.id}
                className="group relative rounded border border-transparent p-3 transition-colors hover:border-notion-border hover:bg-notion-sidebar-hover"
              >
                <div className="flex items-start justify-between">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 appearance-none items-start gap-3 border-0 bg-transparent p-0 text-left disabled:opacity-40"
                    disabled={c.busy}
                    onClick={() => {
                      if (c.current?.id !== p.id) {
                        void c.loadProject(p.id);
                      }
                    }}
                  >
                    <span className="mt-0.5 text-notion-text-muted">
                      <FolderOpen className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 min-w-0 truncate text-sm font-semibold leading-5 text-notion-text">
                        {formatRecentProjectName(p.name)}
                      </p>
                      <p className="m-0 mt-1 text-[12px] leading-4 text-notion-text-muted">{formatRecentProjectDate(p.updated_at_ms)}</p>
                    </div>
                  </button>
                  {/* Status / Actions */}
                  <div className="mt-1 flex shrink-0 items-center gap-1">
                    {deleteConfirmId !== p.id ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-zen-saffron group-hover:hidden" aria-hidden />
                        <button
                          type="button"
                          className="flex h-7 w-7 appearance-none items-center justify-center rounded border-0 bg-transparent p-0 text-notion-text-muted transition-colors hover:text-zen-saffron"
                          onClick={() => {
                            setExpandedProjectId((prev) => (prev === p.id ? null : p.id));
                            if (!isExpanded) void ensureProjectFilesLoaded(p.id);
                          }}
                          disabled={c.busy}
                          aria-label={isExpanded ? "收起项目文件" : "展开项目文件"}
                        >
                          <span className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                            <ChevronRight className={`${LUCIDE_ICON_SIZE_SM} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                          </span>
                        </button>
                        <button
                          type="button"
                          className="hidden h-7 w-7 appearance-none items-center justify-center rounded border-0 bg-transparent p-0 text-notion-text-muted transition-colors hover:text-zen-cinnabar group-hover:flex"
                          onClick={() => setDeleteConfirmId(p.id)}
                          disabled={c.busy}
                        >
                          <Trash2 className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1" data-delete-confirm>
                        <span className="text-[11px] text-zen-cinnabar">确定删除？</span>
                        <button
                          type="button"
                          className="appearance-none border-0 bg-transparent p-0 text-[11px] font-semibold text-zen-cinnabar hover:underline"
                          onClick={() => {
                            setDeleteConfirmId(null);
                            void c.deleteProject(p.id, { skipBrowserConfirm: true });
                          }}
                          disabled={c.busy}
                        >
                          确认
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 appearance-none items-center justify-center rounded border-0 bg-transparent p-0 text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text"
                          onClick={() => setDeleteConfirmId(null)}
                          aria-label="取消删除"
                        >
                          <X className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded ? (
                  <div className="mt-2 border-l border-notion-divider pl-3">
                    {loadingFiles ? (
                      <p className="m-0 py-1 text-[11px] text-notion-text-muted">加载文件中...</p>
                    ) : files.length > 0 ? (
                      <div className="space-y-1">
                        {files.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className="flex w-full appearance-none items-center justify-between gap-2 rounded border-0 bg-transparent px-2 py-1 text-left text-[11px] text-notion-text transition-colors hover:bg-notion-sidebar-active disabled:opacity-40"
                            disabled={c.busy}
                            onClick={() => void handleOpenProjectFile(p.id, f.id)}
                            title={f.name}
                          >
                            <span className="min-w-0 flex-1 truncate">{f.name}</span>
                            <span className="shrink-0 text-[11px] text-notion-text-muted">{formatFileType(f.file_type)}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="w-full appearance-none border-0 bg-transparent py-1 text-left text-[11px] text-notion-text-muted transition-colors hover:text-notion-text disabled:opacity-40"
                        disabled={c.busy}
                        onClick={() => {
                          void c.loadProject(p.id);
                        }}
                      >
                        项目无文件，点击进入转写并导入音频/文本
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            );
            })
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-notion-text-muted">暂无项目，请先新建。</p>
            </div>
          )}
        </div>

      </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center px-6 py-8 text-center">
          <p className="text-sm leading-relaxed text-notion-text-muted">
            术语库为全局设置。在右侧添加或删除术语后，转写时会自动作为热词提交给 ASR。
          </p>
        </div>
      )}
      <div className="border-t border-notion-divider p-4">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-notion-text-muted transition-colors border-0 bg-transparent hover:bg-notion-sidebar-hover hover:text-notion-text"
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
