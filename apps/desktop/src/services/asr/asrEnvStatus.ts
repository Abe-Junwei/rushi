import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import type { AsrHealthState } from "../../pages/useAsrHealthPoll";
import {
  ffmpegBannerDetailDev,
  ffmpegBannerDetailPackaged,
  ffmpegBlockReasonDev,
  ffmpegBlockReasonPackaged,
  ffmpegMissingDev,
  ffmpegMissingPackaged,
  modelsPathMismatchDev,
  modelsPathMismatchPackaged,
  packagedOrDev,
  sidecarAsyncTranscribeBlockReasonDev,
  sidecarAsyncTranscribeBlockReasonManaged,
} from "../packagedUserHints";
import {
  computeLocalAsrTranscribeReady,
  type LocalAsrCatalogStatusItem,
} from "./localAsrModelCatalog";
import { modelsRootMismatch } from "./asrRuntimePathsAlign";

type AsrEnvTone = "ok" | "warn" | "error" | "idle";

export type AsrEnvStatusRow = {
  id: "env" | "ffmpeg" | "runtime" | "transcribe" | "inference_queue";
  label: string;
  ok: boolean;
  text: string;
  warn?: boolean;
};

/** 本机 ASR 环境状态唯一 presentation 真源：顶栏芯片 / 设置页 / 转写预检共用。 */
export type AsrEnvPresentation = {
  health: AsrHealthState;
  transcribeReady: boolean;
  sidecarMatchesSelection: boolean;
  ffmpegOk: boolean;
  envOk: boolean;
  runtimeReady: boolean;
  tone: AsrEnvTone;
  chipLabel: string;
  chipOk: boolean;
  chipTitle: string;
  ffmpegChipOk: boolean;
  ffmpegChipTitle: string;
  statusRows: AsrEnvStatusRow[];
  bannerTitle: string;
  bannerDetail: string;
  blockReason: string | null;
  errorDetail: string | null;
  errorBannerMessage: string;
  connectedGuidance: string | null;
  ffmpegWarning: string | null;
  cachePathMismatch: boolean;
  cachePathMismatchDetail: string | null;
  modelsOnDiskButSidecarBlind: boolean;
  modelsOnDiskButSidecarBlindDetail: string | null;
};

export type BuildAsrEnvPresentationInput = {
  asrHealth: AsrHealthState;
  asrHealthDetail: string;
  asrCaps: AsrHealthCapabilities | null;
  selectedHubModelId?: string | null;
  catalogStatus?: LocalAsrCatalogStatusItem[] | null;
  desktopModelsRoot?: string | null;
  sidecarModelsRoot?: string | null;
  asrModelCacheBytes?: number;
  sidecarAsyncTranscribeCapable?: boolean;
  prepareModelBusy?: boolean;
  prepareModelCancelling?: boolean;
  prepareModelProgress?: number;
};

/** 顶栏/转写预检：模型就绪且侧车支持 async 路由 */
function effectiveTranscribeReady(input: {
  transcribeReady: boolean;
  sidecarAsyncTranscribeCapable?: boolean;
}): boolean {
  if (!input.transcribeReady) return false;
  if (input.sidecarAsyncTranscribeCapable === false) return false;
  return true;
}

function chipLabelFor(input: {
  asrHealth: AsrHealthState;
  transcribeReady: boolean;
  sidecarAsyncTranscribeCapable?: boolean;
}): string {
  if (input.asrHealth === "checking") return "ASR 检测中";
  if (input.asrHealth === "error") return "ASR 未连接";
  const ready = effectiveTranscribeReady(input);
  return ready ? "ASR 就绪" : "ASR 未就绪";
}

function toneFor(input: {
  asrHealth: AsrHealthState;
  transcribeReady: boolean;
  envOk: boolean;
  sidecarAsyncTranscribeCapable?: boolean;
}): AsrEnvTone {
  if (input.asrHealth === "checking") return "idle";
  if (input.asrHealth === "error" || !input.envOk) return "error";
  return effectiveTranscribeReady(input) ? "ok" : "warn";
}

function bannerTitleFor(input: {
  asrHealth: AsrHealthState;
  transcribeReady: boolean;
  sidecarAsyncTranscribeCapable?: boolean;
}): string {
  if (input.asrHealth === "checking") return "本机 ASR · 检测中";
  if (input.asrHealth === "error") return "本机 ASR · 环境异常";
  return effectiveTranscribeReady(input) ? "本机 ASR · 可直接转写" : "本机 ASR · 已连接";
}

