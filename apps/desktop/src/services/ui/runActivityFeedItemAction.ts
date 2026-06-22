import { runDeliveryModeTranscribeAction } from "../deliveryModeTranscribeToast";
import { runActivityFeedAction, type ActivityFeedItem } from "./activityFeed";

export type ActivityFeedNavigationDeps = {
  currentProjectId: string | null | undefined;
  loadProject: (projectId: string) => Promise<void>;
  openFile: (fileId: string) => Promise<void>;
  openWorkspaceFile?: (projectId: string, fileId: string) => Promise<void>;
};

export async function runActivityFeedItemAction(
  item: ActivityFeedItem,
  deps: ActivityFeedNavigationDeps,
): Promise<void> {
  if (item.actionKind === "open-file" && item.projectId && item.fileId) {
    const { projectId, fileId } = item;
    if (deps.openWorkspaceFile) {
      await deps.openWorkspaceFile(projectId, fileId);
      return;
    }
    if (deps.currentProjectId !== projectId) {
      await deps.loadProject(projectId);
    }
    await deps.openFile(fileId);
    return;
  }
  if (item.actionKind === "open-project-hub" && item.projectId) {
    await deps.loadProject(item.projectId);
    return;
  }
  if (item.actionKind === "delivery-mode") {
    runDeliveryModeTranscribeAction();
    return;
  }
  runActivityFeedAction(item.id);
}
