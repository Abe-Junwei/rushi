import { useCallback, useState } from "react";
import { asrHealthUrl, isDefaultBundledAsrTarget, isTauriRuntime } from "../config/env";
import {
  ASR_SETUP_INITIAL_STEPS,
  type AsrSetupReport,
  type AsrSetupStep,
  type AsrSetupStepId,
} from "../services/asr/asrSetupContract";
import * as asrSetupApi from "../tauri/asrSetupApi";
import * as projectApi from "../tauri/projectApi";
import { parseAsrHealthJson } from "./useAsrBridgeController";

const HEALTH_POLL_MS = 1000;
const HEALTH_POLL_MAX = 45;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function patchStep(steps: AsrSetupStep[], id: AsrSetupStepId, patch: Partial<AsrSetupStep>): AsrSetupStep[] {
  return steps.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

async function fetchHealthSnapshot(): Promise<ReturnType<typeof parseAsrHealthJson>> {
  const url = asrHealthUrl();
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return parseAsrHealthJson(data);
  } catch {
    return null;
  }
}

export interface AsrSetupControllerApi {
  setupReport: AsrSetupReport | null;
  setupSteps: AsrSetupStep[];
  setupBusy: boolean;
  diagnoseBusy: boolean;
  setupMessage: string;
  portConflict: boolean;
  refreshSetupDiagnose: (options?: { resetSteps?: boolean }) => Promise<AsrSetupReport | null>;
  runOneClickAsrPrepare: () => Promise<void>;
  acceptForeignPortService: () => Promise<void>;
}