function bannerDetailFor(input: {
  asrHealth: AsrHealthState;
  asrHealthDetail: string;
  transcribeReady: boolean;
  runtimeReady: boolean;
  ffmpegOk: boolean;
  connectedGuidance: string | null;
}): string {
  if (input.asrHealth === "checking") return "正在检测 127.0.0.1:8741…";
  if (input.asrHealth === "error") {
    return input.asrHealthDetail.trim() || "无法连接本机 ASR，请检查侧车是否在运行。";
  }
  if (input.transcribeReady) {
    return "侧车、FFmpeg 与模型已就绪，可直接转写。";
  }
  if (!input.ffmpegOk) {
    return packagedOrDev(ffmpegBannerDetailDev, ffmpegBannerDetailPackaged);
  }
  if (!input.runtimeReady) {
    return "FunASR 未就绪，请下载模型或一键准备。";
  }
  return input.connectedGuidance ?? "所选模型尚未齐备。";
}

function connectedGuidanceFor(input: {
  asrCaps: AsrHealthCapabilities;
  sidecarMatchesSelection: boolean;
}): string {
  if (!input.sidecarMatchesSelection) {
    return "所选模型未应用到侧车，请先「应用并重启侧车」。";
  }
  return `模型或 VAD/标点未齐备（mode: ${input.asrCaps.transcription_mode}）。请下载当前模型或切换已缓存模型。`;
}

function blockReasonFor(input: {
  asrHealth: AsrHealthState;
  asrCaps: AsrHealthCapabilities | null;
  transcribeReady: boolean;
  sidecarMatchesSelection: boolean;
  sidecarAsyncTranscribeCapable?: boolean;
}): string | null {
  if (input.asrHealth !== "ok" || !input.asrCaps) {
    return "本机 ASR 未就绪：请先在「环境 → 本机 ASR」完成侧车与模型准备。";
  }
  if (input.sidecarAsyncTranscribeCapable === false) {
    return packagedOrDev(
      sidecarAsyncTranscribeBlockReasonDev,
      sidecarAsyncTranscribeBlockReasonManaged,
    );
  }
  if (input.transcribeReady) return null;
  if (input.asrCaps.ffmpeg_ok !== true) {
    return packagedOrDev(ffmpegBlockReasonDev, ffmpegBlockReasonPackaged);
  }
  if (!input.sidecarMatchesSelection) {
    return "所选模型与侧车不一致：请先「应用并重启侧车」。";
  }
  return "所选模型未就绪：请先下载并完成准备。";
}

function applyPrepareModelOverlay(
  presentation: AsrEnvPresentation,
  input: BuildAsrEnvPresentationInput,
): AsrEnvPresentation {
  if (input.prepareModelCancelling) {
    return {
      ...presentation,
      transcribeReady: false,
      tone: "warn",
      chipLabel: "ASR 未就绪",
      chipOk: false,
      bannerTitle: "本机 ASR · 正在取消下载",
      bannerDetail: "侧车将在当前文件传完后停止；完成后可重新点「下载当前模型」。",
      statusRows: presentation.statusRows.map((row) =>
        row.id === "transcribe" ? { ...row, ok: false, text: "取消中", warn: true } : row,
      ),
      blockReason: "模型下载取消中，暂不可转写。",
    };
  }

  if (!input.prepareModelBusy) return presentation;

  const progress = input.prepareModelProgress ?? 0;
  return {
    ...presentation,
    transcribeReady: false,
    tone: "warn",
    chipLabel: "ASR 未就绪",
    chipOk: false,
    bannerTitle: "本机 ASR · 正在下载模型",
    bannerDetail:
      progress > 0
        ? `正在下载转写模型（${progress}%），完成后方可转写。请保持应用开启并联网。`
        : "正在下载转写模型，完成后方可转写。请保持应用开启并联网。",
    statusRows: presentation.statusRows.map((row) => {
      if (row.id === "runtime") return { ...row, ok: false, text: "下载中", warn: true };
      if (row.id === "transcribe") return { ...row, ok: false, text: "下载中", warn: true };
      return row;
    }),
    blockReason: "所选模型正在下载，完成后方可转写。",
  };
}

