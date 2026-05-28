import * as projectApi from "../../tauri/projectApi";
import { isDefaultBundledAsrTarget } from "../../config/env";
import { fetchAsrHealthCaps, pollLoopbackHealthUntil } from "./asrHealthSnapshot";
import {
  shouldSkipSidecarRestartForSelection,
  type LocalAsrSetupSelectionContext,
} from "./localAsrSidecarGuards";
import {
  catalogEntryForHub,
  computeLocalAsrTranscribeReady,
  resolveLocalAsrHubModelId,
} from "./localAsrModelCatalog";

export type { LocalAsrSetupSelectionContext };

export type SelectedModelPrepareSnapshot = {
  hub: string;
  modelLabel: string;
  ready: boolean;
  sidecarMatchesSelection: boolean;
};

export type ApplyHubModelResult =
  | { ok: true }
  | { ok: false; message: string; needsManualSidecarRestart?: boolean };

/** Write pref and restart sidecar when needed; wait until loopback reports target hub. */
export async function applyHubModelToSidecar(
  ctx: LocalAsrSetupSelectionContext,
): Promise<ApplyHubModelResult> {
  const hub = resolveLocalAsrHubModelId(ctx.selectedHubModelId);
  const label = catalogEntryForHub(hub)?.label ?? hub;
  const caps = await fetchAsrHealthCaps();
  if (shouldSkipSidecarRestartForSelection(caps, ctx)) {
    const pref = await projectApi.getLocalAsrHubModelPref().catch(() => null);
    if (pref?.trim() !== hub) {
      await projectApi.setLocalAsrHubModelPref(hub, { restartSidecar: false });
    }
    return { ok: true };
  }

  const prevPref = (await projectApi.getLocalAsrHubModelPref().catch(() => null))?.trim() ?? "";

  if (!isDefaultBundledAsrTarget()) {
    await projectApi.setLocalAsrHubModelPref(hub, { restartSidecar: false });
    return {
      ok: false,
      needsManualSidecarRestart: true,
      message: `已写入模型偏好。请执行 npm run asr:dev 重启侧车以加载 ${label}。`,
    };
  }

  if (prevPref === hub) {
    await projectApi.retryBundledAsrSidecar();
  } else {
    await projectApi.setLocalAsrHubModelPref(hub);
  }

  const after = await pollLoopbackHealthUntil({
    deadlineMs: 90_000,
    predicate: (c) => c.funasr_ready === true && c.funasr_model_id === hub,
  });
  if (after?.funasr_model_id === hub && after.funasr_ready) {
    return { ok: true };
  }
  if (after?.funasr_ready && after.funasr_model_id !== hub) {
    return {
      ok: false,
      message: `侧车已恢复，但仍运行 ${after.funasr_model_id ?? "未知模型"}。请点「重试内置侧车」或 npm run asr:dev 后再试。`,
    };
  }
  return {
    ok: false,
    needsManualSidecarRestart: true,
    message: `侧车重启后未响应 /health。若使用 dev 模式，请执行 npm run asr:dev；否则点「重试内置侧车」。`,
  };
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
  const hub = resolveLocalAsrHubModelId(ctx.selectedHubModelId);
  const caps = await fetchAsrHealthCaps();
  const pref = await projectApi.getLocalAsrHubModelPref().catch(() => null);
  const prefHub = pref?.trim() ?? "";

  if (shouldSkipSidecarRestartForSelection(caps, ctx)) {
    if (prefHub !== hub) {
      await projectApi.setLocalAsrHubModelPref(hub, { restartSidecar: false });
    }
    return false;
  }
  await projectApi.setLocalAsrHubModelPref(hub);
  return true;
}
