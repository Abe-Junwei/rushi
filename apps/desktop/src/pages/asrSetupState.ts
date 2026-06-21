import {
  ASR_SETUP_INITIAL_STEPS,
  type AsrSetupOutcome,
  type AsrSetupReport,
  type AsrSetupStep,
  type AsrSetupStepId,
} from "../services/asr/asrSetupContract";
import { usesBundledAsrModelStack } from "../services/asr/bundledModelJobPresentation";
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
    return usesBundledAsrModelStack()
      ? "内置模型复制可能卡住"
      : sup.prepareJobId
        ? `模型下载可能卡住（${sup.prepareJobId}）`
        : "模型下载可能卡住";
  }
  if (sup.preparePhase === "running") {
    return usesBundledAsrModelStack()
      ? "正在从安装包复制内置模型"
      : sup.prepareJobId
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
  prepareModelCancelling?: boolean;
  prepareModelProgress?: number;
  /** R3-STATE：当前 UI 所选 SKU 是否可转写（非 /health 全局 T）。 */
  selectedModelReady?: boolean;
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
  const prepareCancelling = options?.prepareModelCancelling === true;
  const prepareProgress = options?.prepareModelProgress ?? 0;
  const selectedModelReady = options?.selectedModelReady === true;

  if (prepareBusy) {
    steps = patchStep(steps, "model", {
      status: "running",
      detail: buildPrepareJobPresentation({
        localBusy: true,
        progressOverride: prepareProgress,
      }).wizardDetail,
    });
  } else if (prepareCancelling) {
    steps = patchStep(steps, "model", {
      status: "running",
      detail: usesBundledAsrModelStack() ? "正在复制内置模型…" : "正在取消下载…",
    });
  } else if (selectedModelReady) {
    steps = patchStep(steps, "model", {
      status: "ok",
      detail: "当前所选模型已就绪",
    });
  } else if (report.health.funasrDefaultModelCached && !report.health.funasrVadModelCached) {
    steps = patchStep(steps, "model", {
      status: "error",
      detail: "VAD 模型未完成",
    });
  } else if (report.diskLow && report.health.funasrReady) {
    steps = patchStep(steps, "model", { status: "error", detail: "磁盘空间不足" });
  } else if (report.health.funasrReady) {
    steps = patchStep(steps, "model", {
      status: "pending",
      detail: usesBundledAsrModelStack() ? "待从安装包复制" : "待下载模型",
    });
  } else {
    steps = patchStep(steps, "model", {
      status: "pending",
      detail: "待 FunASR 就绪",
    });
  }

  if (selectedModelReady && !prepareBusy && !prepareCancelling) {
    steps = patchStep(steps, "done", { status: "ok", detail: "可开始转写" });
  }
  return steps;
}

export function outcomeFromReport(
  report: AsrSetupReport,
  options?: Pick<StepsFromReportOptions, "selectedModelReady" | "prepareModelBusy" | "prepareModelCancelling">,
): AsrSetupOutcome {
  if (
    options?.selectedModelReady === true &&
    options?.prepareModelBusy !== true &&
    options?.prepareModelCancelling !== true
  ) {
    return "ready";
  }
  if (report.blockingIssue) return "blocked";
  if (report.sidecarIntegrity === "corrupt") return "error";
  if (report.health.healthReachable && !report.health.funasrReady) return "error";
  return "idle";
}
