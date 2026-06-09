import { isDefaultBundledAsrTarget, isPackagedDesktopApp } from "../../config/env";
import type { AsrSetupReport } from "./asrSetupContract";
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
  const sidecarWarm = loopCaps?.funasr_ready === true;
  const needSidecar =
    isDefaultBundledAsrTarget() &&
    !sidecarWarm &&
    (!report.health.healthReachable || report.portStatus === "free");

  if (needSidecar) {
    setSetupSteps((steps) =>
      patchStep(steps, "sidecar", {
        status: "running",
        detail: "正在启动内置侧车…",
      }),
    );
    await projectApi.retryBundledAsrSidecar();
    await oneClickPrepareSleep(1500);
    setSetupSteps((steps) => patchStep(steps, "sidecar", { status: "ok", detail: "已请求启动侧车" }));
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
          : isPackagedDesktopApp()
            ? "未检测到可用侧车。请在「环境 → 本机 ASR」完成「一键准备本机 ASR」，或通过「下载 / 修复语音识别组件」安装应用数据侧车。"
            : "未检测到可用侧车（dev 需先 npm run asr:build-sidecar-unix），或先通过「下载 / 修复语音识别组件」安装应用数据侧车。",
    );
    setSetupOutcome("error");
    return false;
  }
  setSetupSteps((steps) =>
    patchStep(steps, "health", { status: "ok", detail: "FunASR 运行时已就绪" }),
  );
  return true;
}
