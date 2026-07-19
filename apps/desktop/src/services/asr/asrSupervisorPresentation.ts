import type { BundledAsrLaunchReport } from "../../tauri/projectApi";
import type { AsrSetupReport, AsrSetupStepStatus, AsrSupervisorSnapshot } from "./asrSetupContract";

const PORT_FOREIGN_DETAIL = "8741 端口被其他程序占用。";

/** Shared launch / degrade error copy (keep in sync with Rust `launch_report_from_snapshot`). */
export const LAUNCH_ERROR_DETAIL: Record<string, string> = {
  health_timeout:
    "已尝试启动安装包内的推理侧车，但在等待时间内未收到 /health 成功响应（若同时存在 CUDA 与 CPU 包，可能均已失败）。请确认本机 8741 端口未被其他 rushi-asr 占用；可设置 RUSHI_SKIP_BUNDLED_ASR=1 后手动启动 ASR，或使用「导出诊断包」查看更多信息。",
  foreign_port: PORT_FOREIGN_DETAIL,
  port_foreign: PORT_FOREIGN_DETAIL,
  spawn_failed: "无法启动内置侧车可执行文件。",
  /** Mapped for completeness; lifecycle currently surfaces early exit as health_timeout. */
  child_exited: "侧车进程在就绪前退出。",
  health_lost: "侧车曾就绪但后续 /health 不可用。",
  asr_warmup_failed: "侧车预热失败（不影响空闲回收后的再次启动）。",
};

/** Idle recycle: phase stopped, no error, had a known executable — not a fault. */
export function idleStoppedAfterSuccess(snap: AsrSupervisorSnapshot): boolean {
  return (
    snap.phase === "stopped" &&
    !snap.lastErrorCode &&
    snap.executableSource !== "none"
  );
}

/** Mirror Rust `launch_report_from_snapshot` for env-page consumers. */
export function launchReportFromSupervisor(
  snap: AsrSupervisorSnapshot,
): BundledAsrLaunchReport {
  const attempted =
    snap.phase === "spawning" ||
    snap.phase === "warming" ||
    snap.phase === "degraded" ||
    snap.phase === "ready" ||
    snap.phase === "stopping" ||
    idleStoppedAfterSuccess(snap);
  const success = snap.phase === "ready" || idleStoppedAfterSuccess(snap);
  const code = snap.lastErrorCode?.trim();
  const detail = code
    ? (LAUNCH_ERROR_DETAIL[code] ?? code)
    : null;
  return { attempted, success, detail };
}

export function formatSupervisorPhaseLabel(phase: AsrSupervisorSnapshot["phase"]): string {
  switch (phase) {
    case "idle":
      return "侧车未启动";
    case "unmanaged":
      return "外置 / 开发侧车";
    case "probing":
      return "正在探测端口";
    case "stopping":
      return "正在停止侧车";
    case "spawning":
      return "正在启动侧车";
    case "warming":
      return "侧车预热中";
    case "ready":
      return "侧车已就绪";
    case "degraded":
      return "侧车降级";
    case "stopped":
      return "侧车已停止";
    default:
      return "侧车状态未知";
  }
}

export type SidecarStepPatch = {
  status: AsrSetupStepStatus;
  detail: string;
};

/**
 * Prefer supervisor `phase` + report `portStatus` for the setup wizard sidecar step.
 */
export function sidecarStepFromSupervisor(report: AsrSetupReport): SidecarStepPatch {
  if (report.sidecarIntegrity === "corrupt") {
    return { status: "error", detail: "内置侧车包损坏" };
  }

  const phase = report.supervisor.phase;
  const port = report.portStatus;
  const snapPort = report.supervisor.portStatus;

  if (port === "foreign" || snapPort === "foreign") {
    const recoverable = report.blockingIssue == null;
    return {
      status: recoverable ? "pending" : "error",
      detail: report.portDetail ?? (recoverable ? "待启动或端口占用" : "8741 端口冲突"),
    };
  }

  if (report.health.healthReachable || phase === "ready") {
    return {
      status: "skipped",
      detail: report.bundledAvailable ? "侧车进程已连接" : "ASR 服务已连接",
    };
  }

  if (phase === "spawning" || phase === "warming" || phase === "probing" || phase === "stopping") {
    return { status: "running", detail: formatSupervisorPhaseLabel(phase) };
  }

  if (phase === "degraded" || (phase === "stopped" && report.supervisor.lastErrorCode)) {
    const err = report.supervisor.lastErrorCode?.trim();
    return {
      status: "error",
      detail: err ? (LAUNCH_ERROR_DETAIL[err] ?? err) : formatSupervisorPhaseLabel(phase),
    };
  }

  if (phase === "unmanaged") {
    return { status: "skipped", detail: formatSupervisorPhaseLabel(phase) };
  }

  if (report.bundledAvailable) {
    return { status: "pending", detail: formatSupervisorPhaseLabel(phase) };
  }

  return { status: "skipped", detail: "无内置侧车包" };
}
