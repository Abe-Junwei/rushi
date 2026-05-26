import { asrBaseUrl, isDefaultBundledAsrTarget, isTauriRuntime } from "../config/env";
import { Download, RefreshCw } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";
import type { AsrHealthState } from "../pages/useProjectController";
import type { AsrHealthCapabilities, AsrModelCacheInfo, BundledAsrLaunchReport } from "../tauri/projectApi";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import type { AsrSetupControllerApi } from "../pages/useAsrSetupController";
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
  prepareDefaultFunasrModel: () => Promise<void>;
  refreshAsrModelCacheInfo: () => Promise<void>;
  clearAsrModelCache: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
  asrSetup: AsrSetupControllerApi;
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
  refreshAsrModelCacheInfo,
  clearAsrModelCache,
  retryBundledAsrSidecar,
  openAppDataFolder,
  exportDiagnosticBundle,
  asrSetup,
}: Props) {
  const envOk = asrHealth === "ok";
  const ffmpegOk = asrCaps?.ffmpeg_ok === true;
  const runtimeReady = asrHealth === "ok" && asrCaps?.funasr_ready === true;
  const transcribeReady = asrHealth === "ok" && asrCaps?.ready_for_transcribe === true;
  const progress = prepareModelBusy ? prepareModelProgress : asrCaps?.funasr_required_models_cached ? 100 : 0;

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

      <section className="flex flex-col gap-4">
        <div className="pb-1">
          <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>模型下载</h3>
          <p className={PANEL_TYPOGRAPHY.sectionDescription}>下载并管理本地转写模型</p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={PANEL_TYPOGRAPHY.fieldLabel}>FunASR 默认模型</span>
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
              ? "正在下载默认模型与必需辅助模型..."
              : asrCaps?.funasr_required_models_cached
                ? "默认模型与必需辅助模型已缓存，可直接用于本地转写。"
                : asrCaps?.funasr_default_model_cached
                  ? "主模型已缓存，但辅助模型尚未完成。"
                  : "默认模型尚未缓存，可预先下载以减少首次转写等待。"}
          </p>
        </div>

        <div className="flex justify-start">
          <button
            type="button"
            className={`flex items-center gap-2 rounded border border-transparent bg-zen-saffron px-4 py-1.5 ${PANEL_TYPOGRAPHY.button} text-notion-bg shadow-sm outline-none transition-all hover:brightness-110 focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-40`}
            disabled={busy || prepareModelBusy}
            onClick={() => void prepareDefaultFunasrModel()}
          >
            <Download className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            {prepareModelBusy ? "正在下载默认模型" : "下载默认模型"}
          </button>
        </div>

        {funasrInstallMessage && prepareModelBusy ? (
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
