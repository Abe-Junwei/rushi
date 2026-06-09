import { ENV_NAV } from "../../../config/environmentNavCopy";
import { getSttOnlineProviderDefinition } from "./definitions";
import { isSttConnectionVerified } from "./connectionVerified";
import { isAllowedSttOnlineEndpoint } from "./endpoint";
import { hasSttOnlineApiKeyReference } from "./apiKeyStorage";
import { getSttOnlineApiKeyFromMemory } from "./memorySecrets";
import {
  resolveSttOnlinePresetTranscribeUrl,
  sttOnlineProviderEndpointUserConfigurable,
  sttOnlineProviderUsesPresetEndpoint,
} from "./presetEndpoints";
import {
  normalizeExternalSttOnlineRuntimeConfig,
  readExternalSttOnlineRuntimeConfigFromStorage,
} from "./runtimeConfig";
import type { OnlineTranscribeBridgePayload } from "./types";
import { resolveShellNativeSttAdapterId } from "./nativeAdapters";

export { resolveShellNativeSttAdapterId } from "./nativeAdapters";

export { sttOnlineProviderAllowsEmptyEndpoint } from "./presetEndpoints";

function sttRuntimeConfigForVerification() {
  const stored = readExternalSttOnlineRuntimeConfigFromStorage();
  return normalizeExternalSttOnlineRuntimeConfig({
    enabled: true,
    selectedProviderId: stored.selectedProviderId,
    endpoint: stored.endpoint ?? "",
    appKey: stored.appKey ?? "",
    apiKeyId: stored.apiKeyId,
    timeoutMs: stored.timeoutMs,
  });
}

function isSttOnlineRuntimeConfigComplete(): boolean {
  const c = readExternalSttOnlineRuntimeConfigFromStorage();
  const def = getSttOnlineProviderDefinition(c.selectedProviderId);
  if (!def) return false;
  if (def.requiresPersistedAppKey && !c.appKey?.trim()) return false;
  if (sttOnlineProviderEndpointUserConfigurable(c.selectedProviderId)) {
    const url = c.endpoint?.trim() ?? "";
    if (!url || !isAllowedSttOnlineEndpoint(url)) return false;
  } else if (!sttOnlineProviderUsesPresetEndpoint(c.selectedProviderId)) {
    const url = c.endpoint?.trim() ?? "";
    if (!url || !isAllowedSttOnlineEndpoint(url)) return false;
  }
  return true;
}

/** 持久化配置指纹与最近一次探测成功一致。 */
export function isSttOnlineRuntimeConnectionVerified(): boolean {
  return isSttConnectionVerified(sttRuntimeConfigForVerification());
}

/**
 * 编辑器「在线」选项与自动转录门控：密钥引用 + 配置完整 + 连接已验证。
 * 实际转写前须 `ensureSttOnlineApiKeyForSession()` 将密钥注入内存以构建载荷。
 */
export function isOnlineTranscribeReady(): boolean {
  if (!hasSttOnlineApiKeyReference()) return false;
  if (!isSttOnlineRuntimeConfigComplete()) return false;
  return isSttOnlineRuntimeConnectionVerified();
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

  if (shellAdapter) {
    if (def.requiresPersistedAppKey && !c.appKey?.trim()) return null;
    const presetUrl = resolveSttOnlinePresetTranscribeUrl(c.selectedProviderId) ?? "";
    const customOverride = c.endpoint?.trim() ?? "";
    const transcribeUrl = sttOnlineProviderUsesPresetEndpoint(c.selectedProviderId)
      ? presetUrl
      : customOverride;
    if (transcribeUrl && !isAllowedSttOnlineEndpoint(transcribeUrl)) return null;
    const appKeyTrim = c.appKey?.trim();
    return {
      transcribeUrl,
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
  if (isOnlineTranscribeReady() && tryBuildOnlineTranscribeBridgePayload()) return false;
  if (!hasSttOnlineApiKeyReference()) return true;
  const c = readExternalSttOnlineRuntimeConfigFromStorage();
  const def = getSttOnlineProviderDefinition(c.selectedProviderId);
  if (def?.requiresPersistedAppKey && !(c.appKey?.trim())) return true;
  const url = c.endpoint?.trim() ?? "";
  if (sttOnlineProviderUsesPresetEndpoint(c.selectedProviderId)) {
    return false;
  }
  if (sttOnlineProviderEndpointUserConfigurable(c.selectedProviderId)) {
    return !url || !isAllowedSttOnlineEndpoint(url);
  }
  return !url || !isAllowedSttOnlineEndpoint(url);
}

/** @deprecated 使用 isSttOnlineTranscribeIncomplete */
export function isSttOnlineEnabledButIncomplete(): boolean {
  return isSttOnlineTranscribeIncomplete();
}

export function resolveOnlineTranscribeBlock(): string | null {
  if (isOnlineTranscribeReady() && tryBuildOnlineTranscribeBridgePayload()) {
    return null;
  }
  if (!hasSttOnlineApiKeyReference()) {
    return `在线 STT：请到「${ENV_NAV.onlineStt}」保存 Key。`;
  }
  if (!isSttOnlineRuntimeConnectionVerified()) {
    return `在线 STT：请到「${ENV_NAV.onlineStt}」探测连接。`;
  }
  if (!tryBuildOnlineTranscribeBridgePayload()) {
    return "在线 STT：密钥未加载，请重新保存或重启。";
  }
  return `在线 STT：请到「${ENV_NAV.onlineStt}」补全配置并保存。`;
}
