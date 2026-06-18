import { Check, Circle } from "lucide-react";
import { CONTROL_BTN_LINK, CONTROL_BTN_TOOLBAR_GHOST } from "../config/controlStyles";
import { listPendingOnboardingSteps } from "../services/onboarding/onboardingActivity";
import { ONBOARDING_STEPS } from "../services/onboarding/onboardingChecklist";
import type { OnboardingProgress } from "../services/onboarding/onboardingProgress";
import type { ActivityFeedItem } from "../services/ui/activityFeed";
import { ACTIVITY_FEED_MAX_ITEMS } from "../services/ui/activityFeed";
import {
  activityFeedRowSurfaceClass,
  ACTIVITY_FEED_ACTION_CELL_CLASS,
  ACTIVITY_FEED_DOT_CELL_CLASS,
  ACTIVITY_FEED_ICON_CELL_CLASS,
  ACTIVITY_FEED_MESSAGE_CLASS,
  ACTIVITY_FEED_ROW_TEXT_CLASS,
  ACTIVITY_FEED_STATUS_MARK_CLASS,
  formatActivityRelativeTime,
  resolveActivityContextLabel,
  resolveActivityKindLabel,
} from "../services/ui/activityFeedPresentation";
import { editorShortcutMenuHint } from "../utils/editorShortcutMenuHint";
import {
  WELCOME_TOPBAR_DROPDOWN_HEADER_INSET_CLASS,
  WELCOME_TOPBAR_DROPDOWN_HEADER_STRIP_CLASS,
  WELCOME_TOPBAR_DROPDOWN_PANEL_CLASS,
} from "../config/workspaceShellLayout";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type Props = {
  feedItems: readonly ActivityFeedItem[];
  onboardingProgress: OnboardingProgress;
  unreadFeedCount: number;
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

function variantDotClass(variant: ActivityFeedItem["variant"]): string {
  switch (variant) {
    case "success":
      return "bg-zen-success";
    case "warning":
      return "bg-zen-status-warn";
    default:
      return "bg-zen-cinnabar";
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 py-0.5 text-label font-medium leading-none text-notion-text-light">{children}</p>
  );
}

function MetaDot() {
  return (
    <span className="text-notion-text-light" aria-hidden>
      ·
    </span>
  );
}

function ActivityFeedRow({
  item,
  onAction,
}: {
  item: ActivityFeedItem;
  onAction: (item: ActivityFeedItem) => void;
}) {
  const kindLabel = resolveActivityKindLabel(item);
  const contextLabel = resolveActivityContextLabel(item);
  const timeLabel = formatActivityRelativeTime(item.at);

  return (
    <li className={activityFeedRowSurfaceClass(item.read)}>
      <div className={`flex items-start gap-1.5 ${ACTIVITY_FEED_ROW_TEXT_CLASS}`}>
        <span className={ACTIVITY_FEED_DOT_CELL_CLASS} aria-hidden>
          <span className={`${ACTIVITY_FEED_STATUS_MARK_CLASS} ${variantDotClass(item.variant)}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`${ACTIVITY_FEED_MESSAGE_CLASS} ${item.read ? "text-notion-text" : "font-medium text-notion-text"}`}
          >
            {item.message}
          </p>
          <div className="mt-px flex min-w-0 flex-wrap items-center gap-x-1 text-label leading-tight text-notion-text-muted">
          {kindLabel ? (
            <span className="shrink-0 rounded bg-notion-sidebar-hover px-1 py-px text-notion-text-muted">
              {kindLabel}
            </span>
          ) : null}
          {contextLabel ? (
            <span className="max-w-[11rem] truncate" title={contextLabel}>
              {contextLabel}
            </span>
          ) : null}
          {contextLabel || kindLabel ? <MetaDot /> : null}
          <span className="shrink-0">{timeLabel}</span>
          {item.actionLabel ? (
            <>
              <MetaDot />
              <button
                type="button"
                className={`${CONTROL_BTN_LINK} -my-0.5 inline shrink-0 px-0 py-0 text-label leading-tight`}
                onClick={() => onAction(item)}
              >
                {item.actionLabel}
              </button>
            </>
          ) : null}
          </div>
        </div>
        <div className={ACTIVITY_FEED_ACTION_CELL_CLASS}>
          {item.read ? (
            <Check
              className={`${LUCIDE_ICON_SIZE_SM} shrink-0 text-notion-text-light`}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
          ) : (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zen-cinnabar" aria-label="未读" />
          )}
        </div>
      </div>
    </li>
  );
}

export function WelcomeActivityPanel({
  feedItems,
  onboardingProgress,
  unreadFeedCount,
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
  const showFooter = hasOnboarding || hasFeed;

  return (
    <div
      className={`${WELCOME_TOPBAR_DROPDOWN_PANEL_CLASS} z-[100]`}
      role="dialog"
      aria-label="活动与提醒"
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
          {hasOnboarding ? (
            <section aria-label="上手待办">
              <div className="flex items-center justify-between gap-1 pr-1">
                <SectionLabel>上手待办</SectionLabel>
                {onDismissOnboarding ? (
                  <button
                    type="button"
                    className={`${CONTROL_BTN_TOOLBAR_GHOST} px-1.5 py-0.5 text-label text-notion-text-muted`}
                    onClick={onDismissOnboarding}
                  >
                    不再提示
                  </button>
                ) : null}
              </div>
              <ul className="m-0 list-none p-0">
                {pendingSteps.map((step) => {
                  const stepIndex = ONBOARDING_STEPS.findIndex((row) => row.id === step.id);
                  const stepNumber = stepIndex >= 0 ? stepIndex + 1 : 0;
                  return (
                    <li key={step.id} className="px-2 py-1 hover:bg-notion-sidebar-hover">
                      <div className={`flex items-start gap-1.5 ${ACTIVITY_FEED_ROW_TEXT_CLASS}`}>
                        <span className={ACTIVITY_FEED_ICON_CELL_CLASS} aria-hidden>
                          <Circle
                            className={`${LUCIDE_ICON_SIZE_SM} shrink-0 text-zen-status-warn`}
                            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`${ACTIVITY_FEED_MESSAGE_CLASS} font-medium text-notion-text`}>
                            {stepNumber > 0 ? `${stepNumber}. ` : ""}
                            {step.title}
                          </p>
                          <p className={`${ACTIVITY_FEED_MESSAGE_CLASS} mt-px text-label leading-tight text-notion-text-muted`}>
                            {step.description}
                          </p>
                          {step.id === "asr_ready" ? (
                            <button
                              type="button"
                              className={`${CONTROL_BTN_LINK} mt-0.5 inline px-0 py-0 text-label leading-tight`}
                              onClick={() => onOnboardingAction(step.id)}
                            >
                              打开本机 ASR
                            </button>
                          ) : null}
                          {step.id === "project_audio" && canCreateProject ? (
                            <button
                              type="button"
                              className={`${CONTROL_BTN_LINK} mt-0.5 inline px-0 py-0 text-label leading-tight`}
                              onClick={() => onOnboardingAction(step.id)}
                            >
                              新建项目
                            </button>
                          ) : null}
                          {step.id === "transcribe" && inEditorFile && onStartTranscribe ? (
                            <button
                              type="button"
                              className={`${CONTROL_BTN_LINK} mt-0.5 inline px-0 py-0 text-label leading-tight`}
                              onClick={onStartTranscribe}
                            >
                              开始转写
                            </button>
                          ) : null}
                          {step.id === "export" && inEditorFile && onOpenDeliveryMode ? (
                            <button
                              type="button"
                              className={`${CONTROL_BTN_LINK} mt-0.5 inline px-0 py-0 text-label leading-tight`}
                              onClick={onOpenDeliveryMode}
                            >
                              进入定稿模式
                            </button>
                          ) : null}
                          {step.id === "export" && !inEditorFile ? (
                            <button
                              type="button"
                              className={`${CONTROL_BTN_LINK} mt-0.5 inline px-0 py-0 text-label leading-tight`}
                              onClick={onOpenLastEditor}
                            >
                              打开上次编辑
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {hasOnboarding && hasFeed ? (
            <hr className="mx-2 my-0.5 border-0 border-t border-notion-border" />
          ) : null}

          {hasFeed ? (
            <section aria-label="最近提醒">
              <SectionLabel>
                最近提醒
                {unreadFeedCount > 0 ? (
                  <span className="ml-1 font-normal text-notion-text-muted">({unreadFeedCount})</span>
                ) : null}
              </SectionLabel>
              <ul className="m-0 list-none p-0">
                {feedItems.map((item) => (
                  <ActivityFeedRow key={item.id} item={item} onAction={onActivityAction} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      {showFooter ? (
        <div className="border-t border-notion-border px-2 py-1 text-label leading-tight text-notion-text-muted">
          {hasFeed ? (
            <span>
              保留最近 {ACTIVITY_FEED_MAX_ITEMS} 条
              {feedItems.length > 0 ? ` · 共 ${feedItems.length} 条` : ""}
            </span>
          ) : (
            <span>完成上手步骤后可关闭此提示</span>
          )}
          <span className="text-notion-text-light" aria-hidden>
            {" "}
            ·{" "}
          </span>
          <span>{activityHint} 开关收件箱</span>
        </div>
      ) : null}
    </div>
  );
}
