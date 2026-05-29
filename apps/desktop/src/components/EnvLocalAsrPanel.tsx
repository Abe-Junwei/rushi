import { asrBaseUrl, isDefaultBundledAsrTarget, isTauriRuntime } from "../config/env";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";
import type { AsrHealthState } from "../pages/useProjectController";
import type { AsrHealthCapabilities, AsrModelCacheInfo, BundledAsrLaunchReport } from "../tauri/projectApi";
import type { PrepareDefaultModelOptions } from "../pages/usePrepareModelController";
import type { AsrSetupControllerApi } from "../pages/useAsrSetupController";
import type { LocalAsrModelCatalogApi } from "../pages/useLocalAsrModelCatalog";
import { LocalAsrModelSection } from "./envLocalAsr/LocalAsrModelSection";
import {
  buildLocalAsrCatalogView,
  computeLocalAsrTranscribeReady,
  selectedModelPrepareState,
} from "../services/asr/localAsrModelCatalog";
import { modelsRootMismatch } from "../services/asr/asrRuntimePathsAlign";
import { LocalAsrAdvancedSection } from "./envLocalAsr/LocalAsrAdvancedSection";
import { LocalAsrCacheSection } from "./envLocalAsr/LocalAsrCacheSection";
import { LocalAsrSetupWizard } from "./envLocalAsr/LocalAsrSetupWizard";
import { EnvLocalAsrStatusSection } from "./envLocalAsr/EnvLocalAsrStatusSection";
import { EnvLocalAsrModelDownloadSection } from "./envLocalAsr/EnvLocalAsrModelDownloadSection";
import { EnvLocalAsrSmallButton } from "./envLocalAsr/envLocalAsrPanelUi";

type Props = {
  asrHealth: AsrHealthState;
  asrHealthDetail: string;
  bundledAsrDiag: BundledAsrLaunchReport | null;
  asrCaps: AsrHealthCapabilities | null;
  asrModelCacheInfo: AsrModelCacheInfo | null;
  asrModelCacheBusy: boolean;
  asrCacheMessage: string;
  funasrInstallMessage: string;
  prepareModelBusy: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelFailureCopy | null;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
  installFunasrDepsInteractive: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  prepareDefaultFunasrModel: (options?: PrepareDefaultModelOptions) => Promise<void>;
  cancelPrepareModel: () => void;
  refreshAsrModelCacheInfo: () => Promise<void>;
  clearAsrModelCache: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
  asrSetup: AsrSetupControllerApi;
  localAsrModelCatalog: LocalAsrModelCatalogApi;
};

