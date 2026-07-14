import { useCallback, useRef, type ReactNode } from "react";
import { MAIN_SHELL_SURFACE_CLASS } from "../config/shellVisualTokens";
import {
  IconChevronLeft as ChevronLeft,
} from "@tabler/icons-react";
import { usePanelAutoCollapse } from "../hooks/usePanelAutoCollapse";
import {
  WORKSPACE_EDITOR_SHELL_PURPOSE,
  WORKSPACE_SHELL_COLLAPSIBLE_CLASS,
  WORKSPACE_SHELL_GRID_CLASS,
  WORKSPACE_SIDEBAR_PANEL_ATTR,
  WORKSPACE_SIDEBAR_TOGGLE_ATTR,
} from "../config/workspaceShellLayout";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

interface WorkspaceShellLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  purpose?: string;
  /** 仅编辑页：允许折叠侧栏 */
  collapsible?: boolean;
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
}

/** 欢迎页 / 项目 Hub / 编辑页：左全高侧栏 + 右主区 */
export function WorkspaceShellLayout({
  sidebar,
  children,
  purpose,
  collapsible = false,
  sidebarCollapsed = false,
  onSidebarCollapsedChange,
}: WorkspaceShellLayoutProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);

  usePanelAutoCollapse({
    enabled: collapsible,
    isCollapsed: sidebarCollapsed,
    setIsCollapsed: (next) => onSidebarCollapsedChange?.(next),
    boundaryRef: shellRef,
    panelSelector: `[${WORKSPACE_SIDEBAR_PANEL_ATTR}]`,
    toggleSelector: `[${WORKSPACE_SIDEBAR_TOGGLE_ATTR}]`,
  });

  const onToggleSidebar = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onSidebarCollapsedChange?.(!sidebarCollapsed);
    },
    [onSidebarCollapsedChange, sidebarCollapsed],
  );

  const shellClassName = [
    collapsible ? WORKSPACE_SHELL_COLLAPSIBLE_CLASS : WORKSPACE_SHELL_GRID_CLASS,
    collapsible && sidebarCollapsed ? "workspace-shell-sidebar-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={shellRef}
      className={shellClassName}
      data-purpose={purpose}
    >
      <div className="workspace-shell-sidebar-column relative flex h-full min-h-0 min-w-0 flex-col">
        <div
          className={[
            "workspace-shell-sidebar-content flex h-full min-h-0 flex-1 flex-col",
            collapsible && sidebarCollapsed ? "pointer-events-none overflow-hidden" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {sidebar}
        </div>
        {collapsible ? (
          <button
            type="button"
            {...{ [WORKSPACE_SIDEBAR_TOGGLE_ATTR]: "" }}
            className={`workspace-shell-sidebar-toggle ${MAIN_SHELL_SURFACE_CLASS.sidebarBg} bg-notion-sidebar`}
            aria-expanded={!sidebarCollapsed}
            aria-hidden={sidebarCollapsed}
            tabIndex={sidebarCollapsed ? -1 : 0}
            aria-label="折叠侧栏"
            title="折叠侧栏"
            onClick={onToggleSidebar}
          >
            <ChevronLeft
              className={LUCIDE_ICON_SIZE_SM}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      <div className={`workspace-shell-main flex min-h-0 min-w-0 flex-col ${MAIN_SHELL_SURFACE_CLASS.pageBg}`}>{children}</div>
    </div>
  );
}

export { WORKSPACE_EDITOR_SHELL_PURPOSE };
