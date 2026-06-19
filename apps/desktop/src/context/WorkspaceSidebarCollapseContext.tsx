import { createContext, useMemo, type ReactNode } from "react";
import { useWorkspaceSidebarCollapse } from "../hooks/useWorkspaceSidebarCollapse";

export type WorkspaceSidebarCollapseContextValue = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  expand: () => void;
  toggle: () => void;
};

// eslint-disable-next-line react-refresh/only-export-components -- React Context 常量与 Provider 共处是标准模式；Consumer hook 已拆至 hooks/useWorkspaceSidebarCollapseContext.ts
export const WorkspaceSidebarCollapseContext = createContext<WorkspaceSidebarCollapseContextValue | null>(
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

