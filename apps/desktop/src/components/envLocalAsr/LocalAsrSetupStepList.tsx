import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { AsrSetupStep, AsrSetupStepStatus } from "../../services/asr/asrSetupContract";

type Props = {
  steps: AsrSetupStep[];
};

/** 紧凑竖向 stepper：左侧连线 + 节点（GitHub Actions / macOS 安装器常见模式）。 */
export function LocalAsrSetupStepList({ steps }: Props) {
  if (steps.length === 0) return null;

  return (
    <ol
      aria-label="准备步骤"
      className="m-0 ml-1.5 list-none border-l border-notion-divider/80 pl-3.5"
    >
      {steps.map((step) => (
        <li key={step.id} className="relative pb-1 last:pb-0">
          <SetupStepNode status={step.status} />
          <div className="min-w-0 leading-snug">
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
    <span
      className={`absolute -left-[calc(0.875rem+1px)] top-[5px] h-1.5 w-1.5 rounded-full ring-2 ring-notion-bg ${tone}`}
      aria-hidden
    />
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
