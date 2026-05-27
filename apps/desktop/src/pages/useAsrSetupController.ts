import { useCallback, useState } from "react";
import { isDefaultBundledAsrTarget, isTauriRuntime } from "../config/env";
import type { AsrSetupOutcome, AsrSetupReport, AsrSetupStep } from "../services/asr/asrSetupContract";
import type { LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import * as asrSetupApi from "../tauri/asrSetupApi";
import * as projectApi from "../tauri/projectApi";
import { initialSetupSteps, outcomeFromReport, patchStep, stepsFromReport } from "./asrSetupState";
import { useAsrSetupHealthFlow } from "./useAsrSetupHealthFlow";
import { useLocalRuntimeSetupSupport } from "./useLocalRuntimeSetupSupport";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AsrSetupControllerApi {
  setupReport: AsrSetupReport | null;
  localRuntimeDiag: LocalRuntimeDiagnose | null;
  setupSteps: AsrSetupStep[];
  setupBusy: boolean;
  diagnoseBusy: boolean;
  setupMessage: string;
  setupOutcome: AsrSetupOutcome;
  portConflict: boolean;
  refreshSetupDiagnose: (options?: { resetSteps?: boolean }) => Promise<AsrSetupReport | null>;
  refreshLocalRuntimeDiagnose: () => Promise<LocalRuntimeDiagnose | null>;
  downloadLocalRuntime: () => Promise<void>;
  cancelLocalRuntime: () => Promise<void>;
  revalidateLocalRuntime: () => Promise<void>;
  clearLocalRuntime: () => Promise<void>;
  restorePreviousLocalRuntime: () => Promise<void>;
  runOneClickAsrPrepare: () => Promise<void>;
  acceptForeignPortService: () => Promise<void>;
}

export function useAsrSetupController(deps: {
  refreshAsrHealth: () => Promise<void>;
  refreshAsrRuntimeInfo: () => Promise<void>;
  prepareDefaultFunasrModel: () => Promise<void>;
}): AsrSetupControllerApi {
  const tauriRuntime = isTauriRuntime();
  const [setupReport, setSetupReport] = useState<AsrSetupReport | null>(null);
  const [setupSteps, setSetupSteps] = useState<AsrSetupStep[]>(initialSetupSteps());
  const [setupBusy, setSetupBusy] = useState(false);
  const [diagnoseBusy, setDiagnoseBusy] = useState(false);
  const [setupMessage, setSetupMessage] = useState("");
  const [setupOutcome, setSetupOutcome] = useState<AsrSetupOutcome>("idle");
  const [portConflictAcknowledged, setPortConflictAcknowledged] = useState(false);
  const portConflict = setupReport?.portStatus === "foreign" && !portConflictAcknowledged;

  const {
    localRuntimeDiag,
    refreshLocalRuntimeDiagnose,
    downloadLocalRuntime,
    cancelLocalRuntime,
    revalidateLocalRuntime,
    clearLocalRuntime,
    restorePreviousLocalRuntime,
    ensureLocalRuntimeInstalled,
  } = useLocalRuntimeSetupSupport({
    tauriRuntime,
    setSetupSteps,
    setSetupMessage,
    setSetupOutcome,
  });

  const refreshSetupDiagnose = useCallback(
    async (options?: { resetSteps?: boolean }): Promise<AsrSetupReport | null> => {
      if (!tauriRuntime) {
        setSetupMessage("浏览器预览无法运行环境诊断，请在桌面应用中使用。");
        setSetupOutcome("error");
        setSetupReport(null);
        return null;
      }

      const resetSteps = options?.resetSteps !== false;
      setDiagnoseBusy(true);
      setPortConflictAcknowledged(false);
      setSetupMessage("");
      setSetupOutcome("idle");
      if (resetSteps) {
        setSetupSteps(
          patchStep(initialSetupSteps(), "diagnose", {
            status: "running",
            detail: "正在读取本机环境…",
          }),
        );
      }

      try {
        const [report] = await Promise.all([
          asrSetupApi.asrSetupDiagnose(),
          refreshLocalRuntimeDiagnose(),
        ]);
        setSetupReport(report);
        setSetupMessage(report.blockingIssue ?? "");
        setSetupOutcome(outcomeFromReport(report));
        if (resetSteps) {
          setSetupSteps(stepsFromReport(report));
        }
        return report;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setSetupMessage(
          `诊断失败：${msg}。若刚更新代码，请完全退出并重新运行 desktop:dev 以加载新 Tauri 命令。`,
        );
        setSetupOutcome("error");
        setSetupReport(null);
        if (resetSteps) {
          setSetupSteps(
            patchStep(initialSetupSteps(), "diagnose", {
              status: "error",
              detail: msg.slice(0, 120),
            }),
          );
        }
        return null;
      } finally {
        setDiagnoseBusy(false);
      }
    },
    [refreshLocalRuntimeDiagnose, tauriRuntime],
  );

  const { pollUntilHealth, acceptForeignPortService } = useAsrSetupHealthFlow({
    deps,
    refreshSetupDiagnose: async () => refreshSetupDiagnose({ resetSteps: false }),
    markPortConflictAcknowledged: () => setPortConflictAcknowledged(true),
    setSetupBusy,
    setSetupSteps,
    setSetupMessage,
    setSetupOutcome,
  });

  const runOneClickAsrPrepare = useCallback(async () => {
    if (!tauriRuntime) {
      setSetupMessage("一键准备需要在 Tauri 桌面壳中运行。");
      setSetupOutcome("error");
      return;
    }

    setSetupBusy(true);
    setPortConflictAcknowledged(false);
    setSetupOutcome("running");
    setSetupMessage("");
    setSetupSteps(initialSetupSteps());
    try {
      setSetupSteps((steps) =>
        patchStep(steps, "diagnose", {
          status: "running",
          detail: "正在读取本机环境…",
        }),
      );
      const firstReport = await refreshSetupDiagnose({ resetSteps: false });
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
        const refreshed = await refreshSetupDiagnose({ resetSteps: false });
        if (!refreshed) {
          setSetupMessage("修复侧车后刷新诊断失败，请重试。");
          setSetupOutcome("error");
          return;
        }
        report = refreshed;
      }
      if (report.portStatus === "foreign") {
        setSetupSteps((steps) =>
          patchStep(steps, "sidecar", {
            status: "error",
            detail: report.portDetail ?? "8741 端口冲突",
          }),
        );
        setSetupMessage(report.portDetail ?? "8741 已被占用，请先结束其他 ASR 进程，或改用当前服务。");
        setSetupOutcome("blocked");
        return;
      }
      if (!report.health.healthReachable && !report.bundledAvailable) {
        const installed = await ensureLocalRuntimeInstalled("missing");
        if (!installed) return;
        const refreshed = await refreshSetupDiagnose({ resetSteps: false });
        if (!refreshed) {
          setSetupMessage("下载安装侧车后刷新诊断失败，请重试。");
          setSetupOutcome("error");
          return;
        }
        report = refreshed;
      }

      const needSidecar =
        isDefaultBundledAsrTarget() &&
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

      const latest = await refreshSetupDiagnose();
      if (latest?.health.funasrRequiredModelsCached) {
        setSetupSteps((steps) =>
          patchStep(steps, "model", {
            status: "skipped",
            detail: "默认模型与辅助模型已在缓存中",
          }),
        );
      } else if (latest?.diskLow) {
        setSetupSteps((steps) =>
          patchStep(steps, "model", { status: "error", detail: "磁盘可用空间不足" }),
        );
        setSetupMessage("磁盘空间不足，无法下载默认模型。请清理后重试。");
        setSetupOutcome("blocked");
        return;
      } else {
        setSetupSteps((steps) =>
          patchStep(steps, "model", { status: "running", detail: "正在下载默认模型…" }),
        );
        await deps.prepareDefaultFunasrModel();
        await deps.refreshAsrRuntimeInfo();
        const after = await refreshSetupDiagnose();
        if (after?.readyForTranscribe) {
          setSetupSteps((steps) =>
            patchStep(steps, "model", {
              status: "ok",
              detail: "默认模型与辅助模型已就绪",
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
      setSetupBusy(false);
    }
  }, [deps, ensureLocalRuntimeInstalled, pollUntilHealth, refreshLocalRuntimeDiagnose, refreshSetupDiagnose, tauriRuntime]);

  return {
    setupReport,
    localRuntimeDiag,
    setupSteps,
    setupBusy,
    diagnoseBusy,
    setupMessage,
    setupOutcome,
    portConflict,
    refreshSetupDiagnose,
    refreshLocalRuntimeDiagnose,
    downloadLocalRuntime,
    cancelLocalRuntime,
    revalidateLocalRuntime,
    clearLocalRuntime,
    restorePreviousLocalRuntime,
    runOneClickAsrPrepare,
    acceptForeignPortService,
  };
}
