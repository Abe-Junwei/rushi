import { Circle } from "lucide-react";
import { CONTROL_BTN_LINK, CONTROL_BTN_TOOLBAR_GHOST } from "../config/controlStyles";
import {
  ACTIVITY_FEED_MARK_CELL_CLASS,
  ACTIVITY_FEED_MESSAGE_CLASS,
  ACTIVITY_FEED_ROW_TEXT_CLASS,
} from "../services/ui/activityFeedPresentation";
import {
  ONBOARDING_STEPS,
  resolveOnboardingTranscribeEnvStep,
  type OnboardingStepDef,
} from "../services/onboarding/onboardingChecklist";
import type { TranscribeSource } from "../services/stt/transcribeSource";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 py-0.5 text-label font-medium leading-none text-notion-text-light">{children}</p>
  );
}

type Props = {
  pendingSteps: OnboardingStepDef[];
  canCreateProject: boolean;
  inEditorFile: boolean;
  transcribeSource: TranscribeSource;
  onOnboardingAction: (stepId: string) => void;
  onStartTranscribe?: () => void;
  onOpenLastEditor?: () => void;
  onOpenDeliveryMode?: () => void;
  onDismissOnboarding?: () => void;
};

export function WelcomeActivityOnboardingSection({
  pendingSteps,
  canCreateProject,
  inEditorFile,
  transcribeSource,
  onOnboardingAction,
  onStartTranscribe,
  onOpenLastEditor,
  onOpenDeliveryMode,
  onDismissOnboarding,
}: Props) {
  if (pendingSteps.length === 0) return null;

  const transcribeEnvStep = resolveOnboardingTranscribeEnvStep(transcribeSource);

  return (
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
          const title = step.id === "asr_ready" ? transcribeEnvStep.title : step.title;
          const description =
            step.id === "asr_ready" ? transcribeEnvStep.description : step.description;
          return (
            <li key={step.id} className="px-2 py-1 hover:bg-notion-sidebar-hover">
              <div className={`flex items-start gap-1.5 ${ACTIVITY_FEED_ROW_TEXT_CLASS}`}>
                <span className={ACTIVITY_FEED_MARK_CELL_CLASS} aria-hidden>
                  <Circle
                    className={`${LUCIDE_ICON_SIZE_SM} shrink-0 text-zen-status-warn`}
                    strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`${ACTIVITY_FEED_MESSAGE_CLASS} font-medium text-notion-text`}>
                    {stepNumber > 0 ? `${stepNumber}. ` : ""}
                    {title}
                  </p>
                  <p
                    className={`${ACTIVITY_FEED_MESSAGE_CLASS} mt-px text-label leading-tight text-notion-text-muted`}
                  >
                    {description}
                  </p>
                  {step.id === "asr_ready" ? (
                    <button
                      type="button"
                      className={`${CONTROL_BTN_LINK} mt-0.5 inline px-0 py-0 text-label leading-tight`}
                      onClick={() => onOnboardingAction(step.id)}
                    >
                      {transcribeSource === "online" ? "打开在线 STT" : "打开本机 ASR"}
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
                  {step.id === "export" && !inEditorFile && onOpenLastEditor ? (
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
  );
}
