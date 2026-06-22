import type { WorkspaceFileTarget } from "../services/lastWorkspace";

/** Welcome / hub / editor shell routing from project + file open state. */
export function resolveWorkspaceShellVariant(input: {
  hasCurrentProject: boolean;
  currentFileId: string | null;
  openingWorkspaceTarget: WorkspaceFileTarget | null;
}): "welcome" | "hub" | "editor" {
  if (input.openingWorkspaceTarget && !input.currentFileId) {
    return "editor";
  }
  if (!input.hasCurrentProject) return "welcome";
  if (!input.currentFileId) return "hub";
  return "editor";
}
