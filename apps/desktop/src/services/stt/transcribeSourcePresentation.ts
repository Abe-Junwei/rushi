import { ENV_NAV } from "../../config/environmentNavCopy";
import type { TranscribeSource } from "./transcribeSource";
import { readTranscribeSourceUserOverride } from "./transcribeSource";
import { getSttOnlineProviderDefinition } from "./sttOnlineProviderContract/definitions";
import { isOnlineTranscribeReady } from "./sttOnlineProviderContract/bridge";
import { readExternalSttOnlineRuntimeConfigFromStorage } from "./sttOnlineProviderContract/runtimeConfig";

/**
 * 顶栏 chip / onboarding / 横幅用的有效转写来源。
 * 在线 STT 已就绪且用户未显式锁定「本机 ASR」时，与自动转录默认一致走 online。
 */
export function resolveEffectiveTranscribeSource(
  stored: TranscribeSource,
  options?: { onlineReady?: boolean; userOverride?: TranscribeSource | null },
): TranscribeSource {
  const override = options?.userOverride ?? readTranscribeSourceUserOverride();
  if (override) return override;
  const onlineReady = options?.onlineReady ?? isOnlineTranscribeReady();
  if (onlineReady) return "online";
  return stored;
}

/** 当前转写来源下的环境是否满足开始转写（与顶栏 chip / onboarding 同源）。 */
export function resolveTranscribeEnvReady(
  source: TranscribeSource,
  options: { asrChipOk: boolean; onlineReady?: boolean },
): boolean {
  const onlineReady = options.onlineReady ?? isOnlineTranscribeReady();
  const effective = resolveEffectiveTranscribeSource(source, { onlineReady });
  if (effective === "online") return onlineReady;
  return options.asrChipOk;
}

export function resolveTranscribeSourceDescription(
  source: TranscribeSource,
  options?: { onlineReady?: boolean },
): string {
  if (source === "local") {
    return "本机 FunASR；在环境页完成侧车与模型准备。";
  }

  const stored = readExternalSttOnlineRuntimeConfigFromStorage();
  const providerLabel =
    getSttOnlineProviderDefinition(stored.selectedProviderId)?.label ?? "云端 STT";
  const ready = options?.onlineReady ?? isOnlineTranscribeReady();

  if (ready) {
    return `在线 STT 已就绪 · ${providerLabel}`;
  }

  return `请到「${ENV_NAV.onlineStt}」保存 Key 并探测连接。`;
}
