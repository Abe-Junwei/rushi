import { Check, Circle, X } from "lucide-react";
import { CONTROL_BTN_LINK, CONTROL_BTN_TOOLBAR_GHOST } from "../config/controlStyles";
import { ENV_NAV } from "../config/environmentNavCopy";
import {
  ONBOARDING_STEPS,
  resolveOnboardingTranscribeEnvStep,
} from "../services/onboarding/onboardingChecklist";
import type { OnboardingProgress } from "../services/onboarding/onboardingProgress";
import type { TranscribeSource } from "../services/stt/transcribeSource";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type Props = {
  progress: OnboardingProgress;
  onDismiss: () => void;
  transcribeSource: TranscribeSource;
  onOpenAsrSettings?: () => void;
  onOpenOnlineSttSettings?: () => void;
  onCreateProject?: () => void;
  onOpenLastEditor?: () => void;
};

export function WelcomeOnboardingChecklist({
  progress,
  onDismiss,
  transcribeSource,
  onOpenAsrSettings,
  onOpenOnlineSttSettings,
  onCreateProject,
  onOpenLastEditor,
}: Props) {
  const transcribeEnvStep = resolveOnboardingTranscribeEnvStep(transcribeSource);
  return (
    <section
      className="rounded-lg border border-notion-divider bg-notion-sidebar/40 p-3"
      aria-labelledby="onboarding-checklist-head"
      data-purpose="onboarding-checklist"
    >
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2
            id="onboarding-checklist-head"
            className="text-body font-semibold leading-snug text-notion-text"
          >
            上手清单
          </h2>
          <p className="text-label leading-snug text-notion-text-muted">
            5 步完成首次转写与交付（可随时关闭，侧栏可恢复）
          </p>
        </div>
        <button
          type="button"
          className={`${CONTROL_BTN_TOOLBAR_GHOST} shrink-0 px-2`}
          aria-label="关闭上手清单"
          onClick={onDismiss}
        >
          <X className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
      </header>

      <ol className="flex flex-col gap-1.5">
        {ONBOARDING_STEPS.map((step, index) => {
          const done = Boolean(progress.completed[step.id]);
          const title =
            step.id === "asr_ready" ? transcribeEnvStep.title : step.title;
          const description =
            step.id === "asr_ready" ? transcribeEnvStep.description : step.description;
          return (
            <li
              key={step.id}
              className="flex items-start gap-2 rounded-md bg-notion-bg/80 px-2 py-1.5"
            >
              <span className="mt-0.5 shrink-0 text-accent-action" aria-hidden>
                {done ? (
                  <Check className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} />
                ) : (
                  <Circle className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-body font-medium leading-snug text-notion-text">
                  {index + 1}. {title}
                  {step.optional ? (
                    <span className="ml-1 font-normal text-notion-text-muted">（可选）</span>
                  ) : null}
                </p>
                <p className="text-label leading-snug text-notion-text-muted">{description}</p>
                {step.id === "asr_ready" && transcribeSource === "online" && onOpenOnlineSttSettings ? (
                  <button
                    type="button"
                    className={`${CONTROL_BTN_LINK} self-start text-label leading-snug`}
                    onClick={onOpenOnlineSttSettings}
                  >
                    打开{ENV_NAV.onlineStt}
                  </button>
                ) : null}
                {step.id === "asr_ready" && transcribeSource !== "online" && onOpenAsrSettings ? (
                  <button
                    type="button"
                    className={`${CONTROL_BTN_LINK} self-start text-label leading-snug`}
                    onClick={onOpenAsrSettings}
                  >
                    打开{ENV_NAV.localAsr}
                  </button>
                ) : null}
                {step.id === "project_audio" && onCreateProject ? (
                  <button
                    type="button"
                    className={`${CONTROL_BTN_LINK} self-start text-label leading-snug`}
                    onClick={onCreateProject}
                  >
                    新建项目
                  </button>
                ) : null}
                {step.id === "export" && onOpenLastEditor ? (
                  <button
                    type="button"
                    className={`${CONTROL_BTN_LINK} self-start text-label leading-snug`}
                    onClick={onOpenLastEditor}
                  >
                    打开上次编辑 → 定稿模式
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