export function useAsrSetupController(deps: {
  refreshAsrHealth: () => Promise<void>;
  refreshAsrRuntimeInfo: () => Promise<void>;
  prepareDefaultFunasrModel: () => Promise<void>;
  prepareModelBusy: boolean;
}): AsrSetupControllerApi {
  const tauriRuntime = isTauriRuntime();
  const [setupReport, setSetupReport] = useState<AsrSetupReport | null>(null);
  const [setupSteps, setSetupSteps] = useState<AsrSetupStep[]>(ASR_SETUP_INITIAL_STEPS);
  const [setupBusy, setSetupBusy] = useState(false);
  const [diagnoseBusy, setDiagnoseBusy] = useState(false);
  const [setupMessage, setSetupMessage] = useState("");

  const portConflict = setupReport?.portStatus === "foreign";

  const refreshSetupDiagnose = useCallback(
    async (options?: { resetSteps?: boolean }): Promise<AsrSetupReport | null> => {
      if (!tauriRuntime) {
        setSetupMessage("浏览器预览无法运行环境诊断，请在桌面应用中使用。");
        setSetupReport(null);
        return null;
      }
      const resetSteps = options?.resetSteps !== false;
      setDiagnoseBusy(true);
      if (resetSteps) {
        setSetupSteps(ASR_SETUP_INITIAL_STEPS);
        setSetupSteps((s) =>
          patchStep(s, "diagnose", { status: "running", detail: "正在读取本机环境…" }),
        );
      }
      try {
        const report = await asrSetupApi.asrSetupDiagnose();
        setSetupReport(report);
        setSetupMessage(report.blockingIssue ?? "");
        if (resetSteps) {
          setSetupSteps((s) =>
            patchStep(s, "diagnose", {
              status: "ok",
              detail: report.summaryLines[0] ?? "诊断完成",
            }),
          );
        }
        return report;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setSetupMessage(
          `诊断失败：${msg}。若刚更新代码，请完全退出并重新运行 desktop:dev 以加载新 Tauri 命令。`,
        );
        setSetupReport(null);
        if (resetSteps) {
          setSetupSteps((s) =>
            patchStep(s, "diagnose", { status: "error", detail: msg.slice(0, 120) }),
          );
        }
        return null;
      } finally {
        setDiagnoseBusy(false);
      }
    },
    [tauriRuntime],
  );

  const pollUntilHealth = useCallback(async (): Promise<boolean> => {
    for (let i = 0; i < HEALTH_POLL_MAX; i++) {
      const caps = await fetchHealthSnapshot();
      if (caps?.funasr_ready) {
        await deps.refreshAsrHealth();
        return true;
      }
      if (caps && caps.ffmpeg_ok) {
        await deps.refreshAsrHealth();
      }
      await sleep(HEALTH_POLL_MS);
    }
    await deps.refreshAsrHealth();
    const last = await fetchHealthSnapshot();
    return last?.funasr_ready === true;
  }, [deps]);

  const runOneClickAsrPrepare = useCallback(async () => {
    if (!tauriRuntime) {
      setSetupMessage("一键准备需要在 Tauri 桌面壳中运行。");
      return;
    }
    setSetupBusy(true);
    setSetupSteps(ASR_SETUP_INITIAL_STEPS);
    setSetupMessage("");
    try {
      setSetupSteps((s) => patchStep(s, "diagnose", { status: "running" }));
      const report = await refreshSetupDiagnose({ resetSteps: false });
      if (!report) {
        setSetupSteps((s) => patchStep(s, "diagnose", { status: "error", detail: "诊断失败" }));
        return;
      }
      setSetupSteps((s) =>
        patchStep(s, "diagnose", {
          status: "ok",
          detail: report.summaryLines[0] ?? "诊断完成",
        }),
      );

      if (report.sidecarIntegrity === "corrupt") {
        setSetupSteps((s) =>
          patchStep(s, "sidecar", {
            status: "error",
            detail: "内置侧车包损坏",
          }),
        );
        setSetupMessage(
          report.blockingIssue ??
            "内置侧车包可能损坏（FunASR 资源缺失）。请重新构建侧车（npm run asr:build-sidecar-unix）或等待应用内下载修复（R3h-1）。",
        );
        return;
      }

      if (report.portStatus === "foreign") {
        setSetupSteps((s) =>
          patchStep(s, "sidecar", {
            status: "error",
            detail: report.portDetail ?? "8741 端口冲突",
          }),
        );
        setSetupMessage(report.portDetail ?? "8741 已被占用，请先结束其他 ASR 进程，或改用当前服务。");
        return;
      }

      const needSidecar =
        isDefaultBundledAsrTarget() &&
        report.bundledAvailable &&
        (!report.health.healthReachable || report.portStatus === "free");

      if (needSidecar) {
        setSetupSteps((s) => patchStep(s, "sidecar", { status: "running", detail: "正在启动内置侧车…" }));
        await projectApi.retryBundledAsrSidecar();
        await sleep(1500);
        setSetupSteps((s) => patchStep(s, "sidecar", { status: "ok", detail: "已请求启动侧车" }));
      } else {
        setSetupSteps((s) =>
          patchStep(s, "sidecar", {
            status: "skipped",
            detail: report.bundledAvailable ? "侧车已在运行或无需启动" : "无内置侧车包",
          }),
        );
      }

      setSetupSteps((s) => patchStep(s, "health", { status: "running", detail: "等待 /health…" }));
      const healthOk = await pollUntilHealth();
      if (!healthOk) {
        setSetupSteps((s) =>
          patchStep(s, "health", {
            status: "error",
            detail: "超时：FunASR 未就绪",
          }),
        );
        if (!report.bundledAvailable) {
          setSetupMessage(
            "未检测到内置侧车包（dev 需先 npm run asr:build-sidecar-unix）。也可在终端手动 python -m rushi_asr 后点「刷新诊断」。",
          );
        } else {
          setSetupMessage("侧车已尝试启动，但 FunASR 仍未就绪。请查看「ASR 状态」或导出诊断包。");
        }
        return;
      }
      setSetupSteps((s) => patchStep(s, "health", { status: "ok", detail: "FunASR 已就绪" }));

      const latest = await refreshSetupDiagnose();
      if (latest?.health.funasrDefaultModelCached) {
        setSetupSteps((s) =>
          patchStep(s, "model", { status: "skipped", detail: "默认模型已在缓存中" }),
        );
      } else if (latest?.diskLow) {
        setSetupSteps((s) =>
          patchStep(s, "model", { status: "error", detail: "磁盘可用空间不足" }),
        );
        setSetupMessage("磁盘空间不足，无法下载默认模型。请清理后重试。");
        return;
      } else {
        setSetupSteps((s) => patchStep(s, "model", { status: "running", detail: "正在下载默认模型…" }));
        await deps.prepareDefaultFunasrModel();
        await deps.refreshAsrRuntimeInfo();
        const after = await refreshSetupDiagnose();
        if (after?.readyForTranscribe) {
          setSetupSteps((s) => patchStep(s, "model", { status: "ok", detail: "默认模型已就绪" }));
        } else {
          setSetupSteps((s) =>
            patchStep(s, "model", {
              status: "error",
              detail: "模型下载未完成",
            }),
          );
          setSetupMessage("模型下载可能失败，请查看模型下载区的错误提示并重试。");
          return;
        }
      }

      setSetupSteps((s) => patchStep(s, "done", { status: "ok", detail: "本机 ASR 已可用于转写" }));
      setSetupMessage("一键准备完成，可直接开始转写。");
      await deps.refreshAsrRuntimeInfo();
    } finally {
      setSetupBusy(false);
    }
  }, [deps, pollUntilHealth, refreshSetupDiagnose, tauriRuntime]);

  const acceptForeignPortService = useCallback(async () => {
    setSetupBusy(true);
    try {
      setSetupSteps((s) => patchStep(s, "sidecar", { status: "skipped", detail: "使用当前 8741 服务" }));
      setSetupSteps((s) => patchStep(s, "health", { status: "running" }));
      const caps = await fetchHealthSnapshot();
      await deps.refreshAsrHealth();
      if (!caps) {
        setSetupSteps((s) =>
          patchStep(s, "health", {
            status: "error",
            detail: "当前服务不是 rushi-asr",
          }),
        );
        setSetupMessage("8741 上的服务无法按 rushi-asr 解析，无法继续使用。");
        return;
      }
      setSetupSteps((s) => patchStep(s, "health", { status: "ok", detail: "已连接当前 ASR" }));
      if (!caps.funasr_default_model_cached && caps.funasr_ready) {
        await deps.prepareDefaultFunasrModel();
      }
      await deps.refreshAsrRuntimeInfo();
      await refreshSetupDiagnose();
      setSetupMessage("已使用当前 8741 服务；若模型未缓存请继续下载默认模型。");
    } finally {
      setSetupBusy(false);
    }
  }, [deps, refreshSetupDiagnose]);

  return {
    setupReport,
    setupSteps,
    setupBusy,
    diagnoseBusy,
    setupMessage,
    portConflict,
    refreshSetupDiagnose,
    runOneClickAsrPrepare,
    acceptForeignPortService,
  };
}
