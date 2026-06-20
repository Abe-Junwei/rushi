import { isDefaultBundledAsrTarget } from "../../config/env";
import {
  packagedOrDev,
  sidecarMissingHealthBlockReasonDev,
  sidecarMissingHealthBlockReasonManaged,
} from "../packagedUserHints";
import type { AsrSetupReport } from "./asrSetupContract";
import { isAsrSidecarRuntimeWarm } from "./localAsrSidecarGuards";
import { fetchAsrHealthCaps } from "./asrHealthSnapshot";
import * as projectApi from "../../tauri/projectApi";
import { patchStep } from "../../pages/asrSetupState";
import { oneClickPrepareSleep } from "./asrOneClickPrepareReady";
import type { AsrOneClickPrepareCallbacks } from "./asrOneClickPrepareTypes";

export async function runAsrOneClickPrepareSidecarHealth(
  report: AsrSetupReport,
  cb: AsrOneClickPrepareCallbacks,
): Promise<boolean> {
  const {
    pollUntilHealth,
    refreshLocalRuntimeDiagnose,
    setSetupSteps,
    setSetupMessage,
    setSetupOutcome,
  } = cb;
  const loopCaps = await fetchAsrHealthCaps();
  const sidecarWarm = isAsrSidecarRuntimeWarm(loopCaps);
  const needSidecar =
    isDefaultBundledAsrTarget() &&
    !sidecarWarm &&
    (report.bundledAvailable
      ? !report.health.healthReachable ||
        report.portStatus === "free" ||
        report.portStatus === "foreign" ||
        report.sidecarIntegrity === "corrupt"
      : !report.health.healthReachable || report.portStatus === "free");

  if (needSidecar) {
    setSetupSteps((steps) =>
      patchStep(steps, "sidecar", {
        status: "running",
        detail: "正在启动内置侧车…",
      }),
    );
    await projectApi.retryBundledAsrSidecar();
    await oneClickPrepareSleep(1500);
  } else {
    setSetupSteps((steps) =>
      patchStep(steps, "sidecar", {
        status: "skipped",
        detail: report.bundledAvailable ? "侧车已在运行或无需启动" : "已使用应用数据侧车或当前服务",
      }),
    );
  }

  setSetupSteps((steps) => patchStep(steps, "health", { status: "running", detail: "等待 /health…" }));
  const healthOk = await pollUntilHealth();
  if (!healthOk) {
    const latestRuntimeDiag = await refreshLocalRuntimeDiagnose();
    const hasInstalledLocalRuntime = latestRuntimeDiag?.installed.status === "installed";
    setSetupSteps((steps) =>
      patchStep(steps, "health", {
        status: "error",
        detail: "超时：FunASR 运行时未就绪",
      }),
    );
    setSetupMessage(
      report.bundledAvailable
        ? "侧车已尝试启动，但 FunASR 运行时仍未就绪。请查看「ASR 状态」或导出诊断包。"
        : hasInstalledLocalRuntime
          ? "已检测到应用数据侧车并已尝试启动，但 FunASR 运行时仍未就绪。请查看组件状态与诊断信息后重试。"
          : packagedOrDev(
              sidecarMissingHealthBlockReasonDev,
              sidecarMissingHealthBlockReasonManaged,
            ),
    );
    setSetupOutcome("error");
    return false;
  }
  if (needSidecar) {
    setSetupSteps((steps) =>
      patchStep(steps, "sidecar", { status: "ok", detail: "内置侧车进程已连接" }),
    );
  }
  setSetupSteps((steps) =>
    patchStep(steps, "health", { status: "ok", detail: "FunASR 运行时已加载（不含模型权重）" }),
  );
  return true;
}
