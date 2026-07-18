import {
  IconLoader as LoaderCircle,
} from "@tabler/icons-react";
import { CONTROL_BTN_DANGER } from "../config/controlStyles";
import { FLAT_SHELL_ELEVATION_CLASS, OVERLAY_SCRIM_LAYER } from "../config/overlayStyles";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { TranscribeVocabularyPreflightLines } from "./TranscribeVocabularyPreflightLines";
import { TRANSCRIBE_PREFLIGHT_TYPO as T } from "./transcribePreflightTypography";
import { CspProgressFill } from "./CspProgressFill";
import {
  PANEL_PROGRESS_FILL_CLASS,
  PANEL_PROGRESS_INDETERMINATE_CLASS,
  PANEL_PROGRESS_TRACK_CLASS,
} from "./panelProgressStyles";

type Props = {
  title: string;
  lead: string;
  detail?: string;
  elapsedSec: number;
  variant: "blocking" | "banner";
  density?: "default" | "compact";
  vocabularyLines?: string[];
  onCancel?: () => void;
  cancelling?: boolean;
  cancellingLabel?: string;
  /** 0–1 when determinate; omit / null for indeterminate bar. */
  progressValue?: number | null;
};

function ProgressCardBody({
  title,
  lead,
  detail,
  elapsedSec,
  density = "default",
  vocabularyLines = [],
  onCancel,
  cancelling,
  cancellingLabel,
  progressValue = null,
  cardClassName,
}: Omit<Props, "variant"> & { cardClassName?: string }) {
  const compact = density === "compact";
  const stopLabel = cancelling ? (cancellingLabel ?? "正在停止…") : "停止转写";
  const determinate =
    progressValue != null && Number.isFinite(progressValue)
      ? Math.min(1, Math.max(0, progressValue))
      : null;

  return (
    <div
      className={[
        T.progressShell,
        compact ? T.progressShellCompact : T.progressShellDefault,
        cardClassName ?? `border-notion-border bg-notion-bg ${FLAT_SHELL_ELEVATION_CLASS}`,
      ].join(" ")}
    >
      <div className={compact ? "relative h-9 w-9 shrink-0" : "relative h-10 w-10 shrink-0"}>
        <div className="absolute inset-0 animate-ping rounded-full bg-accent-action/20 [animation-duration:2s]" />
        <div
          className={[
            "relative z-10 flex h-full w-full items-center justify-center rounded-full border border-accent-action/30 bg-notion-bg",
            FLAT_SHELL_ELEVATION_CLASS,
          ].join(" ")}
        >
          <LoaderCircle
            className={`${compact ? LUCIDE_ICON_SIZE_SM : LUCIDE_ICON_SIZE_MD} animate-rushi-spin-slow text-accent-action`}
            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
            aria-hidden
          />
        </div>
      </div>

      <div className={T.progressCopy}>
        <h2 className={T.progressPrimary}>{title}</h2>
        <div className={T.captionStack}>
          <p className={T.progressBody}>{lead}</p>
          {detail ? <p className={T.progressCaption}>{detail}</p> : null}
        </div>
        <TranscribeVocabularyPreflightLines lines={vocabularyLines} tone="progress" />
      </div>

      <div className={T.progressFooter}>
        <div className={`relative w-full ${PANEL_PROGRESS_TRACK_CLASS}`}>
          {determinate != null ? (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(determinate * 100)}
            >
              <CspProgressFill
                percent={Math.round(determinate * 100)}
                className={PANEL_PROGRESS_FILL_CLASS}
              />
            </div>
          ) : (
            <div className={PANEL_PROGRESS_INDETERMINATE_CLASS} />
          )}
        </div>
        <p className={T.progressElapsed}>已等待 {elapsedSec}s</p>
        {onCancel ? (
          <div className="pointer-events-auto w-full">
            <button
              type="button"
              className={`${CONTROL_BTN_DANGER} w-full`}
              disabled={cancelling}
              onClick={() => void onCancel()}
            >
              {stopLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function BlockingProgressCard({
  title,
  lead,
  detail,
  elapsedSec,
  variant,
  density = "default",
  vocabularyLines,
  onCancel,
  cancelling,
  cancellingLabel,
  progressValue = null,
}: Props) {
  const cardClassName =
    variant === "banner"
      ? `border-accent-action/25 bg-notion-bg ${FLAT_SHELL_ELEVATION_CLASS}`
      : undefined;

  const shell = (
    <ProgressCardBody
      title={title}
      lead={lead}
      detail={detail}
      elapsedSec={elapsedSec}
      density={density}
      vocabularyLines={vocabularyLines}
      onCancel={onCancel}
      cancelling={cancelling}
      cancellingLabel={cancellingLabel}
      progressValue={progressValue}
      cardClassName={cardClassName}
    />
  );

  if (variant === "banner") {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {shell}
      </div>
    );
  }

  return (
    <div
      className={`${OVERLAY_SCRIM_LAYER} z-[90] flex items-center justify-center px-6`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {shell}
    </div>
  );
}
