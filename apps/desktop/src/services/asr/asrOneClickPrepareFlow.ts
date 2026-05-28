import type { Dispatch, SetStateAction } from "react";
import { isDefaultBundledAsrTarget } from "../../config/env";
import type { AsrSetupOutcome, AsrSetupReport, AsrSetupStep } from "./asrSetupContract";
import { fetchAsrHealthCaps } from "./asrHealthSnapshot";
import type { LocalAsrSetupSelectionContext } from "./localAsrSetupModelStep";
import {
  applyHubModelToSidecar,
  snapshotSelectedModelPrepare,
  syncBundledSidecarToPreferredHub,
} from "./localAsrSetupModelStep";
import {
  applyPortForeignBlocked,
  finishOneClickIfAlreadyReady,
} from "./asrOneClickPrepareReady";
import type { LocalRuntimeDiagnose } from "../localRuntime/localRuntimeContract";
import * as projectApi from "../../tauri/projectApi";
import { initialSetupSteps, patchStep } from "../../pages/asrSetupState";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type AsrOneClickPrepareDeps = {
  refreshAsrHealth: () => Promise<void>;
  refreshAsrRuntimeInfo: () => Promise<void>;
  prepareDefaultFunasrModel: (options?: import("../../pages/usePrepareModelController").PrepareDefaultModelOptions) => Promise<void>;
  getSetupSelection: () => LocalAsrSetupSelectionContext;
};

export type AsrOneClickPrepareCallbacks = {
  refreshSetupDiagnose: (options?: {
    resetSteps?: boolean;
    touchUi?: boolean;
  }) => Promise<AsrSetupReport | null>;
  refreshLocalRuntimeDiagnose: () => Promise<LocalRuntimeDiagnose | null>;
  ensureLocalRuntimeInstalled: (reason: "missing" | "repair") => Promise<boolean>;
  pollUntilHealth: () => Promise<boolean>;
  setSetupSteps: Dispatch<SetStateAction<AsrSetupStep[]>>;
  setSetupMessage: Dispatch<SetStateAction<string>>;
  setSetupOutcome: Dispatch<SetStateAction<AsrSetupOutcome>>;
};

