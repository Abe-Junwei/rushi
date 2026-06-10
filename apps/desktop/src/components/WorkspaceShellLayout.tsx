import { useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import { PanelLeftClose } from "lucide-react";
import { usePanelAutoCollapse } from "../hooks/usePanelAutoCollapse";
import {
  WORKSPACE_EDITOR_SHELL_PURPOSE,
  WORKSPACE_SHELL_COLLAPSIBLE_CLASS,
  WORKSPACE_SHELL_GRID_CLASS,
  WORKSPACE_SIDEBAR_PANEL_ATTR,
  WORKSPACE_SIDEBAR_TOGGLE_ATTR,
  WORKSPACE_SIDEBAR_WIDTH,
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

  const shellStyle = collapsible
    ? ({
        ["--workspace-sidebar-width" as const]: sidebarCollapsed
          ? "0px"
          : WORKSPACE_SIDEBAR_WIDTH,
      } as CSSProperties)
    : undefined;

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
      style={shellStyle}
    >
      <div className="workspace-shell-sidebar-column relative flex h-full min-h-0 min-w-0 flex-col">
        <div
          className={[
            "flex h-full min-h-0 flex-1 flex-col transition-opacity duration-200 ease-out",
            collapsible && sidebarCollapsed
              ? "pointer-events-none overflow-hidden opacity-0"
              : "opacity-100",
          ].join(" ")}
        >
          {sidebar}
        </div>
        {collapsible && !sidebarCollapsed ? (
          <button
            type="button"
            {...{ [WORKSPACE_SIDEBAR_TOGGLE_ATTR]: "" }}
            className="workspace-shell-sidebar-toggle border-0 bg-notion-sidebar"
            aria-expanded
            aria-label="折叠侧栏"
            title="折叠侧栏"
            onClick={onToggleSidebar}
          >
            <PanelLeftClose
              className={LUCIDE_ICON_SIZE_SM}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      <div className="workspace-shell-main flex min-h-0 min-w-0 flex-col bg-notion-bg">{children}</div>
    </div>
  );
}

export { WORKSPACE_EDITOR_SHELL_PURPOSE };
