import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useWorkspaceSidebarCollapse } from "../hooks/useWorkspaceSidebarCollapse";

export type WorkspaceSidebarCollapseContextValue = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  expand: () => void;
  toggle: () => void;
};

const WorkspaceSidebarCollapseContext = createContext<WorkspaceSidebarCollapseContextValue | null>(
  null,
);

export function WorkspaceSidebarCollapseProvider({ children }: { children: ReactNode }) {
  const { collapsed, setCollapsed, toggleCollapsed } = useWorkspaceSidebarCollapse();
  const value = useMemo<WorkspaceSidebarCollapseContextValue>(
    () => ({
      collapsed,
      setCollapsed,
      expand: () => setCollapsed(false),
      toggle: toggleCollapsed,
    }),
    [collapsed, setCollapsed, toggleCollapsed],
  );
  return (
    <WorkspaceSidebarCollapseContext.Provider value={value}>
      {children}
    </WorkspaceSidebarCollapseContext.Provider>
  );
}

export function useWorkspaceSidebarCollapseContext(): WorkspaceSidebarCollapseContextValue {
  const ctx = useContext(WorkspaceSidebarCollapseContext);
  if (!ctx) {
    throw new Error("useWorkspaceSidebarCollapseContext must be used within WorkspaceSidebarCollapseProvider");
  }
  return ctx;
}

export function useOptionalWorkspaceSidebarCollapseContext(): WorkspaceSidebarCollapseContextValue | null {
  return useContext(WorkspaceSidebarCollapseContext);
}
