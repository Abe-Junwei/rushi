import { pushTranscribeResultToast } from "./ui/toast";

let openDeliveryModeFromToast: (() => void) | null = null;

/** ProjectPanel registers the handler so transcribe-success toast can open 定稿模式. */
export function registerDeliveryModeTranscribeAction(fn: (() => void) | null): void {
  openDeliveryModeFromToast = fn;
}

export function pushTranscribeDeliveryModeToast(summary: string): void {
  const message = summary.trim();
  if (!message) return;
  pushTranscribeResultToast(message, {
    label: "定稿模式…",
    onClick: () => openDeliveryModeFromToast?.(),
  });
}
