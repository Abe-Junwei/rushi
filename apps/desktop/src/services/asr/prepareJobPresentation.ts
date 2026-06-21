import {
  clampPrepareProgressPercent,
  computePrepareModelProgress,
  monotonicPrepareProgress,
  parsePrepareProgressPercent,
} from "../../pages/prepareModelProgress";
import {
  buildBundledModelJobPresentation,
  usesBundledAsrModelStack,
} from "./bundledModelJobPresentation";

/** Align with Python prepare_state stale threshold and prior UI stall timer. */
export const PREPARE_STALL_MS = 120_000;

export type SidecarPrepareStatus = {
  phase: string;
  message: string;
  progressPercent: number | null;
  updatedAtMs: number | null;
  stale: boolean;
  errorCode: string | null;
  jobId: string | null;
};

export function parseSidecarPrepareStatus(raw: Record<string, unknown>): SidecarPrepareStatus {
  return {
    phase: typeof raw.phase === "string" ? raw.phase : "?",
    message: typeof raw.message === "string" ? raw.message : "",
    progressPercent: parsePrepareProgressPercent(raw.progress_percent),
    updatedAtMs:
      typeof raw.updated_at_ms === "number" && Number.isFinite(raw.updated_at_ms)
        ? raw.updated_at_ms
        : null,
    stale: raw.stale === true,
    errorCode: typeof raw.error_code === "string" ? raw.error_code : null,
    jobId: typeof raw.job_id === "string" ? raw.job_id : null,
  };
}

export type PrepareJobPresentationInput = {
  status?: SidecarPrepareStatus | null;
  localBusy?: boolean;
  cancelling?: boolean;
  modelLabel?: string;
  stageStartedAtMs?: number;
  lastLocalProgressAtMs?: number;
  progressOverride?: number;
  waitElapsedMs?: number;
  nowMs?: number;
};

export type PrepareJobPresentation = {
  active: boolean;
  cancelling: boolean;
  stalled: boolean;
  shouldForceResume: boolean;
  progress: number;
  progressLabel: string;
  wizardDetail: string;
  envBannerDetail: string;
  stageTitle: string;
  installMessage: string;
};

function prepareStageTitle(message: string, modelLabel: string): string {
  if (message === "downloading_vad") return "正在下载必需辅助模型（VAD）…";
  if (message === "downloading_punc") return "正在下载标点模型（ct-punc）…";
  return `正在下载主模型（${modelLabel}）…`;
}

