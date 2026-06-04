import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import type { AsrHealthState } from "../../pages/useAsrHealthPoll";
import {
  computeLocalAsrTranscribeReady,
  type LocalAsrCatalogStatusItem,
} from "./localAsrModelCatalog";
import { modelsRootMismatch } from "./asrRuntimePathsAlign";

export type AsrEnvTone = "ok" | "warn" | "error" | "idle";

export type AsrEnvStatusRow = {
  id: "env" | "ffmpeg" | "runtime" | "transcribe";
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
    return "侧车、FFmpeg 与当前所选模型已就绪，可直接拉取语段与转写。";
  }
  if (!input.ffmpegOk) {
    return "侧车已连接，但未检测到 FFmpeg，无法解码上传音频。";
  }
  if (!input.runtimeReady) {
    return "侧车已连接，FunASR 运行时尚未就绪。请完成模型下载或一键准备。";
  }
  return input.connectedGuidance ?? "侧车已连接，当前所选模型尚未齐备。";
}

function connectedGuidanceFor(input: {
  asrCaps: AsrHealthCapabilities;
  sidecarMatchesSelection: boolean;
}): string {
  if (!input.sidecarMatchesSelection) {
    return "当前所选模型尚未应用到侧车。请先在下方点「应用并重启侧车」，再下载或转写。";
  }
  return `当前所选模型或 VAD/标点尚未齐备（mode: ${input.asrCaps.transcription_mode}）。请在下方下载当前模型，或切换已缓存的模型。`;
}

function blockReasonFor(input: {
  asrHealth: AsrHealthState;
  asrCaps: AsrHealthCapabilities | null;
  transcribeReady: boolean;
  sidecarMatchesSelection: boolean;
  sidecarAsyncTranscribeCapable?: boolean;
}): string | null {
  if (input.asrHealth !== "ok" || !input.asrCaps) {
    return "本机 ASR 未就绪：请先在「环境与 ASR」完成侧车启动与模型准备。";
  }
  if (input.sidecarAsyncTranscribeCapable === false) {
    return (
      "侧车版本过旧，不支持增量转写（缺少 POST /v1/transcribe/async）。" +
      "请在环境页「应用并重启侧车」，或执行 npm run asr:build-sidecar-unix 重建内置侧车。"
    );
  }
  if (input.transcribeReady) return null;
  if (!input.sidecarMatchesSelection) {
    return "所选模型与侧车当前模型不一致：请先在环境页「应用并重启侧车」后再拉取语段。";
  }
  return "所选模型尚未就绪：请先在环境页下载并完成当前模型的准备。";
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

  return {
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
    blockReason: blockReasonFor({
      asrHealth: input.asrHealth,
      asrCaps: input.asrCaps,
      transcribeReady,
      sidecarMatchesSelection,
      sidecarAsyncTranscribeCapable: input.sidecarAsyncTranscribeCapable,
    }),
    errorDetail: input.asrHealth === "error" ? input.asrHealthDetail.trim() || null : null,
    errorBannerMessage: "无法连接本机 ASR，请检查服务是否在运行。",
    connectedGuidance,
    ffmpegWarning:
      envOk && input.asrCaps && !ffmpegOk
        ? "未检测到 FFmpeg — ASR 无法解码上传音频。请安装 ffmpeg/ffprobe 并加入 PATH 后重启 ASR。"
        : null,
    cachePathMismatch,
    cachePathMismatchDetail: cachePathMismatch
      ? "磁盘上已有模型，但当前侧车未指向应用缓存目录。请重新运行 npm run desktop:dev 或 npm run asr:dev，再点「刷新状态」。"
      : null,
    modelsOnDiskButSidecarBlind,
    modelsOnDiskButSidecarBlindDetail: modelsOnDiskButSidecarBlind
      ? "磁盘上已有模型，但当前侧车未指向应用缓存目录。请重新运行 npm run desktop:dev 或 npm run asr:dev，再点「刷新状态」。"
      : null,
  };
}
