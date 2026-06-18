import { pushActivity, pushTranscribeOutcomeActivity } from "./ui/pushActivity";
import { pushTranscribeHintsToToast } from "./ui/toast";
import type { TranscribeResultPresentation } from "./asr/transcribeResultToast";

let openDeliveryModeFromToast: (() => void) | null = null;

/** ProjectPanel registers the handler so transcribe-success toast can open 定稿模式. */
export function registerDeliveryModeTranscribeAction(fn: (() => void) | null): void {
  openDeliveryModeFromToast = fn;
}

export function runDeliveryModeTranscribeAction(): void {
  openDeliveryModeFromToast?.();
}

export type TranscribeDeliveryToastContext = {
  projectId: string;
  fileId: string;
  fileLabel?: string;
};

export function pushTranscribeDeliveryModeToast(
  presentation: TranscribeResultPresentation,
  context?: TranscribeDeliveryToastContext,
): void {
  const message = presentation.summary.trim();
  if (!message) return;
  if (presentation.variant === "warning") {
    pushTranscribeHintsToToast([message]);
    return;
  }
  if (!context) {
    pushActivity({
      variant: "success",
      kind: "transcribe",
      message,
      action: {
        label: "定稿模式…",
        kind: "delivery-mode",
        onClick: () => runDeliveryModeTranscribeAction(),
      },
    });
    return;
  }
  pushTranscribeOutcomeActivity({
    variant: "success",
    message,
    projectId: context.projectId,
    fileId: context.fileId,
    fileLabel: context.fileLabel,
    action: {
      label: "定稿模式…",
      kind: "delivery-mode",
      onClick: () => runDeliveryModeTranscribeAction(),
    },
  });
}
