import { CONTROL_BTN_TOOLBAR_GHOST } from "../config/controlStyles";
import type { OnboardingProgress } from "../services/onboarding/onboardingProgress";
import { listPendingOnboardingSteps } from "../services/onboarding/onboardingActivity";
import type { TranscribeSource } from "../services/stt/transcribeSource";
import type { ActivityFeedItem } from "../services/ui/activityFeed";
import { editorShortcutMenuHint } from "../utils/editorShortcutMenuHint";
import {
  WELCOME_TOPBAR_DROPDOWN_HEADER_INSET_CLASS,
  WELCOME_TOPBAR_DROPDOWN_HEADER_STRIP_CLASS,
  WELCOME_TOPBAR_DROPDOWN_PANEL_CLASS,
} from "../config/workspaceShellLayout";
import {
  WelcomeActivityFeedFooter,
  WelcomeActivityFeedSection,
} from "./WelcomeActivityFeedSection";
import { WelcomeActivityOnboardingSection } from "./WelcomeActivityOnboardingSection";

type Props = {
  feedItems: readonly ActivityFeedItem[];
  onboardingProgress: OnboardingProgress;
  unreadFeedCount: number;
  transcribeSource: TranscribeSource;
  onMarkAllRead: () => void;
  onClearHistory: () => void;
  onOnboardingAction: (stepId: string) => void;
  onOpenLastEditor: () => void;
  onStartTranscribe?: () => void;
  onActivityAction: (item: ActivityFeedItem) => void;
  onDismissOnboarding?: () => void;
  onOpenDeliveryMode?: () => void;
  canCreateProject?: boolean;
  inEditorFile?: boolean;
};

export function WelcomeActivityPanel({
  feedItems,
  onboardingProgress,
  unreadFeedCount,
  transcribeSource,
  onMarkAllRead,
  onClearHistory,
  onOnboardingAction,
  onOpenLastEditor,
  onStartTranscribe,
  onActivityAction,
  onDismissOnboarding,
  onOpenDeliveryMode,
  canCreateProject = false,
  inEditorFile = false,
}: Props) {
  const pendingSteps = listPendingOnboardingSteps(onboardingProgress);
  const hasOnboarding = pendingSteps.length > 0;
  const hasFeed = feedItems.length > 0;
  const activityHint = editorShortcutMenuHint("workflow.openActivityInbox");

  return (
    <div
      className={`${WELCOME_TOPBAR_DROPDOWN_PANEL_CLASS} z-[100]`}
      role="region"
      aria-label="活动"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        className={`flex items-center justify-between gap-1 ${WELCOME_TOPBAR_DROPDOWN_HEADER_STRIP_CLASS} ${WELCOME_TOPBAR_DROPDOWN_HEADER_INSET_CLASS}`}
      >
        <p className="m-0 min-w-0 truncate text-sm font-medium leading-none text-notion-text">活动与提醒</p>
        {hasFeed ? (
          <div className="flex shrink-0 items-center gap-px">
            {unreadFeedCount > 0 ? (
              <button
                type="button"
                className={`${CONTROL_BTN_TOOLBAR_GHOST} px-1.5 py-0.5 text-label`}
                onClick={onMarkAllRead}
              >
                全部标为已读
              </button>
            ) : null}
            <button
              type="button"
              className={`${CONTROL_BTN_TOOLBAR_GHOST} px-1.5 py-0.5 text-label text-notion-text-muted`}
              onClick={onClearHistory}
            >
              清空历史
            </button>
          </div>
        ) : null}
      </div>

      {!hasOnboarding && !hasFeed ? (
        <p className="px-2 py-2 text-sm text-notion-text-muted">暂无新提醒</p>
      ) : (
        <div className="max-h-80 overflow-y-auto py-0.5">
          <WelcomeActivityOnboardingSection
            pendingSteps={pendingSteps}
            canCreateProject={canCreateProject}
            inEditorFile={inEditorFile}
            transcribeSource={transcribeSource}
            onOnboardingAction={onOnboardingAction}
            onStartTranscribe={onStartTranscribe}
            onOpenLastEditor={onOpenLastEditor}
            onOpenDeliveryMode={onOpenDeliveryMode}
            onDismissOnboarding={onDismissOnboarding}
          />

          {hasOnboarding && hasFeed ? (
            <hr className="mx-2 my-0.5 border-0 border-t border-notion-border" />
          ) : null}

          <WelcomeActivityFeedSection
            feedItems={feedItems}
            unreadFeedCount={unreadFeedCount}
            onActivityAction={onActivityAction}
          />
        </div>
      )}

      <WelcomeActivityFeedFooter
        feedItems={feedItems}
        hasOnboarding={hasOnboarding}
        activityHint={activityHint}
      />
    </div>
  );
}