export function buildAsrEnvPresentation(input: BuildAsrEnvPresentationInput): AsrEnvPresentation {
  const envOk = input.asrHealth === "ok";
  const ffmpegOk = input.asrCaps?.ffmpeg_ok === true;
  const runtimeReady = envOk && input.asrCaps?.funasr_ready === true;
  const { ready: transcribeReady, sidecarMatchesSelection } = computeLocalAsrTranscribeReady({
    asrHealth: input.asrHealth,
    asrCaps: input.asrCaps,
    selectedHubModelId: input.selectedHubModelId,
    catalogStatus: input.catalogStatus,
  });
  const cachePathMismatch =
    envOk && modelsRootMismatch(input.desktopModelsRoot ?? null, input.sidecarModelsRoot ?? null);
  const modelsOnDiskButSidecarBlind =
    envOk && (input.asrModelCacheBytes ?? 0) > 0 && !input.sidecarModelsRoot;
  const connectedGuidance =
    envOk && input.asrCaps && !transcribeReady && !cachePathMismatch && !modelsOnDiskButSidecarBlind
      ? connectedGuidanceFor({ asrCaps: input.asrCaps, sidecarMatchesSelection })
      : null;

  const chipLabel = chipLabelFor({
    asrHealth: input.asrHealth,
    transcribeReady,
    sidecarAsyncTranscribeCapable: input.sidecarAsyncTranscribeCapable,
  });
  const tone = toneFor({
    asrHealth: input.asrHealth,
    transcribeReady,
    envOk,
    sidecarAsyncTranscribeCapable: input.sidecarAsyncTranscribeCapable,
  });
  const presentationTranscribeReady = effectiveTranscribeReady({
    transcribeReady,
    sidecarAsyncTranscribeCapable: input.sidecarAsyncTranscribeCapable,
  });

  const statusRows: AsrEnvStatusRow[] = [
    { id: "env", label: "环境", ok: envOk, text: envOk ? "侧车已连接" : "连接失败" },
    { id: "ffmpeg", label: "FFmpeg", ok: ffmpegOk, text: ffmpegOk ? "可用" : "未检测到" },
    { id: "runtime", label: "运行时", ok: runtimeReady, text: runtimeReady ? "FunASR 就绪" : "未就绪" },
    {
      id: "transcribe",
      label: "转写",
      ok: presentationTranscribeReady,
      text: presentationTranscribeReady
        ? "所选模型可转写"
        : input.sidecarAsyncTranscribeCapable === false
          ? "侧车需升级"
          : "不可用",
    },
  ];
  const queuePending = input.asrCaps?.inference_queue_pending ?? 0;
  const queueRunning = input.asrCaps?.inference_queue_running ?? 0;
  if (queuePending + queueRunning > 0) {
    statusRows.push({
      id: "inference_queue",
      label: "推理队列",
      ok: true,
      text: `排队 ${queuePending} · 运行 ${queueRunning}`,
    });
  }

  const blockReason = blockReasonFor({
    asrHealth: input.asrHealth,
    asrCaps: input.asrCaps,
    transcribeReady,
    sidecarMatchesSelection,
    sidecarAsyncTranscribeCapable: input.sidecarAsyncTranscribeCapable,
  });

  return applyPrepareModelOverlay(
    {
    health: input.asrHealth,
    transcribeReady,
    sidecarMatchesSelection,
    ffmpegOk,
    envOk,
    runtimeReady,
    tone,
    chipLabel,
    chipOk: presentationTranscribeReady,
    chipTitle: "本机 ASR 是否可转写（当前所选模型）",
    ffmpegChipOk: ffmpegOk,
    ffmpegChipTitle: "FFmpeg 是否可用",
    statusRows,
    bannerTitle: bannerTitleFor({
      asrHealth: input.asrHealth,
      transcribeReady,
      sidecarAsyncTranscribeCapable: input.sidecarAsyncTranscribeCapable,
    }),
    bannerDetail: bannerDetailFor({
      asrHealth: input.asrHealth,
      asrHealthDetail: input.asrHealthDetail,
      transcribeReady: presentationTranscribeReady,
      runtimeReady,
      ffmpegOk,
      connectedGuidance,
    }),
    blockReason,
    errorDetail: input.asrHealth === "error" ? input.asrHealthDetail.trim() || null : null,
    errorBannerMessage:
      input.asrHealth === "error" && blockReason
        ? blockReason
        : "无法连接本机 ASR，请检查服务是否在运行。",
    connectedGuidance,
    ffmpegWarning:
      envOk && input.asrCaps && !ffmpegOk
        ? packagedOrDev(ffmpegMissingDev, ffmpegMissingPackaged)
        : null,
    cachePathMismatch,
    cachePathMismatchDetail: cachePathMismatch
      ? packagedOrDev(modelsPathMismatchDev, modelsPathMismatchPackaged)
      : null,
    modelsOnDiskButSidecarBlind,
    modelsOnDiskButSidecarBlindDetail: modelsOnDiskButSidecarBlind
      ? packagedOrDev(modelsPathMismatchDev, modelsPathMismatchPackaged)
      : null,
  },
    input,
  );
}
