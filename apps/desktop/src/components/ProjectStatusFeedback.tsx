import type { BusyReason } from "../pages/useProjectController";
import type { TranscribeProgress } from "../pages/transcribePreviewState";
import type { TranscribeTimelineSnapshot } from "../services/transcribeDiag";
import { formatTranscribeDiagSummary, shouldShowTranscribeEnvAction, transcribeFailureBannerTitle } from "../services/transcribeDiag";
import { createPortal } from "react-dom";
import { TriangleAlert } from "lucide-react";
import { CONTROL_BTN_DANGER, CONTROL_BTN_PRIMARY } from "../config/controlStyles";
import { ENV_NAV } from "../config/environmentNavCopy";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { BlockingProgressCard } from "./BlockingProgressCard";
import { busyOverlayCopy, transcribeCancelStoppingLabel } from "./projectStatusFeedbackCopy";
import type { TranscribeSource } from "../services/stt/transcribeSource";

export function ProjectBusyOverlay({
  reason,
  elapsedSec,
  transcribeProgress = null,
}: {
  reason: BusyReason | null;
  elapsedSec: number;
  transcribeProgress?: TranscribeProgress | null;
}) {
  const busyCopy = busyOverlayCopy(reason, transcribeProgress);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="workspace">
      <BlockingProgressCard
        variant="blocking"
        title={busyCopy.title}
        lead={busyCopy.lead}
        detail={busyCopy.detail}
        elapsedSec={elapsedSec}
      />
    </div>,
    document.body,
  );
}

/** R3e-C: centered status card; segment preview stays visible (no full-screen block). */
function TranscribePreviewBanner({
  elapsedSec,
  transcribeProgress = null,
  transcribeSource = "local",
  vocabularyLines = [],
  cancelling = false,
  onCancel,
}: {
  elapsedSec: number;
  transcribeProgress?: TranscribeProgress | null;
  transcribeSource?: TranscribeSource;
  vocabularyLines?: string[];
  cancelling?: boolean;
  onCancel?: () => void;
}) {
  const busyCopy = busyOverlayCopy("transcribe", transcribeProgress, { transcribeSource });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="workspace">
      <BlockingProgressCard
        variant="banner"
        density="compact"
        title={busyCopy.title}
        lead={busyCopy.lead}
        detail={busyCopy.detail}
        elapsedSec={elapsedSec}
        vocabularyLines={vocabularyLines}
        onCancel={onCancel}
        cancelling={cancelling}
        cancellingLabel={transcribeCancelStoppingLabel(transcribeSource)}
      />
    </div>,
    document.body,
  );
}

