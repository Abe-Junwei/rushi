import type { ReactNode } from "react";
import { WorkspaceSidebarCollapseProvider } from "../context/WorkspaceSidebarCollapseContext";
import { useWorkspaceSidebarCollapseContext } from "../hooks/useWorkspaceSidebarCollapseContext";
import { WorkspaceShellLayout } from "./WorkspaceShellLayout";

type CollapsibleWorkspaceShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  purpose?: string;
};

function CollapsibleWorkspaceShellInner({
  sidebar,
  children,
  purpose,
}: CollapsibleWorkspaceShellProps) {
  const { collapsed, setCollapsed } = useWorkspaceSidebarCollapseContext();
  return (
    <WorkspaceShellLayout
      purpose={purpose}
      collapsible
      sidebarCollapsed={collapsed}
      onSidebarCollapsedChange={setCollapsed}
      sidebar={sidebar}
    >
      {children}
    </WorkspaceShellLayout>
  );
}

/**
 * Editor workspace shell — sidebar collapse state lives here so ProjectPanel /
 * EditorView (waveform) do not re-render on toggle (Jieyu / VS Code pattern).
 */
export function CollapsibleWorkspaceShell({ sidebar, children, purpose }: CollapsibleWorkspaceShellProps) {
  return (
    <WorkspaceSidebarCollapseProvider>
      <CollapsibleWorkspaceShellInner purpose={purpose} sidebar={sidebar}>
        {children}
      </CollapsibleWorkspaceShellInner>
    </WorkspaceSidebarCollapseProvider>
  );
}
