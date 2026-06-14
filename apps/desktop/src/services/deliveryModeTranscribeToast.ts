import { pushTranscribeHintsToToast, pushTranscribeResultToast } from "./ui/toast";
import type { TranscribeResultPresentation } from "./asr/transcribeResultToast";

let openDeliveryModeFromToast: (() => void) | null = null;

/** ProjectPanel registers the handler so transcribe-success toast can open 定稿模式. */
export function registerDeliveryModeTranscribeAction(fn: (() => void) | null): void {
  openDeliveryModeFromToast = fn;
}

export function pushTranscribeDeliveryModeToast(
  presentation: TranscribeResultPresentation,
): void {
  const message = presentation.summary.trim();
  if (!message) return;
  if (presentation.variant === "warning") {
    pushTranscribeHintsToToast([message]);
    return;
  }
  pushTranscribeResultToast(message, {
    label: "定稿模式…",
    onClick: () => openDeliveryModeFromToast?.(),
  });
}
