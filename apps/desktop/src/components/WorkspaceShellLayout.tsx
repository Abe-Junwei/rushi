import type { ReactNode } from "react";
import { WORKSPACE_SHELL_GRID_CLASS } from "../config/workspaceShellLayout";

interface WorkspaceShellLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  purpose?: string;
}

/** 欢迎页 / 项目 Hub 共用：左全高侧栏 + 右 TopBar 与主区 */
export function WorkspaceShellLayout({ sidebar, children, purpose }: WorkspaceShellLayoutProps) {
  return (
    <div className={WORKSPACE_SHELL_GRID_CLASS} data-purpose={purpose}>
      {sidebar}
      <div className="flex min-h-0 min-w-0 flex-col bg-notion-bg">{children}</div>
    </div>
  );
}