export function formatPrepareWaitElapsed(elapsedMs: number): string {
  const secs = Math.max(0, Math.floor(elapsedMs / 1000));
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

function resolveProgress(input: PrepareJobPresentationInput): number {
  const status = input.status;
  if (input.cancelling) {
    if (input.progressOverride != null) {
      return clampPrepareProgressPercent(input.progressOverride, "running");
    }
    if (status?.progressPercent != null) {
      return clampPrepareProgressPercent(status.progressPercent, status.phase);
    }
    return 0;
  }
  if (status?.progressPercent != null) {
    return clampPrepareProgressPercent(status.progressPercent, status.phase);
  }
  if (status?.phase === "running" && status.message) {
    const now = input.nowMs ?? Date.now();
    const startedAt = input.stageStartedAtMs ?? now;
    const fallback = computePrepareModelProgress(status.message, now - startedAt);
    if (input.progressOverride != null) {
      return monotonicPrepareProgress(input.progressOverride, fallback);
    }
    return fallback;
  }
  if (input.progressOverride != null) {
    return clampPrepareProgressPercent(input.progressOverride);
  }
  return 0;
}

/** Preserve byte progress after cooperative cancel (resume-friendly, Steam/Firefox-style). */
export function resolveCancelledPrepareProgress(
  status: SidecarPrepareStatus | undefined,
  lastLocalProgress: number,
): number {
  const fromServer = status?.progressPercent;
  if (fromServer != null && lastLocalProgress >= 0) {
    return Math.max(fromServer, lastLocalProgress);
  }
  if (fromServer != null) return fromServer;
  if (lastLocalProgress >= 0) return lastLocalProgress;
  return 0;
}

function isPrepareJobStalled(input: PrepareJobPresentationInput, progress: number): boolean {
  if (input.cancelling) return false;
  const status = input.status;
  if (status?.phase !== "running" && input.localBusy !== true) return false;

  const lastBump = input.lastLocalProgressAtMs;
  if (lastBump == null) return false;
  const now = input.nowMs ?? Date.now();
  if (now - lastBump <= PREPARE_STALL_MS) return false;

  // Sidecar `stale` / `updated_at_ms` track stage-message age, not byte progress.
  // Force-resume only when local progress percent has plateaued for the full window.
  if (status?.progressPercent != null || input.progressOverride != null) {
    return true;
  }
  return progress > 0;
}

export function buildPrepareJobPresentation(
  input: PrepareJobPresentationInput,
): PrepareJobPresentation {
  const sidecarDriven = input.status?.phase != null && input.status.phase !== "?";
  if (
    usesBundledAsrModelStack() &&
    (input.localBusy === true || input.cancelling === true) &&
    !sidecarDriven
  ) {
    const bundled = buildBundledModelJobPresentation({
      progress: input.progressOverride ?? 0,
    });
    return {
      active: true,
      cancelling: input.cancelling === true,
      stalled: false,
      shouldForceResume: false,
      progress: bundled.progress,
      progressLabel: bundled.progressLabel,
      wizardDetail: bundled.wizardDetail,
      envBannerDetail: bundled.envBannerDetail,
      stageTitle: bundled.stageTitle,
      installMessage: bundled.installMessage,
    };
  }

  const cancelling = input.cancelling === true;
  const active = cancelling || input.localBusy === true || input.status?.phase === "running";
  const modelLabel = input.modelLabel?.trim() || "模型";
  const progress = resolveProgress(input);
  const stalled = isPrepareJobStalled(input, progress);
  const stageTitle = prepareStageTitle(input.status?.message ?? "", modelLabel);
  const waitSuffix =
    input.waitElapsedMs != null
      ? ` 已等待 ${formatPrepareWaitElapsed(input.waitElapsedMs)}。请保持应用开启并联网，尽量不要关闭当前窗口。`
      : "";

  if (cancelling) {
    const cancelLabel =
      progress > 0 ? `正在取消… ${progress}%` : "正在取消下载…";
    return {
      active: true,
      cancelling: true,
      stalled: false,
      shouldForceResume: false,
      progress,
      progressLabel: cancelLabel,
      wizardDetail: cancelLabel,
      envBannerDetail: "侧车将在当前文件传完后停止；已完成部分保留在磁盘，可重新点「下载当前模型」续传。",
      stageTitle: "正在取消下载",
      installMessage: "正在取消下载，等待侧车结束当前传输…",
    };
  }

  if (active) {
    const progressLabel = `下载中… ${progress}%`;
    const wizardDetail =
      progress > 0 ? `正在下载模型（${progress}%）` : "正在下载模型";
    const envBannerDetail =
      progress > 0
        ? `正在下载转写模型（${progress}%），完成后方可转写。请保持应用开启并联网。`
        : "正在下载转写模型，完成后方可转写。请保持应用开启并联网。";
    return {
      active: true,
      cancelling: false,
      stalled,
      shouldForceResume: stalled,
      progress,
      progressLabel,
      wizardDetail,
      envBannerDetail,
      stageTitle,
      installMessage: `${stageTitle}${waitSuffix}`,
    };
  }

  return {
    active: false,
    cancelling: false,
    stalled: false,
    shouldForceResume: false,
    progress,
    progressLabel: progress > 0 ? `下载中… ${progress}%` : "未下载",
    wizardDetail: progress > 0 ? `正在下载模型（${progress}%）` : "正在下载模型",
    envBannerDetail: "正在下载转写模型，完成后方可转写。请保持应用开启并联网。",
    stageTitle,
    installMessage: stageTitle,
  };
}

/** D7 overlay inputs: LRC install vs model prepare busy (UI-only merge). */
export type ArtifactBusyStateInput = {
  prepareModelBusy?: boolean;
  prepareModelCancelling?: boolean;
  runtimeInstallRunning?: boolean;
  setupBusy?: boolean;
  diagnoseBusy?: boolean;
  transcribeBusy?: boolean;
};

export type ArtifactBusyState = {
  deferEnvRefresh: boolean;
  d7Kind: "none" | "lrc" | "prepare_cancel" | "prepare";
};

export function mergeArtifactBusyState(input: ArtifactBusyStateInput): ArtifactBusyState {
  const prepareCancel = input.prepareModelCancelling === true;
  const prepareBusy = input.prepareModelBusy === true;
  const lrc = input.runtimeInstallRunning === true;

  let d7Kind: ArtifactBusyState["d7Kind"] = "none";
  if (lrc) d7Kind = "lrc";
  else if (prepareCancel) d7Kind = "prepare_cancel";
  else if (prepareBusy) d7Kind = "prepare";

  const deferEnvRefresh =
    input.transcribeBusy === true ||
    prepareBusy ||
    prepareCancel ||
    lrc ||
    input.setupBusy === true ||
    input.diagnoseBusy === true;

  return { deferEnvRefresh, d7Kind };
}
