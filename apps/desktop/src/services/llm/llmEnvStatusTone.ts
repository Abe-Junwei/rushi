import type { OllamaDetectResponse } from "../../tauri/postprocessApi";
import {
  applyLlmProviderPreset,
  isLlmConnectionVerified,
  readLastCloudRuntimeConfig,
  type LlmRuntimeConfig,
} from "../postprocess/postprocessRuntimeContract";
import { resolveLlmConnectionUiStatus, type LlmConnectionUiStatus } from "../postprocess/llmConnectionUi";
import { readLlmEnvModeForConfig, resolveLlmEnvEffectiveConfig } from "./llmEnvStatusConfig";
import type { LlmEnvMode, LlmEnvSettingsOverlay, LlmModeToggleTones, LlmOllamaTone } from "./llmEnvStatusTypes";

export function ollamaDetectReady(detect: OllamaDetectResponse): boolean {
  if (!detect.reachable) return false;
  if (detect.hasConfiguredModel !== undefined) return detect.hasConfiguredModel;
  return detect.hasQwen25_7b;
}

export function toneFromOllamaDetect(
  detect: OllamaDetectResponse | null,
  busy: boolean,
): LlmOllamaTone {
  if (busy || !detect) return "idle";
  if (!detect.reachable) return "error";
  if (!ollamaDetectReady(detect)) return "warn";
  return "ok";
}

export function toneFromConnectionPhase(input: {
  mode: LlmEnvMode;
  ollamaTone: LlmOllamaTone;
  runtimeReady: boolean;
  connectionVerified: boolean;
  connectionStatus: LlmConnectionUiStatus;
}): LlmOllamaTone {
  if (input.connectionStatus === "missing" || input.connectionStatus === "keychain_missing") {
    return "error";
  }
  if (input.mode === "local") {
    if (input.ollamaTone === "idle") return "idle";
    if (input.ollamaTone === "error") return "error";
    if (input.ollamaTone === "warn") return "warn";
    return input.connectionVerified ? "ok" : "warn";
  }
  if (!input.runtimeReady) return "error";
  return input.connectionVerified ? "ok" : "warn";
}

export function llmEnvReady(input: {
  mode: LlmEnvMode;
  ollamaTone: LlmOllamaTone;
  connectionVerified: boolean;
  runtimeReady: boolean;
}): boolean {
  if (input.mode === "local") {
    return input.ollamaTone === "ok" && input.connectionVerified;
  }
  return input.runtimeReady && input.connectionVerified;
}

function readLocalOllamaToggleConfig(): LlmRuntimeConfig {
  return applyLlmProviderPreset("ollama");
}

function llmToneForModeConfig(input: {
  mode: LlmEnvMode;
  cfg: LlmRuntimeConfig;
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
  keychainPresent: boolean | null;
  hasTypedKey: boolean;
}): LlmOllamaTone {
  const localLoopback = input.mode === "local";
  const ollamaTone = localLoopback
    ? toneFromOllamaDetect(input.ollamaDetect, input.ollamaDetectBusy)
    : "ok";
  const runtimeReady = localLoopback
    ? Boolean(input.cfg.baseUrl.trim() && input.cfg.model.trim())
    : Boolean(input.cfg.apiKeyId?.trim());
  const connectionVerified = isLlmConnectionVerified(input.cfg);
  const connectionStatus = resolveLlmConnectionUiStatus({
    hasLocalKeyRef: runtimeReady,
    hasTypedKey: input.hasTypedKey,
    keychainPresent: input.keychainPresent,
    connectionVerified,
    localLoopback,
  });
  return toneFromConnectionPhase({
    mode: input.mode,
    ollamaTone,
    runtimeReady,
    connectionVerified,
    connectionStatus,
  });
}

/** LLM 模式切换按钮：本机 / 云端各自独立 tone（未激活侧也反映真实状态）。 */
export function buildLlmModeToggleTones(input: {
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
  settings?: LlmEnvSettingsOverlay;
}): LlmModeToggleTones {
  const activeCfg = resolveLlmEnvEffectiveConfig(input.settings?.configDraft);
  const activeMode = readLlmEnvModeForConfig(activeCfg);
  const keychainPresent = input.settings?.keychainPresent ?? null;
  const hasTypedKey = input.settings?.hasTypedKey ?? false;

  const localCfg = activeMode === "local" ? activeCfg : readLocalOllamaToggleConfig();
  const cloudCfg = activeMode === "cloud" ? activeCfg : readLastCloudRuntimeConfig();

  return {
    local: llmToneForModeConfig({
      mode: "local",
      cfg: localCfg,
      ollamaDetect: input.ollamaDetect,
      ollamaDetectBusy: input.ollamaDetectBusy,
      keychainPresent,
      hasTypedKey: activeMode === "local" && hasTypedKey,
    }),
    cloud: llmToneForModeConfig({
      mode: "cloud",
      cfg: cloudCfg,
      ollamaDetect: input.ollamaDetect,
      ollamaDetectBusy: false,
      keychainPresent,
      hasTypedKey: activeMode === "cloud" && hasTypedKey,
    }),
  };
}
