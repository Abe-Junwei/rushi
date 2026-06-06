import * as projectApi from "../../tauri/projectApi";
import { isDefaultBundledAsrTarget } from "../../config/env";
import {
  packagedOrDev,
  SIDEcarRestartFailedDev,
  SIDEcarRestartFailedPackaged,
} from "../packagedUserHints";
import { fetchAsrHealthCaps } from "./asrHealthSnapshot";
import {
  shouldSkipSidecarRestartForSelection,
  type LocalAsrSetupSelectionContext,
} from "./localAsrSidecarGuards";
import {
  catalogEntryForHub,
  computeLocalAsrTranscribeReady,
  resolveLocalAsrHubModelId,
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
  ready: boolean;
  sidecarMatchesSelection: boolean;
};

export type ApplyHubModelResult =
  | { ok: true; message: string }
  | { ok: false; message: string; needsManualSidecarRestart?: boolean };

async function restartSidecarAndWait(
  hub: string,
  label: string,
  language: string,
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
    return { ok: true, message: `侧车已切换为 ${label}，可以开始转写。` };
  }
  if (after && !sidecarConfigMatchesHub(after, hub, language)) {
    const running =
      after.funasr_loaded_model_id?.trim() || after.funasr_model_id?.trim() || "未知模型";
    return {
      ok: false,
      message: `侧车已恢复，但仍运行 ${running}。请点「重试内置侧车」后再试。`,
    };
  }
  const report = await projectApi.bundledAsrLaunchReport().catch(() => null);
  let message = "侧车重启后未响应 /health。请点「重试内置侧车」，或完全退出应用后再打开。";
  if (report?.attempted && !report.success && report.detail?.trim()) {
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
    return { ok: true, message: "侧车已在运行所选模型，无需重启。" };
  }

  if (!isDefaultBundledAsrTarget()) {
    await writeLocalAsrPrefs(hub, language);
    return {
      ok: false,
      needsManualSidecarRestart: true,
      message: `已写入模型与识别语言偏好。请执行 npm run asr:dev 重启侧车以加载 ${label}。`,
    };
  }

  return restartSidecarAndWait(hub, label, language, progress);
}

/** Read loopback caps + UI selection; D1=D2 aligned transcribe readiness for setup flows. */
export async function snapshotSelectedModelPrepare(
  ctx: LocalAsrSetupSelectionContext,
): Promise<SelectedModelPrepareSnapshot> {
  const hub = resolveLocalAsrHubModelId(ctx.selectedHubModelId);
  const caps = await fetchAsrHealthCaps();
  const modelLabel = catalogEntryForHub(hub)?.label ?? "当前所选模型";
  const { ready, sidecarMatchesSelection } = computeLocalAsrTranscribeReady({
    asrHealth: caps ? "ok" : "error",
    asrCaps: caps,
    selectedHubModelId: hub,
    catalogStatus: ctx.catalogStatus ?? null,
  });
  return { hub, modelLabel, ready, sidecarMatchesSelection };
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
