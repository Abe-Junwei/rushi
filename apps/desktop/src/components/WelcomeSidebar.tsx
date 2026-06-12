import { useCallback, useMemo, useRef, type ReactNode } from "react";
import {
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
import {
  WORKSPACE_SIDEBAR_FOOTER_GRID,
  WORKSPACE_SIDEBAR_NAV_STACK,
  WORKSPACE_SIDEBAR_PANEL_ATTR,
  workspaceSidebarFooterItemClass,
  workspaceSidebarNavItemClass,
  workspaceSidebarSubNavItemClass,
} from "../config/workspaceShellLayout";
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
  onRestoreOnboardingChecklist?: () => void;
  onboardingChecklistDismissed?: boolean;
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
  onRestoreOnboardingChecklist,
  onboardingChecklistDismissed = false,
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

  const showRestoreOnboarding =
    page === "home" && !inProjectContext && onboardingChecklistDismissed && onRestoreOnboardingChecklist != null;

  type SidebarFooterItem = {
    key: string;
    label: string;
    icon: ReactNode;
    title?: string;
    ariaLabel?: string;
    onClick: () => void;
  };

  const footerItems: SidebarFooterItem[] = [
    ...(showRestoreOnboarding
      ? [
          {
            key: "restore-onboarding",
            label: "上手清单",
            icon: <List className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
            title: "恢复欢迎页上手清单",
            onClick: () => {
              onRestoreOnboardingChecklist?.();
            },
          },
        ]
      : []),
    {
      key: "settings",
      label: "设置",
      icon: <Settings className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
      ariaLabel: `设置 (${settingsOpenHint})`,
      title: `设置 (${settingsOpenHint})`,
      onClick: onOpenSettings,
    },
  ];

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
        <nav aria-label="主工作区">
          <div className={WORKSPACE_SIDEBAR_NAV_STACK}>
            {navItems
              .filter((item) => !("hidden" in item && item.hidden))
              .map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={item.disabled || c.busy}
                  title={item.title}
                  aria-current={item.active ? "page" : undefined}
                  onClick={() => item.onClick?.()}
                  className={workspaceSidebarNavItemClass({
                    active: item.active,
                    disabled: item.disabled || c.busy,
                  })}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}

            <div>
              <button
                type="button"
                disabled={c.busy}
                aria-current={page === "glossary" ? "page" : undefined}
                onClick={() => navigateWelcomePage("glossary", glossaryWorkspaceId)}
                className={workspaceSidebarNavItemClass({ active: page === "glossary", disabled: c.busy })}
              >
                <BookOpen className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                <span>热词与记忆</span>
              </button>
              {page === "glossary" ? (
                <ul className="m-0 list-none flex flex-col gap-0.5 p-0 pt-0.5" aria-label="热词与记忆子工作区">
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
                          className={workspaceSidebarSubNavItemClass(selected)}
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
      <div className="mt-auto shrink-0 border-t border-notion-divider bg-notion-sidebar" aria-label="侧栏工具">
        <div
          className={WORKSPACE_SIDEBAR_FOOTER_GRID}
          style={{ gridTemplateColumns: `repeat(${footerItems.length}, minmax(0, 1fr))` }}
        >
          {footerItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={workspaceSidebarFooterItemClass({ active: false })}
              disabled={c.busy}
              aria-label={item.ariaLabel ?? item.label}
              title={item.title ?? item.label}
              onClick={item.onClick}
            >
              {item.icon}
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
