import { Check, Circle, X } from "lucide-react";
import { CONTROL_BTN_LINK, CONTROL_BTN_TOOLBAR_GHOST } from "../config/controlStyles";
import { ONBOARDING_STEPS } from "../services/onboarding/onboardingChecklist";
import type { OnboardingProgress } from "../services/onboarding/onboardingProgress";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type Props = {
  progress: OnboardingProgress;
  onDismiss: () => void;
  onOpenAsrSettings?: () => void;
  onCreateProject?: () => void;
  onOpenLastEditor?: () => void;
};

export function WelcomeOnboardingChecklist({
  progress,
  onDismiss,
  onOpenAsrSettings,
  onCreateProject,
  onOpenLastEditor,
}: Props) {
  return (
    <section
      className="rounded-lg border border-notion-divider bg-notion-sidebar/40 p-4"
      aria-labelledby="onboarding-checklist-head"
      data-purpose="onboarding-checklist"
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="onboarding-checklist-head"
            className="text-[15px] font-semibold leading-snug text-notion-text"
          >
            上手清单
          </h2>
          <p className="text-[12px] leading-relaxed text-notion-text-muted">
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

      <ol className="flex flex-col gap-2">
        {ONBOARDING_STEPS.map((step, index) => {
          const done = Boolean(progress.completed[step.id]);
          return (
            <li
              key={step.id}
              className="flex items-start gap-2.5 rounded-md bg-notion-bg/80 px-2.5 py-2"
            >
              <span className="shrink-0 text-zen-saffron" aria-hidden>
                {done ? (
                  <Check className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} />
                ) : (
                  <Circle className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-[13px] font-medium text-notion-text">
                  {index + 1}. {step.title}
                  {step.optional ? (
                    <span className="ml-1 font-normal text-notion-text-muted">（可选）</span>
                  ) : null}
                </p>
                <p className="text-[12px] leading-relaxed text-notion-text-muted">{step.description}</p>
                {step.id === "asr_ready" && onOpenAsrSettings ? (
                  <button
                    type="button"
                    className={`${CONTROL_BTN_LINK} self-start text-[12px]`}
                    onClick={onOpenAsrSettings}
                  >
                    打开环境 → 本机 ASR
                  </button>
                ) : null}
                {step.id === "project_audio" && onCreateProject ? (
                  <button
                    type="button"
                    className={`${CONTROL_BTN_LINK} self-start text-[12px]`}
                    onClick={onCreateProject}
                  >
                    新建项目
                  </button>
                ) : null}
                {step.id === "export" && onOpenLastEditor ? (
                  <button
                    type="button"
                    className={`${CONTROL_BTN_LINK} self-start text-[12px]`}
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
