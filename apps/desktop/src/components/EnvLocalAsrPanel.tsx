import { asrBaseUrl, isDefaultBundledAsrTarget } from "../config/env";
import { CLAY_BTN_PRIMARY, CLAY_BTN_SECONDARY } from "../config/controlStyles";
import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";
import type { AsrHealthState } from "../pages/useProjectController";
import { funasrManualSetupCommands } from "../pages/useProjectController";
import type { AsrHealthCapabilities, BundledAsrLaunchReport } from "../tauri/projectApi";

const btnPrimary = CLAY_BTN_PRIMARY;
const btnSecondary = CLAY_BTN_SECONDARY;

type Props = {
  asrHealth: AsrHealthState;
  asrHealthDetail: string;
  bundledAsrDiag: BundledAsrLaunchReport | null;
  asrCaps: AsrHealthCapabilities | null;
  funasrInstallMessage: string;
  prepareModelBusy: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelFailureCopy | null;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
  installFunasrDepsInteractive: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  prepareDefaultFunasrModel: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
};

export function EnvLocalAsrPanel({
  asrHealth,
  asrHealthDetail,
  bundledAsrDiag,
  asrCaps,
  funasrInstallMessage,
  prepareModelBusy,
  prepareModelProgress,
  prepareModelFailure,
  busy,
  refreshAsrHealth,
  installFunasrDepsInteractive,
  copyFunasrManualCommands,
  prepareDefaultFunasrModel,
  retryBundledAsrSidecar,
  openAppDataFolder,
}: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-[12px] font-semibold text-zen-ink">本机 ASR</h3>
      {funasrInstallMessage && !prepareModelBusy ? (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-black/[0.04] p-2 font-mono text-[11px] text-zen-indigo">
          {funasrInstallMessage}
        </pre>
      ) : null}

      {asrHealth === "ok" && asrCaps && !asrCaps.ffmpeg_ok ? (
        <div className="rounded-md border border-zen-gray-300 bg-app-highlight px-3 py-2 text-sm">
          <strong className="text-zen-ink">未检测到 FFmpeg</strong>
          <span className="text-zen-stone"> — ASR 无法解码上传音频。请安装 ffmpeg/ffprobe 并加入 PATH 后重启 ASR。</span>
        </div>
      ) : null}

      {asrHealth === "ok" && asrCaps && asrCaps.ffmpeg_ok && !asrCaps.funasr_ready ? (
        <div className="space-y-2 rounded-md border border-zen-gray-300 bg-app-highlight px-3 py-2 text-sm">
          <p>
            <strong className="text-zen-ink">FunASR 未就绪</strong>
            <span className="text-zen-stone">（stub：中文正文常为空）。安装依赖并重启 ASR；可选 </span>
            <code className="rounded bg-black/[0.04] px-1 font-mono text-[11px]">RUSHI_FUNASR_MODEL</code>。
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void installFunasrDepsInteractive()}>
              一键安装 FunASR 依赖
            </button>
            <button type="button" className={btnSecondary} disabled={busy} onClick={() => void copyFunasrManualCommands()}>
              复制手动命令
            </button>
          </div>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-black/[0.03] p-2 font-mono text-[10px] text-zen-indigo">
            {funasrManualSetupCommands()}
          </pre>
        </div>
      ) : null}

      {asrHealth === "error" ? (
        <div className="space-y-2 rounded-md bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">
          <p>{asrHealthDetail}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} disabled={busy} onClick={() => void refreshAsrHealth()}>
              重新检测 ASR
            </button>
            {isDefaultBundledAsrTarget() && bundledAsrDiag?.attempted ? (
              <button type="button" className={btnSecondary} disabled={busy} onClick={() => void retryBundledAsrSidecar()}>
                重试内置侧车
              </button>
            ) : null}
            <button type="button" className={btnSecondary} disabled={busy} onClick={() => void openAppDataFolder()}>
              打开应用数据目录
            </button>
          </div>
          <p className="text-[11px] text-zen-stone">
            基址 <code className="font-mono text-zen-indigo">{asrBaseUrl()}</code> · <code className="font-mono">VITE_ASR_BASE_URL</code>
          </p>
        </div>
      ) : null}

      {asrHealth === "ok" ? (
        <div className="space-y-2 text-[12px] text-zen-stone">
          {asrCaps ? (
            <p className="leading-relaxed">
              模型 <code className="font-mono text-zen-indigo">{asrCaps.funasr_model_id ?? "—"}</code>
              {asrCaps.funasr_model_explicit_from_env ? "（环境变量）" : "（内置默认）"}
              {" · "}
              权重缓存：
              {asrCaps.rushi_models_root ? (
                <code className="break-all font-mono text-[10px] text-zen-indigo">{asrCaps.rushi_models_root}</code>
              ) : (
                "—"
              )}
            </p>
          ) : (
            <p>（ASR 未返回能力字段，请升级 rushi-asr。）</p>
          )}
          {asrCaps && asrCaps.funasr_import_ok && !asrCaps.funasr_default_model_cached ? (
            <div className="space-y-2 rounded-md bg-zen-paper/60 p-2">
              <button type="button" className={btnSecondary} disabled={busy || prepareModelBusy} onClick={() => void prepareDefaultFunasrModel()}>
                {prepareModelBusy ? "正在下载默认模型…" : "预先下载默认模型"}
              </button>
              {prepareModelBusy ? (
                <div className="space-y-1" aria-live="polite">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-black/[0.08]"
                    role="progressbar"
                    aria-valuenow={prepareModelProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full bg-zen-ink transition-[width]" style={{ width: `${prepareModelProgress}%` }} />
                  </div>
                  {funasrInstallMessage ? (
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-zen-indigo">{funasrInstallMessage}</pre>
                  ) : null}
                </div>
              ) : null}
              {prepareModelFailure ? (
                <div className="rounded-md bg-zen-cinnabar/10 p-2 text-zen-cinnabar" role="alert">
                  <p className="font-medium">{prepareModelFailure.headline}</p>
                  <ul className="mt-1 list-inside list-disc text-[11px]">
                    {prepareModelFailure.tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={btnSecondary} disabled={busy || prepareModelBusy} onClick={() => void prepareDefaultFunasrModel()}>
                      重试下载
                    </button>
                    <button type="button" className={btnSecondary} disabled={busy} onClick={() => void refreshAsrHealth()}>
                      重新检测 ASR
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
