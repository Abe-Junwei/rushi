import type { LlmProviderId } from "../postprocess/postprocessRuntimeContract";
import {
  isLlmConnectionVerified,
  isLlmRuntimeReady,
} from "../postprocess/postprocessRuntimeContract";
import {
  llmExportPolishCapabilityBadge,
  llmExportPolishCapabilityBadgeClass,
  resolveLlmConnectionUiStatus,
} from "../postprocess/llmConnectionUi";
import type { OllamaDetectResponse } from "../../tauri/postprocessApi";
import {
  llmEnvConfigDraftDirty,
  readLlmEnvModeForConfig,
  resolveLlmEnvEffectiveConfig,
} from "./llmEnvStatusConfig";
import {
  appendConfigDraftHint,
  bannerDetail,
  bannerTitle,
  blockReasonForPresentation,
  chipLabel,
  llmPolishActiveMessage,
  llmPolishSourceDetailLabel,
} from "./llmEnvStatusCopy";
import {
  llmEnvReady,
  ollamaDetectReady,
  toneFromConnectionPhase,
  toneFromOllamaDetect,
} from "./llmEnvStatusTone";
import type {
  LlmEnvMode,
  LlmEnvPresentation,
  LlmEnvSettingsOverlay,
  LlmOllamaTone,
  LlmPolishReadiness,
} from "./llmEnvStatusTypes";

export { buildLlmModeToggleTones } from "./llmEnvStatusTone";
export {
  llmEnvReady,
  ollamaDetectReady,
  toneFromConnectionPhase,
  toneFromOllamaDetect,
} from "./llmEnvStatusTone";
export { llmPolishActiveMessage, llmPolishSourceDetailLabel } from "./llmEnvStatusCopy";

export function buildLlmEnvPresentation(input: {
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
  settings?: LlmEnvSettingsOverlay;
}): LlmEnvPresentation {
  const configDraftDirty = llmEnvConfigDraftDirty(input.settings?.configDraft);
  const cfg = resolveLlmEnvEffectiveConfig(input.settings?.configDraft);
  const mode = readLlmEnvModeForConfig(cfg);
  const localLoopback = mode === "local";
  const runtimeReady = input.settings?.hasLocalKeyRef ?? isLlmRuntimeReady();
  const hasTypedKey = input.settings?.hasTypedKey ?? false;
  const keychainPresent = input.settings?.keychainPresent ?? null;
  const connectionVerified = isLlmConnectionVerified(cfg);
  const ollamaTone = toneFromOllamaDetect(input.ollamaDetect, input.ollamaDetectBusy);
  const ollamaTagsReady = input.ollamaDetect ? ollamaDetectReady(input.ollamaDetect) : false;
  const connectionStatus = resolveLlmConnectionUiStatus({
    hasLocalKeyRef: runtimeReady,
    hasTypedKey,
    keychainPresent,
    connectionVerified,
    localLoopback,
  });
  const tone = toneFromConnectionPhase({
    mode,
    ollamaTone,
    runtimeReady,
    connectionVerified,
    connectionStatus,
  });
  const ok = llmEnvReady({ mode, ollamaTone, connectionVerified, runtimeReady });
  const capOpts = {
    localLoopback,
    ollamaTagsReady,
    ollamaReachable: input.ollamaDetect?.reachable,
  };
  const bannerDetailRaw = bannerDetail({
    mode,
    connectionStatus,
    ollamaDetect: input.ollamaDetect,
    ollamaDetectBusy: input.ollamaDetectBusy,
    ollamaTagsReady,
  });

  return {
    mode,
    providerId: cfg.providerId,
    model: cfg.model,
    tone,
    chipLabel: chipLabel({ mode, ollamaTone, providerId: cfg.providerId, connectionVerified, runtimeReady }),
    ok,
    bannerTitle: bannerTitle({
      mode,
      providerId: cfg.providerId,
      ollamaTone,
      connectionVerified,
      runtimeReady,
      ollamaDetectBusy: input.ollamaDetectBusy,
    }),
    bannerDetail: appendConfigDraftHint(bannerDetailRaw, configDraftDirty),
    sourceLabel: llmPolishSourceDetailLabel({ mode, providerId: cfg.providerId, model: cfg.model }),
    capabilityBadge: llmExportPolishCapabilityBadge(connectionStatus, capOpts),
    capabilityBadgeClass: llmExportPolishCapabilityBadgeClass(connectionStatus, capOpts),
    connectionStatus,
    ollamaTagsReady,
    configDraftDirty,
    blockReason: blockReasonForPresentation({
      mode,
      ollamaTone,
      ollamaDetect: input.ollamaDetect,
      ollamaDetectBusy: input.ollamaDetectBusy,
      connectionVerified,
      runtimeReady,
      connectionStatus,
      configDraftDirty,
    }),
    polishActiveMessage: llmPolishActiveMessage(mode),
  };
}

/** @deprecated 使用 buildLlmEnvPresentation */
export function buildLlmPolishReadiness(input: {
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
}): LlmPolishReadiness {
  const p = buildLlmEnvPresentation(input);
  return {
    mode: p.mode,
    sourceLabel: p.sourceLabel,
    shortLabel: p.chipLabel,
    tone: p.tone,
    ready: p.ok,
    blockReason: p.blockReason,
  };
}

/** @deprecated 使用 buildLlmEnvPresentation().chipLabel */
export function llmTopStatusShortLabel(input: {
  mode: LlmEnvMode;
  ollamaTone: LlmOllamaTone;
  providerId: LlmProviderId;
  cloudConnectionVerified: boolean;
  runtimeReady: boolean;
}): string {
  return chipLabel({
    mode: input.mode,
    ollamaTone: input.ollamaTone,
    providerId: input.providerId,
    connectionVerified: input.cloudConnectionVerified,
    runtimeReady: input.runtimeReady,
  });
}

/** @deprecated 使用 buildLlmEnvPresentation().ok */
export function llmTopStatusOk(input: {
  mode: LlmEnvMode;
  ollamaTone: LlmOllamaTone;
  cloudConnectionVerified: boolean;
  runtimeReady: boolean;
}): boolean {
  return llmEnvReady({
    mode: input.mode,
    ollamaTone: input.ollamaTone,
    connectionVerified: input.cloudConnectionVerified,
    runtimeReady: input.runtimeReady,
  });
}
