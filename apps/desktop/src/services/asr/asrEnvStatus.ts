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
import {
  buildBundledModelJobPresentation,
  usesBundledAsrModelStack,
} from "./bundledModelJobPresentation";
import { buildPrepareJobPresentation } from "./prepareJobPresentation";
import { isBundledAsrModelsSeedActive } from "./asrPrepareActivityGate";
import {
  bannerTitleFor,
  buildAsrEnvStatusRows,
  chipLabelFor,
  effectiveTranscribeReady,
  mapBundledModelBusyRows,
  mapPrepareModelBusyRows,
  mapPrepareModelCancelRows,
  mapRuntimeInstallBusyRows,
  toneFor,
  type AsrEnvStatusRow,
} from "./asrEnvPresentationRows";

type AsrEnvTone = "ok" | "warn" | "error" | "idle";

export type { AsrEnvStatusRow };

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
  runtimeInstallRunning?: boolean;
};

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
    return usesBundledAsrModelStack()
      ? "FunASR 未就绪，请完成侧车连接或等待内置模型复制完成。"
      : "FunASR 未就绪，请准备模型或一键准备。";
  }
  return input.connectedGuidance ?? (usesBundledAsrModelStack() ? "内置模型尚未复制完成。" : "所选模型尚未齐备。");
}

function connectedGuidanceFor(input: {
  asrCaps: AsrHealthCapabilities;
  sidecarMatchesSelection: boolean;
}): string {
  if (!input.sidecarMatchesSelection) {
    return "所选模型未应用到侧车，请先「应用并重启侧车」。";
  }
  return `模型或 VAD/标点未齐备（mode: ${input.asrCaps.transcription_mode}）。${
    usesBundledAsrModelStack()
      ? "请重启应用以重新复制内置模型，或点「一键准备」。"
      : "请准备当前模型或切换已缓存模型。"
  }`;
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
  return usesBundledAsrModelStack()
    ? "所选模型未就绪：请等待内置模型复制完成或点「一键准备」。"
    : "所选模型未就绪：请先完成模型准备。";
}

function applyPrepareModelOverlay(
  presentation: AsrEnvPresentation,
  input: BuildAsrEnvPresentationInput,
): AsrEnvPresentation {
  const mapBusyRows = usesBundledAsrModelStack()
    ? mapBundledModelBusyRows
    : mapPrepareModelBusyRows;

  if (isBundledAsrModelsSeedActive()) {
    const bundled = buildBundledModelJobPresentation({
      progress: input.prepareModelProgress ?? 0,
    });
    return {
      ...presentation,
      transcribeReady: false,
      tone: "warn",
      chipLabel: "ASR 未就绪",
      chipOk: false,
      bannerTitle: bundled.bannerTitle,
      bannerDetail: bundled.envBannerDetail,
      statusRows: mapBusyRows(presentation.statusRows),
      blockReason: bundled.blockReason,
    };
  }

  if (input.runtimeInstallRunning) {
    return {
      ...presentation,
      transcribeReady: false,
      tone: "warn",
      chipLabel: "ASR 未就绪",
      chipOk: false,
      bannerTitle: "本机 ASR · 正在安装运行时",
      bannerDetail: "正在下载或安装本机 ASR 运行时组件，完成后方可转写。请保持应用开启并联网。",
      statusRows: mapRuntimeInstallBusyRows(presentation.statusRows),
      blockReason: "本机 ASR 运行时安装中，暂不可转写。",
    };
  }

  if (input.prepareModelCancelling) {
    if (usesBundledAsrModelStack()) {
      const bundled = buildBundledModelJobPresentation({
        progress: input.prepareModelProgress ?? 0,
      });
      return {
        ...presentation,
        transcribeReady: false,
        tone: "warn",
        chipLabel: "ASR 未就绪",
        chipOk: false,
        bannerTitle: bundled.bannerTitle,
        bannerDetail: bundled.envBannerDetail,
        statusRows: mapBusyRows(presentation.statusRows),
        blockReason: bundled.blockReason,
      };
    }
    return {
      ...presentation,
      transcribeReady: false,
      tone: "warn",
      chipLabel: "ASR 未就绪",
      chipOk: false,
      bannerTitle: "本机 ASR · 正在取消下载",
      bannerDetail: "侧车将在当前文件传完后停止；完成后可重新点「一键准备」。",
      statusRows: mapPrepareModelCancelRows(presentation.statusRows),
      blockReason: "模型下载取消中，暂不可转写。",
    };
  }

  if (!input.prepareModelBusy) return presentation;

  const job = buildPrepareJobPresentation({
    localBusy: true,
    progressOverride: input.prepareModelProgress ?? 0,
  });
  if (usesBundledAsrModelStack()) {
    const bundled = buildBundledModelJobPresentation({ progress: job.progress });
    return {
      ...presentation,
      transcribeReady: false,
      tone: "warn",
      chipLabel: "ASR 未就绪",
      chipOk: false,
      bannerTitle: bundled.bannerTitle,
      bannerDetail: bundled.envBannerDetail,
      statusRows: mapBusyRows(presentation.statusRows),
      blockReason: bundled.blockReason,
    };
  }
  return {
    ...presentation,
    transcribeReady: false,
    tone: "warn",
    chipLabel: "ASR 未就绪",
    chipOk: false,
    bannerTitle: "本机 ASR · 正在下载模型",
    bannerDetail: job.envBannerDetail,
    statusRows: mapBusyRows(presentation.statusRows),
    blockReason: "所选模型正在下载，完成后方可转写。",
  };
}

/** Overlay when LRC manifest install is in flight (D7). */
export function runtimeInstallBusyPresentation(
  presentation: AsrEnvPresentation,
): AsrEnvPresentation {
  return {
    ...presentation,
    transcribeReady: false,
    tone: "warn",
    chipLabel: "ASR 未就绪",
    chipOk: false,
    bannerTitle: "本机 ASR · 正在安装运行时",
    bannerDetail: "正在下载或安装本机 ASR 运行时组件，完成后方可转写。请保持应用开启并联网。",
    statusRows: mapRuntimeInstallBusyRows(presentation.statusRows),
    blockReason: "本机 ASR 运行时安装中，暂不可转写。",
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

  const statusRows = buildAsrEnvStatusRows({
    envOk,
    ffmpegOk,
    runtimeReady,
    presentationTranscribeReady,
    sidecarAsyncTranscribeCapable: input.sidecarAsyncTranscribeCapable,
    asrCaps: input.asrCaps,
  });

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
