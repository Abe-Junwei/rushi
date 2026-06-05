import { LoaderCircle } from "lucide-react";
import { CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import {
  PANEL_PROGRESS_FILL_CLASS,
  PANEL_PROGRESS_TRACK_CLASS,
} from "./panelProgressStyles";

type SpinnerProps = {
  mode: "spinner";
  message: string;
  className?: string;
};

type DeterminateProps = {
  mode: "determinate";
  title: string;
  stepLabel?: string;
  stepDetail?: string;
  done: number;
  total: number;
  percent: number;
  onCancel?: () => void;
  cancelDisabled?: boolean;
  className?: string;
};

export type PanelAsyncProgressProps = SpinnerProps | DeterminateProps;

export function PanelAsyncProgress(props: PanelAsyncProgressProps) {
  if (props.mode === "spinner") {
    return (
      <div
        className={[
          "flex min-h-[8rem] flex-col items-center justify-center gap-3 py-4",
          props.className ?? "",
        ].join(" ")}
      >
        <LoaderCircle
          className={`${LUCIDE_ICON_SIZE_MD} animate-rushi-spin-slow text-zen-saffron`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
        <p className={`text-center ${PANEL_TYPOGRAPHY.dialogBody}`}>{props.message}</p>
      </div>
    );
  }

  const {
    title,
    stepLabel,
    stepDetail,
    done,
    total,
    percent,
    onCancel,
    cancelDisabled = false,
    className,
  } = props;

  return (
    <div
      className={[
        "flex min-h-0 flex-1 flex-col justify-center gap-5 py-2",
        className ?? "",
      ].join(" ")}
    >
      <div className="space-y-2 text-center">
        <p className={`${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}>{title}</p>
        {stepLabel && stepDetail ? (
          <p className={PANEL_TYPOGRAPHY.dialogBody}>
            当前步骤：<span className="font-medium text-notion-text">{stepLabel}</span>
            <span className="mx-2">·</span>
            {stepDetail}
          </p>
        ) : null}
      </div>
      <div className="px-2">
        <div
          className={PANEL_PROGRESS_TRACK_CLASS}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={title}
        >
          <div className={PANEL_PROGRESS_FILL_CLASS} style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-center text-xs tabular-nums text-notion-text-muted">
          {percent}%（{done} / {total}）
        </p>
      </div>
      {onCancel ? (
        <div className="flex justify-center">
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={cancelDisabled}
            onClick={onCancel}
          >
            取消
          </button>
        </div>
      ) : null}
    </div>
  );
}
