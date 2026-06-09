import { ENV_NAV } from "../../config/environmentNavCopy";
import type { TranscribeSource } from "./transcribeSource";
import { getSttOnlineProviderDefinition } from "./sttOnlineProviderContract/definitions";
import { isOnlineTranscribeReady } from "./sttOnlineProviderContract/bridge";
import { readExternalSttOnlineRuntimeConfigFromStorage } from "./sttOnlineProviderContract/runtimeConfig";

export function resolveTranscribeSourceDescription(
  source: TranscribeSource,
  options?: { onlineReady?: boolean },
): string {
  if (source === "local") {
    return "本机 FunASR；需 ASR 就绪并已下载模型。";
  }

  const stored = readExternalSttOnlineRuntimeConfigFromStorage();
  const providerLabel =
    getSttOnlineProviderDefinition(stored.selectedProviderId)?.label ?? "云端 STT";
  const ready = options?.onlineReady ?? isOnlineTranscribeReady();

  if (ready) {
    return `已验证 · ${providerLabel}`;
  }

  return `请到「${ENV_NAV.onlineStt}」保存 Key 并探测。`;
}
