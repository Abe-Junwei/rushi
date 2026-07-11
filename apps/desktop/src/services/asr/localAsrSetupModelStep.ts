import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import { asrSupervisorSnapshot } from "../../tauri/asrSetupApi";
import { isDefaultBundledAsrTarget } from "../../config/env";
import {
  packagedOrDev,
  SIDEcarRestartFailedDev,
  SIDEcarRestartFailedPackaged,
} from "../packagedUserHints";
import { usesBundledAsrModelStack } from "./bundledModelJobPresentation";
import { fetchAsrHealthCaps } from "./asrHealthSnapshot";
import { launchReportFromSupervisor } from "./asrSupervisorPresentation";
import {
  shouldSkipSidecarRestartForSelection,
  isLoopbackTranscribeReadyForSelection,
  type LocalAsrSetupSelectionContext,
} from "./localAsrSidecarGuards";
import {
  buildLocalAsrCatalogView,
  catalogEntryForHub,
  computeLocalAsrTranscribeReady,
  resolveLocalAsrHubModelId,
  selectedModelPrepareState,
} from "./localAsrModelCatalog";
import { normalizeLocalAsrRecognitionLanguage } from "./localAsrRecognitionLanguage";
import {
  restartLoopbackAsrSidecar,
  sidecarConfigMatchesHub,
  waitForSidecarConfig,
  writeLocalAsrPrefs,
} from "./localAsrSidecarRestart";

export type { LocalAsrSetupSelectionContext };

export type SelectedModelPrepareSnapshot = {
  hub: string;
  modelLabel: string;
  /** D5: memory-loaded + disk deps (same as transcribe-ready when warmup not deferred). */
  ready: boolean;
  /** D4: selected SKU weights on disk + sidecar hub aligned. */
  diskPrepared: boolean;
  sidecarMatchesSelection: boolean;
};

export type ApplyHubModelResult =
  | { ok: true; message: string; transcribeReady: boolean }
  | { ok: false; message: string; needsManualSidecarRestart?: boolean };

function buildApplyHubSuccessMessage(
  label: string,
  caps: AsrHealthCapabilities,
  ctx: LocalAsrSetupSelectionContext,
): { message: string; transcribeReady: boolean } {
  const transcribeReady = isLoopbackTranscribeReadyForSelection(caps, ctx);
  if (transcribeReady) {
    return { message: `侧车已切换为 ${label}，可以开始转写。`, transcribeReady: true };
  }
  return {
    message: usesBundledAsrModelStack()
      ? `侧车已切换为 ${label}。若尚未就绪，请重启应用以重新复制内置模型。`
      : `侧车已切换为 ${label}。请先点「一键准备」完成模型准备后再转写。`,
    transcribeReady: false,
  };
}

async function restartSidecarAndWait(
  hub: string,
  label: string,
  language: string,
  ctx: LocalAsrSetupSelectionContext,
  progress: (message: string) => void,
): Promise<ApplyHubModelResult> {
  progress("正在保存模型偏好…");
  await writeLocalAsrPrefs(hub, language);
  progress("正在重启侧车（约 10–45 秒）…");
  try {
    await restartLoopbackAsrSidecar();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      needsManualSidecarRestart: true,
      message: `侧车重启失败：${msg}。${packagedOrDev(SIDEcarRestartFailedDev, SIDEcarRestartFailedPackaged)}`,
    };
  }
  progress(`正在等待侧车加载 ${label}…`);
  const after = await waitForSidecarConfig({ hub, language });
  if (after && sidecarConfigMatchesHub(after, hub, language)) {
    const { message, transcribeReady } = buildApplyHubSuccessMessage(label, after, ctx);
    return { ok: true, message, transcribeReady };
  }
  if (after && !sidecarConfigMatchesHub(after, hub, language)) {
    const running =
      after.funasr_loaded_model_id?.trim() || after.funasr_model_id?.trim() || "未知模型";
    return {
      ok: false,
      message: `侧车已恢复，但仍运行 ${running}。请点「重试内置侧车」后再试。`,
    };
  }
  const report = await asrSupervisorSnapshot()
    .then(launchReportFromSupervisor)
    .catch(() => null);
  let message = "侧车重启后未响应 /health。请点「重试内置侧车」，或完全退出应用后再打开。";
  if (report && !report.success && report.detail?.trim()) {
    message = `${message} ${report.detail.trim()}`;
  }
  return { ok: false, needsManualSidecarRestart: true, message };
}

/** Write pref and restart sidecar when needed; wait until loopback reports target hub. */
export async function applyHubModelToSidecar(
  ctx: LocalAsrSetupSelectionContext,
  onProgress?: (message: string) => void,
): Promise<ApplyHubModelResult> {
  const progress = onProgress ?? (() => {});
  const hub = resolveLocalAsrHubModelId(ctx.selectedHubModelId);
  const label = catalogEntryForHub(hub)?.label ?? hub;
  const language = ctx.recognitionLanguage ?? "zh";
  const caps = await fetchAsrHealthCaps();
  if (shouldSkipSidecarRestartForSelection(caps, ctx)) {
    await writeLocalAsrPrefs(hub, language);
    return {
      ok: true,
      message: "侧车已在运行所选模型，无需重启。",
      transcribeReady: true,
    };
  }

  if (!isDefaultBundledAsrTarget()) {
    await writeLocalAsrPrefs(hub, language);
    return {
      ok: false,
      needsManualSidecarRestart: true,
      message: `已写入模型与识别语言偏好。请执行 npm run asr:dev 重启侧车以加载 ${label}。`,
    };
  }

  return restartSidecarAndWait(hub, label, language, ctx, progress);
}

/** Read loopback caps + UI selection; D1=D2 aligned transcribe readiness for setup flows. */
export async function snapshotSelectedModelPrepare(
  ctx: LocalAsrSetupSelectionContext,
): Promise<SelectedModelPrepareSnapshot> {
  const hub = resolveLocalAsrHubModelId(ctx.selectedHubModelId);
  const caps = await fetchAsrHealthCaps();
  const modelLabel = catalogEntryForHub(hub)?.label ?? "当前所选模型";
  const catalogStatus = ctx.catalogStatus ?? null;
  const { ready, sidecarMatchesSelection } = computeLocalAsrTranscribeReady({
    asrHealth: caps ? "ok" : "error",
    asrCaps: caps,
    selectedHubModelId: hub,
    catalogStatus,
  });
  const view = buildLocalAsrCatalogView(caps, catalogStatus, hub);
  const prepare = selectedModelPrepareState(view, hub, caps?.funasr_model_id);
  const diskPrepared = prepare.cached && prepare.sidecarMatchesSelection;
  return { hub, modelLabel, ready, diskPrepared, sidecarMatchesSelection };
}

/** Align bundled sidecar with UI-selected hub; skips restart when already warm (see guards). */
export async function syncBundledSidecarToPreferredHub(
  ctx: LocalAsrSetupSelectionContext,
): Promise<boolean> {
  const caps = await fetchAsrHealthCaps();
  const hub = resolveLocalAsrHubModelId(ctx.selectedHubModelId);
  const language = normalizeLocalAsrRecognitionLanguage(ctx.recognitionLanguage);

  if (shouldSkipSidecarRestartForSelection(caps, ctx)) {
    await writeLocalAsrPrefs(hub, language);
    return false;
  }
  await writeLocalAsrPrefs(hub, language);
  await restartLoopbackAsrSidecar();
  return true;
}
