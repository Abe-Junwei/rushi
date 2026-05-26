import {
  ASR_SETUP_INITIAL_STEPS,
  type AsrSetupOutcome,
  type AsrSetupReport,
  type AsrSetupStep,
  type AsrSetupStepId,
} from "../services/asr/asrSetupContract";

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

export function stepsFromReport(report: AsrSetupReport): AsrSetupStep[] {
  let steps = initialSetupSteps();
  steps = patchStep(steps, "diagnose", {
    status: "ok",
    detail: report.summaryLines[0] ?? "诊断完成",
  });

  if (report.sidecarIntegrity === "corrupt") {
    steps = patchStep(steps, "sidecar", { status: "error", detail: "内置侧车包损坏" });
  } else if (report.portStatus === "foreign") {
    steps = patchStep(steps, "sidecar", {
      status: "error",
      detail: report.portDetail ?? "8741 端口冲突",
    });
  } else if (report.health.healthReachable) {
    steps = patchStep(steps, "sidecar", {
      status: "skipped",
      detail: report.bundledAvailable ? "侧车已可用" : "当前服务已可用",
    });
  } else if (report.bundledAvailable) {
    steps = patchStep(steps, "sidecar", { status: "pending", detail: "待启动内置侧车" });
  } else {
    steps = patchStep(steps, "sidecar", { status: "skipped", detail: "当前无内置侧车包" });
  }

  if (report.health.healthReachable) {
    steps = patchStep(steps, "health", {
      status: report.health.funasrReady ? "ok" : "error",
      detail: report.health.funasrReady ? "FunASR 运行时已就绪" : "FunASR 运行时未就绪",
    });
  } else {
    steps = patchStep(steps, "health", { status: "pending", detail: "待检测 /health" });
  }

  if (report.health.funasrRequiredModelsCached) {
    steps = patchStep(steps, "model", {
      status: "ok",
      detail: "默认模型与必需辅助模型已就绪",
    });
  } else if (report.health.funasrDefaultModelCached && !report.health.funasrVadModelCached) {
    steps = patchStep(steps, "model", {
      status: "error",
      detail: "辅助 VAD 模型尚未完成",
    });
  } else if (report.diskLow && report.health.funasrReady) {
    steps = patchStep(steps, "model", { status: "error", detail: "磁盘可用空间不足" });
  } else if (report.health.funasrReady) {
    steps = patchStep(steps, "model", { status: "pending", detail: "待下载默认模型" });
  } else {
    steps = patchStep(steps, "model", {
      status: "pending",
      detail: "待 FunASR 运行时就绪后继续",
    });
  }

  if (report.readyForTranscribe) {
    steps = patchStep(steps, "done", { status: "ok", detail: "本机 ASR 已可用于转写" });
  }
  return steps;
}

export function outcomeFromReport(report: AsrSetupReport): AsrSetupOutcome {
  if (report.readyForTranscribe) return "ready";
  if (report.blockingIssue) return "blocked";
  return "idle";
}
