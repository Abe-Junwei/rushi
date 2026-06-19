import type { AsrEnvPresentation } from "./asrEnvStatus";

export function isTranscribeBusyReason(busyReason: string | null | undefined): boolean {
  return busyReason === "transcribe" || busyReason === "batch_transcribe";
}

/** 转写进行中：顶栏 chip 保持转写开始前最后一次就绪态，避免侧车忙导致误报。 */
export function stabilizeAsrPresentationDuringTranscribe(
  current: AsrEnvPresentation,
  lastStable: AsrEnvPresentation | null,
  transcribeActive: boolean,
): AsrEnvPresentation {
  if (current.chipOk) return current;
  if (transcribeActive && lastStable?.chipOk) return lastStable;
  return current;
}
