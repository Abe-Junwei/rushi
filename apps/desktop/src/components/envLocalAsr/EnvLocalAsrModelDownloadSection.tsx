import { Download } from "lucide-react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { PrepareModelFailureCopy } from "../../pages/prepareModelDownloadCopy";
import type { PrepareDefaultModelOptions } from "../../pages/usePrepareModelController";
import type { LocalAsrModelCatalogApi } from "../../pages/useLocalAsrModelCatalog";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { EnvLocalAsrSmallButton } from "./envLocalAsrPanelUi";

type Props = {
  localAsrModelCatalog: LocalAsrModelCatalogApi;
  selectedPrepare: {
    cached: boolean;
    readyForTranscribe: boolean;
    sidecarMatchesSelection: boolean;
  };
  progress: number;
  prepareModelBusy: boolean;
  prepareModelFailure: PrepareModelFailureCopy | null;
  funasrInstallMessage: string;
  busy: boolean;
  modelsCached: boolean;
  prepareDefaultFunasrModel: (options?: PrepareDefaultModelOptions) => Promise<void>;
  cancelPrepareModel: () => void;
  refreshAsrHealth: () => Promise<void>;
};

export function EnvLocalAsrModelDownloadSection({
  localAsrModelCatalog,
  selectedPrepare,
  progress,
  prepareModelBusy,
  prepareModelFailure,
  funasrInstallMessage,
  busy,
  modelsCached,
  prepareDefaultFunasrModel,
  cancelPrepareModel,
  refreshAsrHealth,
}: Props) {
  return (
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
          onClick={() => void prepareDefaultFunasrModel(modelsCached ? { force: true } : undefined)}
        >
          <Download className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          {prepareModelBusy ? "正在下载模型" : modelsCached ? "校验/刷新缓存" : "下载当前模型"}
        </button>
        {prepareModelBusy ? (
          <EnvLocalAsrSmallButton disabled={busy} onClick={cancelPrepareModel}>
            取消下载
          </EnvLocalAsrSmallButton>
        ) : null}
      </div>

      {funasrInstallMessage ? (
        <pre className="max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[12px] text-zen-indigo">
          {funasrInstallMessage}
        </pre>
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
            <EnvLocalAsrSmallButton disabled={busy || prepareModelBusy} onClick={() => void prepareDefaultFunasrModel()}>
              重试下载
            </EnvLocalAsrSmallButton>
            <EnvLocalAsrSmallButton disabled={busy} onClick={() => void refreshAsrHealth()}>
              重新检测 ASR
            </EnvLocalAsrSmallButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
