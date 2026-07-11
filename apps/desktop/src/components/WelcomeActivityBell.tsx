import { Bell } from "lucide-react";
import { CONTROL_BTN_TOOLBAR_GHOST, CONTROL_BTN_WELCOME_ICON } from "../config/controlStyles";
import { useWelcomeActivityController } from "../hooks/useWelcomeActivityController";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { editorShortcutMenuHint } from "../utils/editorShortcutMenuHint";
import { WelcomeActivityPanel } from "./WelcomeActivityPanel";

type Props = {
  controller: ProjectControllerApi;
  disabled?: boolean;
  onOpenAsrSettings?: () => void;
  onOpenOnlineSttSettings?: () => void;
  onCreateProject?: () => void;
  onStartTranscribe?: () => void;
  onOpenDeliveryMode?: () => void;
  inEditorFile?: boolean;
  panelId?: string;
  variant?: "welcome" | "toolbar";
  onPanelOpen?: () => void;
};

export function WelcomeActivityBell({
  controller,
  disabled = false,
  onOpenAsrSettings,
  onOpenOnlineSttSettings,
  onCreateProject,
  onStartTranscribe,
  onOpenDeliveryMode,
  inEditorFile = false,
  panelId = "welcome-activity-panel",
  variant = "welcome",
  onPanelOpen,
}: Props) {
  const activity = useWelcomeActivityController({
    controller,
    onOpenAsrSettings,
    onOpenOnlineSttSettings,
    onCreateProject,
    onStartTranscribe,
    onPanelOpen,
  });

  const iconClass = variant === "welcome" ? LUCIDE_ICON_SIZE_LG : LUCIDE_ICON_SIZE_MD;
  const buttonClass =
    variant === "welcome" ? CONTROL_BTN_WELCOME_ICON : `${CONTROL_BTN_TOOLBAR_GHOST} relative`;

  const activityHint = editorShortcutMenuHint("workflow.openActivityInbox");

  const handleOpenDeliveryMode = () => {
    activity.closePanel();
    onOpenDeliveryMode?.();
  };

  return (
    <div ref={activity.rootRef} className="relative">
      <button
        type="button"
        className={buttonClass}
        aria-label="活动与提醒"
        aria-expanded={activity.open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={activity.togglePanel}
        onKeyDown={activity.handleBellKeyDown}
        title={`活动与提醒 (${activityHint})`}
      >
        <Bell className={iconClass} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        {activity.showBadge ? (
          <span
            className="absolute right-1 top-1 h-2 w-2 rounded-full border border-notion-bg bg-zen-cinnabar"
            aria-hidden
          />
        ) : null}
        {variant === "toolbar" ? <span className="sr-only">活动与提醒</span> : null}
      </button>
      {activity.open ? (
        <div id={panelId}>
          <WelcomeActivityPanel
            feedItems={activity.feedItems}
            onboardingProgress={activity.onboardingProgress}
            unreadFeedCount={activity.unreadFeedCount}
            transcribeSource={activity.effectiveTranscribeSource}
            onMarkAllRead={activity.markAllRead}
            onClearHistory={activity.clearHistory}
            onOnboardingAction={activity.handleOnboardingAction}
            onOpenLastEditor={activity.openLastEditor}
            onStartTranscribe={activity.startTranscribe}
            onActivityAction={activity.handleActivityAction}
            onDismissOnboarding={activity.dismissOnboarding}
            onOpenDeliveryMode={onOpenDeliveryMode ? handleOpenDeliveryMode : undefined}
            canCreateProject={activity.canCreateProject}
            inEditorFile={inEditorFile}
          />
        </div>
      ) : null}
    </div>
  );
}
