import {
  ASR_SETUP_INITIAL_STEPS,
  type AsrSetupOutcome,
  type AsrSetupReport,
  type AsrSetupStep,
  type AsrSetupStepId,
} from "../services/asr/asrSetupContract";
import { buildPrepareJobPresentation } from "../services/asr/prepareJobPresentation";

export function patchStep(
  steps: AsrSetupStep[],
  id: AsrSetupStepId,
  patch: Partial<AsrSetupStep>,
): AsrSetupStep[] {
  return steps.map((step) => (step.id === id ? { ...step, ...patch } : step));
}

export function initialSetupSteps(): AsrSetupStep[] {
  return ASR_SETUP_INITIAL_STEPS.map((step) => ({ ...step }));
}

const FUNASR_RUNTIME_LOADED_DETAIL = "FunASR 运行时已加载（不含模型权重）";

function diagnoseStepDetail(report: AsrSetupReport): string {
  const sup = report.supervisor;
  if (sup.lrcInstallPhase) {
    return `LRC 安装中：${sup.lrcInstallPhase}`;
  }
  if (sup.preparePhase === "stale") {
    return sup.prepareJobId
      ? `模型下载可能卡住（${sup.prepareJobId}）`
      : "模型下载可能卡住";
  }
  if (sup.preparePhase === "running") {
    return sup.prepareJobId
      ? `模型下载中（${sup.prepareJobId}）`
      : "模型下载中";
  }
  if (sup.preparePhase) {
    return `模型准备：${sup.preparePhase}`;
  }
  return report.summaryLines[0] ?? "诊断完成";
}

export type StepsFromReportOptions = {
  prepareModelBusy?: boolean;
  prepareModelProgress?: number;
};

export function stepsFromReport(
  report: AsrSetupReport,
  options?: StepsFromReportOptions,
): AsrSetupStep[] {
  let steps = initialSetupSteps();
  steps = patchStep(steps, "diagnose", {
    status: "ok",
    detail: diagnoseStepDetail(report),
  });

  if (report.sidecarIntegrity === "corrupt") {
    steps = patchStep(steps, "sidecar", { status: "error", detail: "内置侧车包损坏" });
  } else if (report.portStatus === "foreign") {
    const recoverable = report.blockingIssue == null;
    steps = patchStep(steps, "sidecar", {
      status: recoverable ? "pending" : "error",
      detail: report.portDetail ?? (recoverable ? "待启动或端口占用" : "8741 端口冲突"),
    });
  } else if (report.health.healthReachable) {
    steps = patchStep(steps, "sidecar", {
      status: "skipped",
      detail: report.bundledAvailable ? "侧车进程已连接" : "ASR 服务已连接",
    });
  } else if (report.bundledAvailable) {
    steps = patchStep(steps, "sidecar", { status: "pending", detail: "待启动" });
  } else {
    steps = patchStep(steps, "sidecar", { status: "skipped", detail: "无内置侧车包" });
  }

  if (report.health.healthReachable) {
    steps = patchStep(steps, "health", {
      status: report.health.funasrReady ? "ok" : "error",
      detail: report.health.funasrReady ? FUNASR_RUNTIME_LOADED_DETAIL : "FunASR 未就绪",
    });
  } else {
    steps = patchStep(steps, "health", { status: "pending", detail: "待检测" });
  }

  const prepareBusy = options?.prepareModelBusy === true;
  const prepareProgress = options?.prepareModelProgress ?? 0;

  if (prepareBusy) {
    steps = patchStep(steps, "model", {
      status: "running",
      detail: buildPrepareJobPresentation({
        localBusy: true,
        progressOverride: prepareProgress,
      }).wizardDetail,
    });
  } else if (report.health.funasrRequiredModelsCached) {
    steps = patchStep(steps, "model", {
      status: "ok",
      detail: "模型已就绪",
    });
  } else if (report.health.funasrDefaultModelCached && !report.health.funasrVadModelCached) {
    steps = patchStep(steps, "model", {
      status: "error",
      detail: "VAD 模型未完成",
    });
  } else if (report.diskLow && report.health.funasrReady) {
    steps = patchStep(steps, "model", { status: "error", detail: "磁盘空间不足" });
  } else if (report.health.funasrReady) {
    steps = patchStep(steps, "model", { status: "pending", detail: "待下载模型" });
  } else {
    steps = patchStep(steps, "model", {
      status: "pending",
      detail: "待 FunASR 就绪",
    });
  }

  if (report.readyForTranscribe && !prepareBusy) {
    steps = patchStep(steps, "done", { status: "ok", detail: "可开始转写" });
  }
  return steps;
}

export function outcomeFromReport(report: AsrSetupReport): AsrSetupOutcome {
  if (report.readyForTranscribe) return "ready";
  if (report.blockingIssue) return "blocked";
  if (report.sidecarIntegrity === "corrupt") return "error";
  if (report.health.healthReachable && !report.health.funasrReady) return "error";
  return "idle";
}
