import {
  STT_ONLINE_OPENAI_DEFAULT_TRANSCRIBE_URL,
  STT_ONLINE_ASSEMBLYAI_DEFAULT_BASE_URL,
} from "./constants";
import { getSttOnlineProviderDefinition } from "./definitions";
import { isAllowedSttOnlineEndpoint } from "./endpoint";
import { getSttOnlineApiKeyFromMemory } from "./memorySecrets";
import { readExternalSttOnlineRuntimeConfigFromStorage } from "./runtimeConfig";
import type { OnlineNativeAdapterId, OnlineTranscribeBridgePayload } from "./types";

/** 所选厂商是否由桌面壳内置 HTTP 直连（可省略自定义 endpoint，由 Rust 填默认 URL）。 */
export function resolveShellNativeSttAdapterId(providerId: string): OnlineNativeAdapterId | null {
  switch (providerId) {
    case "openai":
      return "openaiAudio";
    case "assemblyai":
      return "assemblyai";
    case "baidu-speech":
      return "baiduSpeech";
    case "aliyun-nls":
      return "aliyunNls";
    case "deepgram":
      return "deepgramListen";
    case "tencent-asr":
      return "tencentAsr";
    case "azure-speech":
      return "azureConversationV1";
    case "google-cloud-stt":
      return "googleSpeechV1";
    case "iflytek-speech":
      return "iflytekIatWs";
    case "huawei-sis":
      return "huaweiSisShortAudio";
    case "aispeech":
      return "aispeechLasrSentenceV2";
    case "volcengine-speech":
      return "volcengineBigmodelNostreamWs";
    default:
      return null;
  }
}

/** 未填 endpoint 时仍可用默认厂商端点完成转写 / 探测的厂商。 */
export function sttOnlineProviderAllowsEmptyEndpoint(providerId: string): boolean {
  return resolveShellNativeSttAdapterId(providerId) != null;
}

/**
 * 若已启用在线 STT 且具备密钥（及壳直连厂商所需的持久化 AppKey），则返回 Tauri 载荷；否则返回 null（走本机 ASR）。
 * 启用但未配全时由调用方提示错误，避免静默回落。
 */
export function tryBuildOnlineTranscribeBridgePayload(): OnlineTranscribeBridgePayload | null {
  const c = readExternalSttOnlineRuntimeConfigFromStorage();
  const key = getSttOnlineApiKeyFromMemory()?.trim();
  if (!key) return null;
  const def = getSttOnlineProviderDefinition(c.selectedProviderId);
  if (!def) return null;
  const timeoutSec = Math.min(600, Math.max(30, Math.round(c.timeoutMs / 1000)));
  const authorization = def.authStyle === "bearer" ? `Bearer ${key}` : key;
  const shellAdapter = resolveShellNativeSttAdapterId(c.selectedProviderId);

  if (shellAdapter === "openaiAudio") {
    const transcribeUrl = (c.endpoint?.trim() || STT_ONLINE_OPENAI_DEFAULT_TRANSCRIBE_URL).trim();
    if (!isAllowedSttOnlineEndpoint(transcribeUrl)) return null;
    const appKeyTrim = c.appKey?.trim();
    return {
      transcribeUrl,
      authorization,
      timeoutSec,
      nativeAdapter: "openaiAudio",
      ...(appKeyTrim ? { appKey: appKeyTrim } : {}),
    };
  }
  if (shellAdapter === "assemblyai") {
    const transcribeUrl = (c.endpoint?.trim() || STT_ONLINE_ASSEMBLYAI_DEFAULT_BASE_URL).replace(/\/+$/, "");
    if (!isAllowedSttOnlineEndpoint(transcribeUrl)) return null;
    const appKeyTrim = c.appKey?.trim();
    return {
      transcribeUrl,
      authorization,
      timeoutSec,
      nativeAdapter: "assemblyai",
      ...(appKeyTrim ? { appKey: appKeyTrim } : {}),
    };
  }
  if (shellAdapter) {
    if (def.requiresPersistedAppKey && !c.appKey?.trim()) return null;
    const endpointTrim = c.endpoint?.trim() ?? "";
    if (endpointTrim && !isAllowedSttOnlineEndpoint(endpointTrim)) return null;
    const appKeyTrim = c.appKey?.trim();
    return {
      transcribeUrl: endpointTrim,
      authorization,
      timeoutSec,
      nativeAdapter: shellAdapter,
      ...(appKeyTrim ? { appKey: appKeyTrim } : {}),
    };
  }

  const transcribeUrl = c.endpoint?.trim() ?? "";
  if (!transcribeUrl || !isAllowedSttOnlineEndpoint(transcribeUrl)) return null;
  const appKeyTrim = c.appKey?.trim();
  return {
    transcribeUrl,
    authorization,
    timeoutSec,
    ...(appKeyTrim ? { appKey: appKeyTrim } : {}),
  };
}

/** 用户选择在线转写但配置/会话密钥未齐时用于主舞台提示。 */
export function isSttOnlineTranscribeIncomplete(): boolean {
  if (tryBuildOnlineTranscribeBridgePayload()) return false;
  const c = readExternalSttOnlineRuntimeConfigFromStorage();
  const key = getSttOnlineApiKeyFromMemory()?.trim();
  if (!key) return true;
  const def = getSttOnlineProviderDefinition(c.selectedProviderId);
  if (def?.requiresPersistedAppKey && !(c.appKey?.trim())) return true;
  const url = c.endpoint?.trim() ?? "";
  if (sttOnlineProviderAllowsEmptyEndpoint(c.selectedProviderId)) {
    if (!url) return false;
    return !isAllowedSttOnlineEndpoint(url);
  }
  return !url || !isAllowedSttOnlineEndpoint(url);
}

/** @deprecated 使用 isSttOnlineTranscribeIncomplete */
export function isSttOnlineEnabledButIncomplete(): boolean {
  return isSttOnlineTranscribeIncomplete();
}

export function resolveOnlineTranscribeBlock(): string | null {
  if (tryBuildOnlineTranscribeBridgePayload()) return null;
  const key = getSttOnlineApiKeyFromMemory()?.trim();
  if (!key) {
    return "在线 STT：请先在「环境 → 在线 STT」保存配置，并在该页填写 API Key（仅保留在当前会话）。";
  }
  return "在线 STT：请在「环境 → 在线 STT」补全厂商、URL 等配置并探测连接。";
}
