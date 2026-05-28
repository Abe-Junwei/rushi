import { asrBaseUrl, isDefaultBundledAsrTarget, isTauriRuntime } from "../config/env";
import { Download, RefreshCw } from "lucide-react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";
import type { AsrHealthState } from "../pages/useProjectController";
import type { AsrHealthCapabilities, AsrModelCacheInfo, BundledAsrLaunchReport } from "../tauri/projectApi";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import type { PrepareDefaultModelOptions } from "../pages/usePrepareModelController";
import type { AsrSetupControllerApi } from "../pages/useAsrSetupController";
import type { LocalAsrModelCatalogApi } from "../pages/useLocalAsrModelCatalog";
import { LocalAsrModelSection, selectedModelPrepareState } from "./envLocalAsr/LocalAsrModelSection";
import { buildLocalAsrCatalogView, computeLocalAsrTranscribeReady } from "../services/asr/localAsrModelCatalog";
import { modelsRootMismatch } from "../services/asr/asrRuntimePathsAlign";
import { LocalAsrAdvancedSection } from "./envLocalAsr/LocalAsrAdvancedSection";
import { LocalAsrCacheSection } from "./envLocalAsr/LocalAsrCacheSection";
import { LocalAsrSetupWizard } from "./envLocalAsr/LocalAsrSetupWizard";

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
    asrHealth === "ok" &&
    modelsRootMismatch(desktopModelsRoot, sidecarModelsRoot);
  const modelsOnDiskButSidecarBlind =
    asrHealth === "ok" &&
    (asrModelCacheInfo?.total_bytes ?? 0) > 0 &&
    !sidecarModelsRoot;

  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="pb-1">
          <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>ASR 状态</h3>
          <p className={PANEL_TYPOGRAPHY.sectionDescription}>当前系统的 ASR 环境检测结果</p>
        </div>

        <div className="flex flex-col">
          <StatusRow label="环境" ok={envOk} text={envOk ? "正常" : "异常"} />
          <StatusRow label="FFmpeg" ok={ffmpegOk} text={ffmpegOk ? "已安装" : "未安装"} />
          <StatusRow label="FunASR 运行时" ok={runtimeReady} text={runtimeReady ? "就绪" : "未就绪"} />
          <StatusRow label="可直接转写" ok={transcribeReady} text={transcribeReady ? "就绪" : "未就绪"} last />
        </div>

        <div className="flex justify-start gap-3">
          <SmallButton disabled={busy} onClick={() => void refreshAsrHealth()} icon={<RefreshCw className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />}>
            刷新状态
          </SmallButton>
        </div>
      </section>

      <div className="h-px bg-notion-divider" />

      <LocalAsrSetupWizard
        setup={asrSetup}
        busy={busy}
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
            — 当前所选模型或 VAD/标点尚未齐备（<code className="font-mono text-[11px]">mode: {asrCaps.transcription_mode}</code>
            ）。请在下方下载当前模型，或切换已缓存的模型。
          </span>
        </div>
      ) : null}

      {asrHealth === "error" ? (
        <div className="space-y-2 rounded bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">
          <p>{asrHealthDetail}</p>
          <div className="flex flex-wrap gap-2">
            {isDefaultBundledAsrTarget() && bundledAsrDiag?.attempted ? (
              <SmallButton disabled={busy} onClick={() => void retryBundledAsrSidecar()}>
                重试内置侧车
              </SmallButton>
            ) : null}
            <SmallButton disabled={busy} onClick={() => void openAppDataFolder()}>
              打开应用数据目录
            </SmallButton>
          </div>
          <p className={PANEL_TYPOGRAPHY.meta}>
            基址 <code className="font-mono text-zen-indigo">{asrBaseUrl()}</code> · <code className="font-mono">VITE_ASR_BASE_URL</code>
          </p>
        </div>
      ) : null}

      <div className="h-px bg-notion-divider" />

      <LocalAsrModelSection catalog={localAsrModelCatalog} asrCaps={asrCaps} busy={busy} />

      <div className="h-px bg-notion-divider" />

      <section className="flex flex-col gap-4">
        <div className="pb-1">
          <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>模型下载</h3>
          <p className={PANEL_TYPOGRAPHY.sectionDescription}>
            下载并管理当前所选转写模型。超过 30 分钟的音频转写耗时较长，请保持应用开启；Apple Silicon 可在启动侧车前设置{" "}
            <code className="font-mono text-[11px]">RUSHI_FUNASR_DEVICE=mps</code>。
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={PANEL_TYPOGRAPHY.fieldLabel}>{localAsrModelCatalog.selectedEntry.label}</span>
            <span className="font-mono text-[12px] text-zen-saffron">{progress}%</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full border border-notion-divider bg-notion-sidebar"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-1.5 rounded-full bg-zen-saffron transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className={PANEL_TYPOGRAPHY.meta}>
            {prepareModelBusy
              ? `正在下载 ${localAsrModelCatalog.selectedEntry.label} 与必需辅助模型…`
              : !selectedPrepare.sidecarMatchesSelection
                ? "所选模型尚未应用到侧车，请先点「应用并重启侧车」。"
                : selectedPrepare.readyForTranscribe
                  ? "当前模型与必需辅助模型已缓存，可直接用于本地转写。"
                  : selectedPrepare.cached
                    ? "主模型已缓存，但辅助模型尚未完成。"
                    : "当前模型尚未缓存，可预先下载以减少首次转写等待。"}
          </p>
        </div>

        <div className="flex justify-start gap-2">
          <button
            type="button"
            className={`flex items-center gap-2 ${modelsCached && !prepareModelBusy ? CONTROL_BTN_SECONDARY : CONTROL_BTN_PRIMARY}`}
            disabled={busy || prepareModelBusy}
            onClick={() =>
              void prepareDefaultFunasrModel(modelsCached ? { force: true } : undefined)
            }
          >
            <Download className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            {prepareModelBusy ? "正在下载模型" : modelsCached ? "校验/刷新缓存" : "下载当前模型"}
          </button>
          {prepareModelBusy ? (
            <SmallButton disabled={busy} onClick={cancelPrepareModel}>
              取消下载
            </SmallButton>
          ) : null}
        </div>

        {funasrInstallMessage ? (
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[12px] text-zen-indigo">{funasrInstallMessage}</pre>
        ) : null}

              {prepareModelFailure ? (
                <div className="rounded bg-zen-cinnabar/10 p-2 text-zen-cinnabar" role="alert">
                  <p className="font-medium">{prepareModelFailure.headline}</p>
                  <ul className="mt-1 list-inside list-disc text-[11px]">
                    {prepareModelFailure.tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <SmallButton disabled={busy || prepareModelBusy} onClick={() => void prepareDefaultFunasrModel()}>
                      重试下载
                    </SmallButton>
                    <SmallButton disabled={busy} onClick={() => void refreshAsrHealth()}>
                      重新检测 ASR
                    </SmallButton>
                  </div>
                </div>
              ) : null}
      </section>

      <div className="h-px bg-notion-divider" />

      <LocalAsrCacheSection
        asrModelCacheInfo={asrModelCacheInfo}
        asrModelCacheBusy={asrModelCacheBusy}
        asrCacheMessage={asrCacheMessage}
        busy={busy}
        tauriRuntime={isTauriRuntime()}
        refreshAsrModelCacheInfo={refreshAsrModelCacheInfo}
        clearAsrModelCache={clearAsrModelCache}
        openAppDataFolder={openAppDataFolder}
      />
    </div>
  );
}

function StatusRow({ label, ok, text, last = false }: { label: string; ok: boolean; text: string; last?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 py-2 ${last ? "" : "border-b border-notion-divider"}`}>
      <span className={PANEL_TYPOGRAPHY.fieldLabel}>{label}</span>
      <div className="flex items-center gap-2.5">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-zen-success" : "bg-zen-cinnabar"}`} aria-hidden />
        <span className={PANEL_TYPOGRAPHY.meta}>{text}</span>
      </div>
    </div>
  );
}

function SmallButton({ children, disabled, onClick, icon }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1.5 rounded border border-notion-divider bg-notion-bg px-2.5 py-1 ${PANEL_TYPOGRAPHY.button} text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:opacity-40`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}
