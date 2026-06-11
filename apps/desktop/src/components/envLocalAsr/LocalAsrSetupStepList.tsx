import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { AsrSetupStep, AsrSetupStepStatus } from "../../services/asr/asrSetupContract";

type Props = {
  steps: AsrSetupStep[];
};

/** 紧凑竖向 stepper：圆点 + 文案，无左侧连线。 */
export function LocalAsrSetupStepList({ steps }: Props) {
  if (steps.length === 0) return null;

  return (
    <ol aria-label="准备步骤" className="m-0 flex list-none flex-col gap-1.5">
      {steps.map((step) => (
        <li key={step.id} className="flex gap-2">
          <SetupStepNode status={step.status} />
          <div className="min-w-0 flex-1 leading-snug">
            <span className={stepLabelClass(step.status)}>{step.label}</span>
            {step.detail ? (
              <span className={`mt-px block ${PANEL_TYPOGRAPHY.meta}`}>{step.detail}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function SetupStepNode({ status }: { status: AsrSetupStepStatus }) {
  const tone =
    status === "ok"
      ? "bg-zen-success"
      : status === "running"
        ? "bg-zen-saffron animate-pulse"
        : status === "error"
          ? "bg-zen-cinnabar"
          : status === "skipped"
            ? "bg-notion-text-light"
            : "bg-notion-divider";

  return (
    <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} aria-hidden />
  );
}

function stepLabelClass(status: AsrSetupStepStatus): string {
  const base = "text-[11px] leading-[1.35]";
  switch (status) {
    case "running":
      return `${base} font-medium text-notion-text`;
    case "ok":
      return `${base} text-notion-text-muted`;
    case "error":
      return `${base} font-medium text-zen-cinnabar`;
    case "skipped":
      return `${base} text-notion-text-light`;
    default:
      return `${base} text-notion-text-muted`;
  }
}
