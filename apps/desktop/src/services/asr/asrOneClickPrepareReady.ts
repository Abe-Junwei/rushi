import { isDefaultBundledAsrTarget } from "../../config/env";
import type { AsrSetupReport } from "./asrSetupContract";
import type { LocalAsrSetupSelectionContext } from "./localAsrSetupModelStep";
import { snapshotSelectedModelPrepare, syncBundledSidecarToPreferredHub } from "./localAsrSetupModelStep";
import { patchStep } from "../../pages/asrSetupState";
import type {
  AsrOneClickPrepareDeps,
  AsrOneClickPrepareUi,
} from "./asrOneClickPrepareTypes";

export function oneClickPrepareSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** When UI + loopback already agree, mark wizard steps done without restart/download. */
export async function finishOneClickIfAlreadyReady(
  deps: AsrOneClickPrepareDeps,
  cb: AsrOneClickPrepareUi,
  report: AsrSetupReport,
  selection: LocalAsrSetupSelectionContext,
): Promise<boolean> {
  const readySnap = await snapshotSelectedModelPrepare(selection);
  if (!readySnap.ready || !readySnap.sidecarMatchesSelection) {
    return false;
  }
  if (isDefaultBundledAsrTarget()) {
    await syncBundledSidecarToPreferredHub(selection);
  }
  const { setSetupSteps, setSetupMessage, setSetupOutcome } = cb;
  setSetupSteps((prevSteps) => {
    let next = patchStep(prevSteps, "sidecar", {
      status: "skipped",
      detail: report.bundledAvailable ? "侧车已在运行" : "当前 ASR 服务已就绪",
    });
    next = patchStep(next, "health", {
      status: "ok",
      detail: "FunASR 运行时已就绪",
    });
    next = patchStep(next, "model", {
      status: "skipped",
      detail: `${readySnap.modelLabel} 与辅助模型已在缓存中`,
    });
    return patchStep(next, "done", { status: "ok", detail: "本机 ASR 已可用于转写" });
  });
  setSetupMessage("本机 ASR 已就绪，无需重复准备；可直接开始转写。");
  setSetupOutcome("ready");
  await deps.refreshAsrRuntimeInfo();
  return true;
}

export function applyPortForeignBlocked(cb: AsrOneClickPrepareUi, report: AsrSetupReport): void {
  cb.setSetupSteps((steps) =>
    patchStep(steps, "sidecar", {
      status: "error",
      detail: report.portDetail ?? "8741 端口冲突",
    }),
  );
  cb.setSetupMessage(report.portDetail ?? "8741 已被占用，请先结束其他 ASR 进程，或改用当前服务。");
  cb.setSetupOutcome("blocked");
}
