import type { AsrSetupOutcome } from "./asrSetupContract";

const TRANSCRIBE_READY_CLAIM = /可直接|已可用于转写|无需重复准备|可以开始转写/;

export function setupWizardToastClaimsTranscribeReady(message: string): boolean {
  return TRANSCRIBE_READY_CLAIM.test(message);
}

/** 安装向导 toast：与 buildAsrEnvPresentation.blockReason / prepare _busy 对齐，避免「可直接转写」误报。 */
export function resolveSetupWizardToast(input: {
  setupMessage: string;
  setupOutcome: AsrSetupOutcome;
  prepareModelBusy: boolean;
  prepareModelCancelling?: boolean;
  offlinePackImportBusy?: boolean;
  transcribeBlockReason?: string | null;
}):
  | { emit: false }
  | { emit: true; variant: "success" | "error" | "info" | "warning"; message: string } {
  const message = input.setupMessage.trim();
  if (!message) return { emit: false };
  if (input.prepareModelBusy || input.prepareModelCancelling || input.offlinePackImportBusy) {
    return { emit: false };
  }

  if (input.setupOutcome === "ready" && input.transcribeBlockReason) {
    return {
      emit: true,
      variant: "warning",
      message: input.transcribeBlockReason,
    };
  }

  switch (input.setupOutcome) {
    case "ready":
      return { emit: true, variant: "success", message };
    case "error":
    case "blocked":
      return { emit: true, variant: "error", message };
    default:
      return { emit: true, variant: "info", message };
  }
}