export function TranscribeDiagBanner({
  diag,
  errorMessage,
  onDismiss,
  onOpenEnvironment,
}: {
  diag: TranscribeTimelineSnapshot;
  errorMessage?: string | null;
  onDismiss?: () => void;
  onOpenEnvironment?: () => void;
}) {
  const lines = formatTranscribeDiagSummary(diag);
  const showEnv = onOpenEnvironment && shouldShowTranscribeEnvAction(diag);

  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-zen-cinnabar/20 bg-zen-cinnabar/10 px-4 py-4 text-zen-cinnabar sm:flex-row sm:items-start">
      <div className="flex items-start gap-3">
        <TriangleAlert
          className={`${LUCIDE_ICON_SIZE_LG} shrink-0 text-zen-cinnabar`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
        <div className="space-y-1">
          <p className="font-sans text-sm font-semibold leading-relaxed">
            {transcribeFailureBannerTitle(diag)}
          </p>
          {errorMessage ? (
            <p className="font-sans text-xs leading-relaxed opacity-90">{errorMessage}</p>
          ) : null}
          {lines.map((line) => (
            <p key={line} className="font-sans text-xs leading-relaxed opacity-90">
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {showEnv ? (
          <button type="button" className={CONTROL_BTN_DANGER} onClick={onOpenEnvironment}>
            打开{ENV_NAV.localAsr}
          </button>
        ) : null}
        {onDismiss ? (
          <button type="button" className={CONTROL_BTN_DANGER} onClick={onDismiss}>
            关闭
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** TRN-DIAG: failure banner + in-progress preview for editor shell and project hub. */
export function TranscribeWorkspaceBanners({
  transcribeFailureDiag,
  errorMessage,
  busy,
  busyReason,
  busyElapsedSec,
  transcribeProgress,
  transcribeSource = "local",
  transcribeVocabularyPreflightLines = [],
  transcribeCancelling,
  onCancelTranscribe,
  onDismissDiag,
  onOpenEnvironment,
  diagWrapClassName = "shrink-0 px-4 pt-4",
}: {
  transcribeFailureDiag: TranscribeTimelineSnapshot | null;
  errorMessage?: string | null;
  busy: boolean;
  busyReason: BusyReason | null;
  busyElapsedSec: number;
  transcribeProgress?: TranscribeProgress | null;
  transcribeSource?: TranscribeSource;
  transcribeVocabularyPreflightLines?: string[];
  transcribeCancelling?: boolean;
  onCancelTranscribe: () => void;
  onDismissDiag: () => void;
  onOpenEnvironment: () => void;
  diagWrapClassName?: string;
}) {
  return (
    <>
      {transcribeFailureDiag ? (
        <div className={diagWrapClassName}>
          <TranscribeDiagBanner
            diag={transcribeFailureDiag}
            errorMessage={errorMessage}
            onDismiss={onDismissDiag}
            onOpenEnvironment={onOpenEnvironment}
          />
        </div>
      ) : null}
      {busy && busyReason === "transcribe" ? (
        <TranscribePreviewBanner
          elapsedSec={busyElapsedSec}
          transcribeProgress={transcribeProgress}
          transcribeSource={transcribeSource}
          vocabularyLines={transcribeVocabularyPreflightLines}
          cancelling={transcribeCancelling}
          onCancel={onCancelTranscribe}
        />
      ) : null}
    </>
  );
}

export function AsrErrorBanner({
  message = "无法连接本机 ASR，请检查服务是否在运行。",
  detail,
  onOpenEnvironment,
}: {
  message?: string;
  detail?: string | null;
  onOpenEnvironment: () => void;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-zen-cinnabar/20 bg-zen-cinnabar/10 px-4 py-4 text-zen-cinnabar sm:flex-row sm:items-center">
      <div className="flex items-start gap-3 sm:items-center">
        <TriangleAlert
          className={`${LUCIDE_ICON_SIZE_LG} shrink-0 text-zen-cinnabar`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
        <div className="space-y-1">
          <p className="font-sans text-sm font-semibold leading-relaxed">{message}</p>
          {detail ? <p className="font-sans text-xs leading-relaxed opacity-90">{detail}</p> : null}
        </div>
      </div>
      <button type="button" className={CONTROL_BTN_DANGER} onClick={onOpenEnvironment}>
        打开{ENV_NAV.localAsr}
      </button>
    </div>
  );
}

export function OnlineSttEnvBanner({
  title,
  detail,
  tone,
  onOpenOnlineSttSettings,
}: {
  title: string;
  detail: string;
  tone: "warn" | "error";
  onOpenOnlineSttSettings: () => void;
}) {
  const isError = tone === "error";
  const surface = isError
    ? "border-zen-cinnabar/20 bg-zen-cinnabar/10 text-zen-cinnabar"
    : "border-accent-action/20 bg-accent-action/10 text-accent-action";
  const iconClass = isError ? "text-zen-cinnabar" : "text-accent-action";
  const buttonClass = isError ? CONTROL_BTN_DANGER : CONTROL_BTN_PRIMARY;

  return (
    <div
      className={`flex flex-col items-start justify-between gap-4 rounded-lg border px-4 py-4 sm:flex-row sm:items-center ${surface}`}
    >
      <div className="flex items-start gap-3 sm:items-center">
        <TriangleAlert
          className={`${LUCIDE_ICON_SIZE_LG} shrink-0 ${iconClass}`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
        <div className="space-y-1">
          <p className="font-sans text-sm font-semibold leading-relaxed">{title}</p>
          <p className="font-sans text-xs leading-relaxed opacity-90">{detail}</p>
        </div>
      </div>
      <button type="button" className={buttonClass} onClick={onOpenOnlineSttSettings}>
        打开{ENV_NAV.onlineStt}
      </button>
    </div>
  );
}
