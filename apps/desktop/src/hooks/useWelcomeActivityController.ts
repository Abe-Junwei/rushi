import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { useActivityFeedSnapshot } from "./useActivityFeedSnapshot";
import { useActivityInboxPanel } from "./useActivityInboxPanel";
import { countPendingOnboardingSteps } from "../services/onboarding/onboardingActivity";
import { ONBOARDING_PROGRESS_CHANGED_EVENT } from "../services/onboarding/onboardingProgress";
import type { ActivityFeedItem } from "../services/ui/activityFeed";
import { runActivityFeedItemAction } from "../services/ui/runActivityFeedItemAction";
import { useOnboardingChecklistController } from "./useOnboardingChecklistController";

type Args = {
  controller: ProjectControllerApi;
  onOpenAsrSettings?: () => void;
  onCreateProject?: () => void;
  onStartTranscribe?: () => void;
  onPanelOpen?: () => void;
};

export function useWelcomeActivityController({
  controller,
  onOpenAsrSettings,
  onCreateProject,
  onStartTranscribe,
  onPanelOpen,
}: Args) {
  const onboarding = useOnboardingChecklistController();
  const [, bumpOnboarding] = useState(0);
  const {
    open,
    rootRef,
    closePanel,
    togglePanel,
    markAllRead,
    clearHistory,
    handleBellKeyDown,
  } = useActivityInboxPanel({ onPanelOpen });
  const { feedItems, unreadFeedCount } = useActivityFeedSnapshot();

  useEffect(() => {
    const refresh = () => bumpOnboarding((n) => n + 1);
    window.addEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, refresh);
    };
  }, []);

  const pendingOnboardingCount = useMemo(
    () => countPendingOnboardingSteps(onboarding.progress),
    [onboarding.progress],
  );

  const showBadge = unreadFeedCount > 0 || pendingOnboardingCount > 0;

  const openLastEditor = useCallback(() => {
    closePanel();
    void controller.openLastEditorWorkspace();
  }, [closePanel, controller]);

  const handleOnboardingAction = useCallback(
    (stepId: string) => {
      closePanel();
      if (stepId === "asr_ready") {
        onOpenAsrSettings?.();
        return;
      }
      if (stepId === "project_audio") {
        onCreateProject?.();
      }
    },
    [closePanel, onCreateProject, onOpenAsrSettings],
  );

  const startTranscribe = useCallback(() => {
    closePanel();
    onStartTranscribe?.();
  }, [closePanel, onStartTranscribe]);

  const handleActivityAction = useCallback(
    (item: ActivityFeedItem) => {
      closePanel();
      void runActivityFeedItemAction(item, {
        currentProjectId: controller.current?.id,
        loadProject: (id) => controller.loadProject(id),
        openFile: (id) => controller.openFile(id),
        openWorkspaceFile: (projectId, fileId) =>
          controller.openWorkspaceFile(projectId, fileId),
      });
    },
    [closePanel, controller],
  );

  const dismissOnboarding = useCallback(() => {
    closePanel();
    onboarding.dismiss();
  }, [closePanel, onboarding]);

  return {
    open,
    rootRef,
    closePanel,
    togglePanel,
    markAllRead,
    clearHistory,
    handleBellKeyDown,
    showBadge,
    feedItems,
    unreadFeedCount,
    onboardingProgress: onboarding.progress,
    pendingOnboardingCount,
    openLastEditor,
    handleOnboardingAction,
    startTranscribe,
    handleActivityAction,
    dismissOnboarding,
    canCreateProject: Boolean(onCreateProject),
  };
}
