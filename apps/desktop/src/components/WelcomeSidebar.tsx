import { useCallback, useMemo, useRef } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  List,
  Mic,
  Pencil,
  Settings,
} from "lucide-react";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { GlossaryWorkspaceId } from "./glossary/glossaryWorkspaceTypes";
import { GLOSSARY_WORKSPACE_NAV_ITEMS } from "./glossary/glossaryWorkspaceNav";
import type { WelcomePageId } from "./welcomeTypes";
import { WORKSPACE_SIDEBAR_PANEL_ATTR, WORKSPACE_SIDEBAR_ROW_INTERACTIVE } from "../config/workspaceShellLayout";
import { useWelcomeSidebarProjectTree } from "../hooks/useWelcomeSidebarProjectTree";
import { editorShortcutMenuHint } from "../utils/editorShortcutMenuHint";
import { sortWelcomeProjects } from "./welcomeSidebarFormatters";
import { WelcomeSidebarProjectList } from "./WelcomeSidebarProjectList";

export interface WelcomeSidebarProps {
  controller: ProjectControllerApi;
  onOpenSettings: () => void;
  page: WelcomePageId;
  onPageChange: (page: WelcomePageId) => void;
  hubMode?: boolean;
  activeProjectId?: string | null;
  onLeaveProjectForWelcome?: (page: WelcomePageId, glossaryWorkspace?: GlossaryWorkspaceId) => void;
  glossaryWorkspaceId?: GlossaryWorkspaceId;
  onGlossaryWorkspaceChange?: (id: GlossaryWorkspaceId) => void;
  editorMode?: boolean;
  activeFileId?: string | null;
  embeddedInCollapsibleShell?: boolean;
}

export function WelcomeSidebar({
  controller: c,
  onOpenSettings,
  page,
  onPageChange,
  hubMode = false,
  activeProjectId = null,
  onLeaveProjectForWelcome,
  editorMode = false,
  activeFileId = null,
  embeddedInCollapsibleShell = false,
  glossaryWorkspaceId = "vocabulary",
  onGlossaryWorkspaceChange,
}: WelcomeSidebarProps) {
  const projects = useMemo(() => sortWelcomeProjects(c.projects), [c.projects]);
  const projectListRef = useRef<HTMLDivElement | null>(null);

  const projectTree = useWelcomeSidebarProjectTree(c, {
    hubMode,
    editorMode,
    activeProjectId,
  });

  const handleOpenEditor = useCallback(() => {
    void c.openLastEditorWorkspace();
  }, [c]);

  const inProjectContext = hubMode || editorMode;

  const navigateWelcomePage = useCallback(
    (nextPage: WelcomePageId, glossaryWorkspace?: GlossaryWorkspaceId) => {
      if (inProjectContext && onLeaveProjectForWelcome) {
        onLeaveProjectForWelcome(nextPage, glossaryWorkspace);
        return;
      }
      onPageChange(nextPage);
      if (nextPage === "glossary" && glossaryWorkspace) {
        onGlossaryWorkspaceChange?.(glossaryWorkspace);
      }
    },
    [inProjectContext, onLeaveProjectForWelcome, onGlossaryWorkspaceChange, onPageChange],
  );

  const showProjectList = page === "home" || hubMode || editorMode;

  const settingsOpenHint = editorShortcutMenuHint("workflow.openSettings");

  const navItems = [
    {
      icon: <List className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
      label: "项目与文件",
      active: page === "home" || inProjectContext,
      onClick: () => {
        if (!inProjectContext) onPageChange("home");
        window.requestAnimationFrame(() => {
          projectListRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        });
      },
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
      hidden: editorMode,
    },
    ...(inProjectContext && onLeaveProjectForWelcome
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
    <aside
      {...{ [WORKSPACE_SIDEBAR_PANEL_ATTR]: "" }}
      className={[
        "flex h-full min-h-0 w-full max-w-full shrink-0 flex-col bg-notion-sidebar",
        embeddedInCollapsibleShell ? "" : "border-r border-notion-divider",
      ].join(" ")}
    >
      <div className="border-b border-notion-divider">
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-zen-saffron text-notion-bg">
              <Mic className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            </div>
            <div>
              <h1 className="m-0 font-serif text-[18px] font-medium leading-[1.4] text-notion-text">如是我闻</h1>
              <p className="m-0 mt-0.5 text-[11px] font-medium leading-snug text-notion-text-muted">本地课录音转写与校对</p>
            </div>
          </div>
        </div>
        <nav>
          {navItems
            .filter((item) => !("hidden" in item && item.hidden))
            .map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled || c.busy}
                title={item.title}
                onClick={() => item.onClick?.()}
                className={[
                  WORKSPACE_SIDEBAR_ROW_INTERACTIVE,
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

          <div>
            <button
              type="button"
              disabled={c.busy}
              onClick={() => navigateWelcomePage("glossary", glossaryWorkspaceId)}
              className={[
                WORKSPACE_SIDEBAR_ROW_INTERACTIVE,
                page === "glossary"
                  ? "bg-notion-sidebar-active font-semibold text-notion-text"
                  : "bg-transparent text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text",
              ].join(" ")}
            >
              <BookOpen className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              <span>热词与记忆</span>
            </button>
            {page === "glossary" ? (
              <ul className="m-0 list-none space-y-0.5 p-0 pb-1">
                {GLOSSARY_WORKSPACE_NAV_ITEMS.map((item) => {
                  const selected = glossaryWorkspaceId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={c.busy}
                        aria-current={selected ? "page" : undefined}
                        onClick={() => {
                          onGlossaryWorkspaceChange?.(item.id);
                          if (page !== "glossary") {
                            navigateWelcomePage("glossary", item.id);
                          }
                        }}
                        className={[
                          "flex w-full items-center gap-2 border-0 py-1.5 pl-12 pr-5 text-left text-[12px] font-medium transition-colors",
                          selected
                            ? "bg-notion-sidebar-active text-zen-saffron"
                            : "bg-transparent text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text",
                        ].join(" ")}
                      >
                        <span className="shrink-0 opacity-80">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </nav>
      </div>
      {showProjectList ? (
        <div ref={projectListRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <WelcomeSidebarProjectList
            controller={c}
            projects={projects}
            inProjectContext={inProjectContext}
            activeProjectId={activeProjectId}
            editorMode={editorMode}
            activeFileId={activeFileId}
            expandedProjectId={projectTree.expandedProjectId}
            projectFilesById={projectTree.projectFilesById}
            loadingFilesById={projectTree.loadingFilesById}
            onOpenProject={projectTree.handleOpenProject}
            onOpenProjectFile={(projectId, fileId) => void projectTree.handleOpenProjectFile(projectId, fileId)}
            onToggleProjectExpanded={projectTree.toggleProjectExpanded}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center px-5 py-8 text-center">
          <p className="text-[13px] leading-relaxed text-notion-text-muted">
            全局设置：术语表→转写热词；纠错记忆→编辑规则。
          </p>
        </div>
      )}
      <div className="mt-auto shrink-0 border-t border-notion-divider bg-notion-sidebar">
        <button
          type="button"
          className={[
            WORKSPACE_SIDEBAR_ROW_INTERACTIVE,
            "bg-transparent text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text",
          ].join(" ")}
          onClick={onOpenSettings}
          disabled={c.busy}
          aria-label={`设置 (${settingsOpenHint})`}
          title={`设置 (${settingsOpenHint})`}
        >
          <Settings className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}
