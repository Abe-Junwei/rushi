import { LoaderCircle } from "lucide-react";
import { CONTROL_BTN_DANGER } from "../config/controlStyles";
import { OVERLAY_SCRIM_LAYER } from "../config/overlayStyles";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { TranscribeVocabularyPreflightLines } from "./TranscribeVocabularyPreflightLines";
import {
  PANEL_PROGRESS_INDETERMINATE_CLASS,
  PANEL_PROGRESS_TRACK_CLASS,
} from "./panelProgressStyles";

type Props = {
  title: string;
  hint: string;
  elapsedSec: number;
  /** banner：不挡编辑；blocking：全屏遮罩 */
  variant: "blocking" | "banner";
  vocabularyLines?: string[];
  onCancel?: () => void;
  cancelling?: boolean;
};

function ProgressCardBody({
  title,
  hint,
  elapsedSec,
  vocabularyLines = [],
  onCancel,
  cancelling,
  cardClassName,
}: Omit<Props, "variant"> & { cardClassName?: string }) {
  return (
    <div
      className={[
        "flex w-full max-w-[360px] flex-col items-center gap-4 rounded-lg border p-8 text-center",
        cardClassName ?? "border-notion-divider bg-notion-bg shadow-sm",
      ].join(" ")}
    >
      <div className="relative mb-1 flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-zen-saffron/20 [animation-duration:2s]" />
        <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-zen-saffron/30 bg-notion-bg shadow-sm">
          <LoaderCircle
            className={`${LUCIDE_ICON_SIZE_LG} animate-rushi-spin-slow text-zen-saffron`}
            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
            aria-hidden
          />
        </div>
      </div>
      <div className="flex w-full flex-col gap-1">
        <h2 className="font-sans text-lg font-semibold leading-snug text-zen-ink">{title}</h2>
        <p className="font-sans text-body leading-normal text-zen-stone">{hint}</p>
      </div>
      <TranscribeVocabularyPreflightLines lines={vocabularyLines} />
      <div className={`relative mt-2 ${PANEL_PROGRESS_TRACK_CLASS}`}>
        <div className={PANEL_PROGRESS_INDETERMINATE_CLASS} />
      </div>
      <p className="mt-1 font-mono text-body tabular-nums text-zen-stone">已等待 {elapsedSec}s</p>
      {onCancel ? (
        <div className="pointer-events-auto mt-1 w-full">
          <button
            type="button"
            className={`${CONTROL_BTN_DANGER} w-full`}
            disabled={cancelling}
            onClick={() => void onCancel()}
          >
            {cancelling ? "正在停止…（当前窗完成后结束）" : "停止转写"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function BlockingProgressCard({
  title,
  hint,
  elapsedSec,
  variant,
  vocabularyLines,
  onCancel,
  cancelling,
}: Props) {
  const cardClassName =
    variant === "banner"
      ? "border-zen-saffron/25 bg-notion-bg/95 shadow-lg backdrop-blur-xs"
      : undefined;

  const shell = (
    <ProgressCardBody
      title={title}
      hint={hint}
      elapsedSec={elapsedSec}
      vocabularyLines={vocabularyLines}
      onCancel={onCancel}
      cancelling={cancelling}
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
