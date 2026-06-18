import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { MAIN_SHELL_SURFACE_CLASS } from "../config/shellVisualTokens";
import { List, Settings } from "lucide-react";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { GlossaryWorkspaceId } from "./glossary/glossaryWorkspaceTypes";
import type { WelcomePageId } from "./welcomeTypes";
import {
  WORKSPACE_SIDEBAR_FOOTER_GRID,
  WORKSPACE_SIDEBAR_PANEL_ATTR,
  workspaceSidebarFooterItemClass,
} from "../config/workspaceShellLayout";
import { useWelcomeSidebarProjectTree } from "../hooks/useWelcomeSidebarProjectTree";
import { editorShortcutMenuHint } from "../utils/editorShortcutMenuHint";
import { sortWelcomeProjects } from "./welcomeSidebarFormatters";
import { WelcomeSidebarProjectList } from "./WelcomeSidebarProjectList";
import { WelcomeSidebarNav } from "./WelcomeSidebarNav";
import { CspLayout } from "./CspLayout";

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
  embeddedInCollapsibleShell: _embeddedInCollapsibleShell = false,
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

  const scrollToProjectList = useCallback(() => {
    window.requestAnimationFrame(() => {
      projectListRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, []);

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

  return (
    <aside
      {...{ [WORKSPACE_SIDEBAR_PANEL_ATTR]: "" }}
      className={`flex h-full min-h-0 w-full max-w-full shrink-0 flex-col ${MAIN_SHELL_SURFACE_CLASS.sidebarBg}`}
    >
      <WelcomeSidebarNav
        controller={c}
        page={page}
        inProjectContext={inProjectContext}
        editorMode={editorMode}
        glossaryWorkspaceId={glossaryWorkspaceId}
        onPageChange={onPageChange}
        onLeaveProjectForWelcome={onLeaveProjectForWelcome}
        onGlossaryWorkspaceChange={onGlossaryWorkspaceChange}
        onOpenEditor={handleOpenEditor}
        onScrollToProjectList={scrollToProjectList}
      />
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
          <p className="text-title leading-relaxed text-notion-text-muted">
            全局设置：术语表→转写热词；纠错记忆→编辑规则。
          </p>
        </div>
      )}
      <div className={`mt-auto shrink-0 border-t ${MAIN_SHELL_SURFACE_CLASS.border} ${MAIN_SHELL_SURFACE_CLASS.sidebarBg}`} aria-label="侧栏工具">
        <CspLayout
          className={WORKSPACE_SIDEBAR_FOOTER_GRID}
          layout={{ gridTemplateColumns: `repeat(${footerItems.length}, minmax(0, 1fr))` }}
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
        </CspLayout>
      </div>
    </aside>
  );
}
