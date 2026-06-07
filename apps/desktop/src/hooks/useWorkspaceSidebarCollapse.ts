import { useCallback, useEffect, useState } from "react";

export const EDITOR_WORKSPACE_SIDEBAR_COLLAPSED_KEY = "rushi.editor-workspace-sidebar-collapsed";

function readInitialCollapsed(): boolean {
  try {
    return window.localStorage.getItem(EDITOR_WORKSPACE_SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function useWorkspaceSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(EDITOR_WORKSPACE_SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore persistence failures */
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return { collapsed, setCollapsed, toggleCollapsed };
}
