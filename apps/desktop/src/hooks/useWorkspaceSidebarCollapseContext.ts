import { useContext } from "react";
import { WorkspaceSidebarCollapseContext, type WorkspaceSidebarCollapseContextValue } from "../context/WorkspaceSidebarCollapseContext";

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