export function EnvLocalAsrPanel({
  asrHealth,
  asrHealthDetail,
  bundledAsrDiag,
  asrCaps,
  asrModelCacheInfo,
  asrModelCacheBusy,
  asrCacheMessage,
  funasrInstallMessage,
  prepareModelBusy,
  prepareModelProgress,
  prepareModelFailure,
  busy,
  refreshAsrHealth,
  installFunasrDepsInteractive,
  copyFunasrManualCommands,
  prepareDefaultFunasrModel,
  cancelPrepareModel,
  refreshAsrModelCacheInfo,
  clearAsrModelCache,
  retryBundledAsrSidecar,
  openAppDataFolder,
  exportDiagnosticBundle,
  asrSetup,
  localAsrModelCatalog,
}: Props) {
  const envOk = asrHealth === "ok";
  const ffmpegOk = asrCaps?.ffmpeg_ok === true;
  const runtimeReady = asrHealth === "ok" && asrCaps?.funasr_ready === true;
  const { ready: transcribeReady } = computeLocalAsrTranscribeReady({
    asrHealth,
    asrCaps,
    selectedHubModelId: localAsrModelCatalog.selectedHubModelId,
    catalogStatus: localAsrModelCatalog.catalogStatus,
  });
  const catalogView = buildLocalAsrCatalogView(
    asrCaps,
    localAsrModelCatalog.catalogStatus,
    localAsrModelCatalog.selectedHubModelId,
  );
  const selectedPrepare = selectedModelPrepareState(
    catalogView,
    localAsrModelCatalog.selectedHubModelId,
    asrCaps?.funasr_model_id,
  );
  const modelsCached = selectedPrepare.cached;
  const progress = prepareModelBusy ? prepareModelProgress : modelsCached ? 100 : 0;
  const sidecarModelsRoot = asrCaps?.rushi_models_root ?? null;
  const desktopModelsRoot = asrModelCacheInfo?.models_root ?? null;
  const cachePathMismatch =
    asrHealth === "ok" && modelsRootMismatch(desktopModelsRoot, sidecarModelsRoot);
  const modelsOnDiskButSidecarBlind =
    asrHealth === "ok" && (asrModelCacheInfo?.total_bytes ?? 0) > 0 && !sidecarModelsRoot;

  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
      <EnvLocalAsrStatusSection
        envOk={envOk}
        ffmpegOk={ffmpegOk}
        runtimeReady={runtimeReady}
        transcribeReady={transcribeReady}
        busy={busy}
        refreshAsrHealth={refreshAsrHealth}
      />

      <div className="h-px bg-notion-divider" />

      <LocalAsrSetupWizard
        setup={asrSetup}
        busy={busy}
        prepareModelBusy={prepareModelBusy}
        openAppDataFolder={openAppDataFolder}
        exportDiagnosticBundle={exportDiagnosticBundle}
      />

      <LocalAsrAdvancedSection
        asrHealth={asrHealth}
        asrCaps={asrCaps}
        funasrInstallMessage={funasrInstallMessage}
        busy={busy}
        installFunasrDepsInteractive={installFunasrDepsInteractive}
        copyFunasrManualCommands={copyFunasrManualCommands}
      />

      {asrHealth === "ok" && asrCaps && !asrCaps.ffmpeg_ok ? (
        <div className="rounded border border-notion-divider bg-notion-callout-bg px-3 py-2 text-sm">
          <strong className="text-notion-text">未检测到 FFmpeg</strong>
          <span className="text-notion-text-muted"> — ASR 无法解码上传音频。请安装 ffmpeg/ffprobe 并加入 PATH 后重启 ASR。</span>
        </div>
      ) : null}

      {asrHealth === "ok" && asrCaps ? (
        <p className={PANEL_TYPOGRAPHY.meta}>
          侧车模型目录{" "}
          <code className="font-mono text-[11px] text-zen-indigo">
            {sidecarModelsRoot ?? "（未绑定，侧车看不到桌面缓存）"}
          </code>
          {desktopModelsRoot ? (
            <>
              {" "}
              · 桌面缓存{" "}
              <code className="font-mono text-[11px] text-zen-indigo">{desktopModelsRoot}</code>
            </>
          ) : null}
        </p>
      ) : null}

      {cachePathMismatch || modelsOnDiskButSidecarBlind ? (
        <div
          className="rounded border border-zen-saffron/30 bg-zen-saffron/10 px-3 py-2 text-sm text-notion-text"
          role="status"
        >
          <p className="font-medium">磁盘上已有模型，但当前侧车未指向应用缓存目录。</p>
          <p className={`${PANEL_TYPOGRAPHY.meta} mt-1`}>
            请重新运行 <code className="font-mono text-[11px]">npm run desktop:dev</code> 或{" "}
            <code className="font-mono text-[11px]">npm run asr:dev</code>，再点「刷新状态」。
          </p>
        </div>
      ) : null}

      {asrHealth === "ok" && asrCaps && !transcribeReady && !cachePathMismatch && !modelsOnDiskButSidecarBlind ? (
        <div className="rounded border border-notion-divider bg-notion-callout-bg px-3 py-2 text-sm text-notion-text">
          <strong>已连接侧车</strong>
          <span className="text-notion-text-muted">
            {" "}
            —{" "}
            {!selectedPrepare.sidecarMatchesSelection
              ? "当前所选模型尚未应用到侧车。请先在下方点「应用并重启侧车」，再下载或转写。"
              : `当前所选模型或 VAD/标点尚未齐备（mode: ${asrCaps.transcription_mode}）。请在下方下载当前模型，或切换已缓存的模型。`}
          </span>
        </div>
      ) : null}

      {asrHealth === "error" ? (
        <div className="space-y-2 rounded bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">
          <p>{asrHealthDetail}</p>
          <div className="flex flex-wrap gap-2">
            {isDefaultBundledAsrTarget() && bundledAsrDiag?.attempted ? (
              <EnvLocalAsrSmallButton disabled={busy} onClick={() => void retryBundledAsrSidecar()}>
                重试内置侧车
              </EnvLocalAsrSmallButton>
            ) : null}
            <EnvLocalAsrSmallButton disabled={busy} onClick={() => void openAppDataFolder()}>
              打开应用数据目录
            </EnvLocalAsrSmallButton>
          </div>
          <p className={PANEL_TYPOGRAPHY.meta}>
            基址 <code className="font-mono text-zen-indigo">{asrBaseUrl()}</code> · <code className="font-mono">VITE_ASR_BASE_URL</code>
          </p>
        </div>
      ) : null}

      <div className="h-px bg-notion-divider" />

      <LocalAsrModelSection
        catalog={localAsrModelCatalog}
        asrCaps={asrCaps}
        busy={busy}
        prepareModelBusy={prepareModelBusy}
      />

      <div className="h-px bg-notion-divider" />

      <EnvLocalAsrModelDownloadSection
        localAsrModelCatalog={localAsrModelCatalog}
        selectedPrepare={selectedPrepare}
        progress={progress}
        prepareModelBusy={prepareModelBusy}
        prepareModelFailure={prepareModelFailure}
        funasrInstallMessage={funasrInstallMessage}
        busy={busy}
        modelsCached={modelsCached}
        prepareDefaultFunasrModel={prepareDefaultFunasrModel}
        cancelPrepareModel={cancelPrepareModel}
        refreshAsrHealth={refreshAsrHealth}
      />

      <div className="h-px bg-notion-divider" />

      <LocalAsrCacheSection
        asrModelCacheInfo={asrModelCacheInfo}
        asrModelCacheBusy={asrModelCacheBusy}
        asrCacheMessage={asrCacheMessage}
        busy={busy}
        prepareModelBusy={prepareModelBusy}
        tauriRuntime={isTauriRuntime()}
        refreshAsrModelCacheInfo={refreshAsrModelCacheInfo}
        clearAsrModelCache={clearAsrModelCache}
        openAppDataFolder={openAppDataFolder}
      />
    </div>
  );
}
