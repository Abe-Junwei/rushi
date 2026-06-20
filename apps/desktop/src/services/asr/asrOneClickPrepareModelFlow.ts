import { isDefaultBundledAsrTarget } from "../../config/env";
import { packagedOrDev } from "../packagedUserHints";
import {
  applyHubModelToSidecar,
  snapshotSelectedModelPrepare,
  syncBundledSidecarToPreferredHub,
} from "./localAsrSetupModelStep";
import { patchStep } from "../../pages/asrSetupState";
import { REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE } from "../../pages/asrRuntimeRefreshOptions";
import { oneClickPrepareSleep } from "./asrOneClickPrepareReady";
import type {
  AsrOneClickPrepareCallbacks,
  AsrOneClickPrepareContext,
  AsrOneClickPrepareDeps,
} from "./asrOneClickPrepareTypes";

export async function runAsrOneClickPrepareModelFlow(
  deps: AsrOneClickPrepareDeps,
  cb: AsrOneClickPrepareCallbacks,
  ctx: AsrOneClickPrepareContext,
): Promise<boolean> {
  const { selection } = ctx;
  const { refreshSetupDiagnose, pollUntilHealth, setSetupSteps, setSetupMessage, setSetupOutcome } = cb;
  if (isDefaultBundledAsrTarget()) {
    setSetupSteps((steps) =>
      patchStep(steps, "model", { status: "running", detail: "正在同步侧车所选模型…" }),
    );
    try {
      const restarted = await syncBundledSidecarToPreferredHub(selection);
      if (restarted) {
        await oneClickPrepareSleep(1500);
        const okAfterSync = await pollUntilHealth();
        if (!okAfterSync) {
          setSetupSteps((steps) =>
            patchStep(steps, "model", { status: "error", detail: "侧车模型同步后未就绪" }),
          );
          setSetupMessage(
            "已请求重启侧车以加载所选模型，但 FunASR 运行时尚未恢复。请稍候重试或查看 ASR 状态。",
          );
          setSetupOutcome("error");
          return false;
        }
      } else {
        setSetupSteps((steps) =>
          patchStep(steps, "model", {
            status: "skipped",
            detail: "侧车已加载所选模型",
          }),
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setSetupSteps((steps) =>
        patchStep(steps, "model", { status: "error", detail: "侧车模型同步失败" }),
      );
      setSetupMessage(`无法将侧车切换到所选模型：${msg}`);
      setSetupOutcome("error");
      return false;
    }
  }

  let modelSnap = await snapshotSelectedModelPrepare(selection);
  if (!modelSnap.sidecarMatchesSelection) {
    setSetupSteps((steps) =>
      patchStep(steps, "model", {
        status: "running",
        detail: `正在切换到 ${modelSnap.modelLabel}…`,
      }),
    );
    const applied = await applyHubModelToSidecar(selection);
    if (!applied.ok) {
      setSetupSteps((steps) =>
        patchStep(steps, "model", { status: "error", detail: "侧车模型切换失败" }),
      );
      setSetupMessage(applied.message);
      setSetupOutcome(applied.needsManualSidecarRestart ? "blocked" : "error");
      return false;
    }
    await deps.refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
    modelSnap = await snapshotSelectedModelPrepare(selection);
    if (!modelSnap.sidecarMatchesSelection) {
      setSetupSteps((steps) =>
        patchStep(steps, "model", {
          status: "error",
          detail: `侧车未加载 ${modelSnap.modelLabel}`,
        }),
      );
      setSetupMessage(
        `侧车仍未加载 ${modelSnap.modelLabel}。${packagedOrDev(
          `请点「重试内置侧车」或 npm run asr:dev 后重试。`,
          `请点「重试内置侧车」或「一键准备本机 ASR」后重试。`,
        )}`,
      );
      setSetupOutcome("blocked");
      return false;
    }
    // 不提前把 model 步标为 ok：D4（权重齐备）才是 model 步的终态。
    // 保持当前 running/skipped，交给后续 cache-ready / download 分支处理。
  }

  const latest = await refreshSetupDiagnose({
    resetSteps: false,
    touchUi: false,
    skipLocalRuntimeDiagnose: true,
  });
  if (modelSnap.ready) {
    setSetupSteps((steps) =>
      patchStep(steps, "model", {
        status: "skipped",
        detail: `${modelSnap.modelLabel} 与辅助模型已在缓存中`,
      }),
    );
  } else if (latest?.diskLow) {
    setSetupSteps((steps) =>
      patchStep(steps, "model", { status: "error", detail: "磁盘可用空间不足" }),
    );
    setSetupMessage("磁盘空间不足，无法下载当前所选模型。请清理后重试。");
    setSetupOutcome("blocked");
    return false;
  } else {
    setSetupSteps((steps) =>
      patchStep(steps, "model", { status: "running", detail: `正在下载 ${modelSnap.modelLabel}…` }),
    );
    await deps.prepareDefaultFunasrModel();
    await deps.refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
    await refreshSetupDiagnose({
      resetSteps: false,
      touchUi: false,
      skipLocalRuntimeDiagnose: true,
    });
    const afterSnap = await snapshotSelectedModelPrepare(selection);
    if (afterSnap.ready && afterSnap.sidecarMatchesSelection) {
      setSetupSteps((steps) =>
        patchStep(steps, "model", {
          status: "ok",
          detail: `${modelSnap.modelLabel} 与辅助模型已就绪`,
        }),
      );
    } else {
      setSetupSteps((steps) =>
        patchStep(steps, "model", { status: "error", detail: "模型下载未完成" }),
      );
      setSetupMessage("模型下载可能失败，请查看模型下载区的错误提示并重试。");
      setSetupOutcome("error");
      return false;
    }
  }

  const finalSnap = await snapshotSelectedModelPrepare(selection);
  if (!finalSnap.ready || !finalSnap.sidecarMatchesSelection) {
    setSetupSteps((steps) =>
      patchStep(steps, "model", { status: "error", detail: "模型尚未完全就绪" }),
    );
    setSetupMessage("模型或侧车尚未完全准备好，请完成模型下载或重试侧车同步。");
    setSetupOutcome("blocked");
    return false;
  }

  setSetupSteps((steps) => patchStep(steps, "done", { status: "ok", detail: "本机 ASR 已可用于转写" }));
  setSetupMessage("一键准备完成，可直接开始转写。");
  setSetupOutcome("ready");
  await refreshSetupDiagnose({
    resetSteps: false,
    touchUi: false,
    skipLocalRuntimeDiagnose: true,
  });
  await deps.refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
  return true;
}