export async function runAsrOneClickPrepareFlow(
  deps: AsrOneClickPrepareDeps,
  cb: AsrOneClickPrepareCallbacks,
): Promise<void> {
  const {
    refreshSetupDiagnose,
    refreshLocalRuntimeDiagnose,
    ensureLocalRuntimeInstalled,
    pollUntilHealth,
    setSetupSteps,
    setSetupMessage,
    setSetupOutcome,
  } = cb;

  setSetupSteps(initialSetupSteps());
  try {
    setSetupSteps((steps) =>
      patchStep(steps, "diagnose", {
        status: "running",
        detail: "正在读取本机环境…",
      }),
    );
    const selection = deps.getSetupSelection();
    const firstReport = await refreshSetupDiagnose({ resetSteps: false, touchUi: false });
    if (!firstReport) {
      setSetupSteps((steps) => patchStep(steps, "diagnose", { status: "error", detail: "诊断失败" }));
      setSetupOutcome("error");
      return;
    }
    let report = firstReport;

    setSetupSteps((steps) =>
      patchStep(steps, "diagnose", {
        status: "ok",
        detail: report.summaryLines[0] ?? "诊断完成",
      }),
    );

    if (report.sidecarIntegrity === "corrupt") {
      const repaired = await ensureLocalRuntimeInstalled("repair");
      if (!repaired) return;
      const refreshed = await refreshSetupDiagnose({ resetSteps: false, touchUi: false });
      if (!refreshed) {
        setSetupMessage("修复侧车后刷新诊断失败，请重试。");
        setSetupOutcome("error");
        return;
      }
      report = refreshed;
    }
    if (report.portStatus === "foreign") {
      applyPortForeignBlocked(
        { setSetupSteps, setSetupMessage, setSetupOutcome },
        report,
      );
      return;
    }

    if (await finishOneClickIfAlreadyReady(deps, { setSetupSteps, setSetupMessage, setSetupOutcome }, report, selection)) {
      return;
    }
    if (!report.health.healthReachable && !report.bundledAvailable) {
      const installed = await ensureLocalRuntimeInstalled("missing");
      if (!installed) return;
      const refreshed = await refreshSetupDiagnose({ resetSteps: false, touchUi: false });
      if (!refreshed) {
        setSetupMessage("下载安装侧车后刷新诊断失败，请重试。");
        setSetupOutcome("error");
        return;
      }
      report = refreshed;
    }

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
      await sleep(1500);
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
            : "未检测到可用侧车（dev 需先 npm run asr:build-sidecar-unix），或先通过「下载 / 修复语音识别组件」安装应用数据侧车。",
      );
      setSetupOutcome("error");
      return;
    }
    setSetupSteps((steps) =>
      patchStep(steps, "health", { status: "ok", detail: "FunASR 运行时已就绪" }),
    );

    if (isDefaultBundledAsrTarget()) {
      setSetupSteps((steps) =>
        patchStep(steps, "model", { status: "running", detail: "正在同步侧车所选模型…" }),
      );
      try {
        const restarted = await syncBundledSidecarToPreferredHub(selection);
        if (restarted) {
          await sleep(1500);
          const okAfterSync = await pollUntilHealth();
          if (!okAfterSync) {
            setSetupSteps((steps) =>
              patchStep(steps, "model", { status: "error", detail: "侧车模型同步后未就绪" }),
            );
            setSetupMessage(
              "已请求重启侧车以加载所选模型，但 FunASR 运行时尚未恢复。请稍候重试或查看 ASR 状态。",
            );
            setSetupOutcome("error");
            return;
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
        return;
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
        return;
      }
      await deps.refreshAsrRuntimeInfo();
      modelSnap = await snapshotSelectedModelPrepare(selection);
      if (!modelSnap.sidecarMatchesSelection) {
        setSetupSteps((steps) =>
          patchStep(steps, "model", {
            status: "error",
            detail: `侧车未加载 ${modelSnap.modelLabel}`,
          }),
        );
        setSetupMessage(
          `侧车仍未加载 ${modelSnap.modelLabel}。请点「重试内置侧车」或 npm run asr:dev 后重试。`,
        );
        setSetupOutcome("blocked");
        return;
      }
      setSetupSteps((steps) =>
        patchStep(steps, "model", {
          status: "ok",
          detail: `侧车已加载 ${modelSnap.modelLabel}`,
        }),
      );
    }

    const latest = await refreshSetupDiagnose({ resetSteps: false, touchUi: false });
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
      return;
    } else {
      setSetupSteps((steps) =>
        patchStep(steps, "model", { status: "running", detail: `正在下载 ${modelSnap.modelLabel}…` }),
      );
      await deps.prepareDefaultFunasrModel();
      await deps.refreshAsrRuntimeInfo();
      const after = await refreshSetupDiagnose({ resetSteps: false, touchUi: false });
      const afterSnap = await snapshotSelectedModelPrepare(selection);
      if (after?.readyForTranscribe && afterSnap.ready) {
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
        return;
      }
    }

    setSetupSteps((steps) => patchStep(steps, "done", { status: "ok", detail: "本机 ASR 已可用于转写" }));
    setSetupMessage("一键准备完成，可直接开始转写。");
    setSetupOutcome("ready");
    await deps.refreshAsrRuntimeInfo();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    setSetupSteps((steps) =>
      patchStep(steps, "done", {
        status: "error",
        detail: "一键准备过程中出现未处理异常",
      }),
    );
    setSetupMessage(`一键准备失败：${msg}`);
    setSetupOutcome("error");
  } finally {
    await deps.refreshAsrRuntimeInfo();
  }
}
