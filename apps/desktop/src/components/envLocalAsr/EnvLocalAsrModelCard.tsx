import { Download } from "lucide-react";
import { CONTROL_BTN_SECONDARY, CONTROL_TEXT_INPUT } from "../../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../../config/typography";
import type { PrepareModelFailureCopy } from "../../pages/prepareModelDownloadCopy";
import type { PrepareDefaultModelOptions } from "../../pages/usePrepareModelController";
import type { LocalAsrModelCatalogApi } from "../../pages/useLocalAsrModelCatalog";
import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import {
  buildLocalAsrCatalogView,
  catalogEntryForHub,
  selectedModelMatchesSidecar,
} from "../../services/asr/localAsrModelCatalog";
import { LOCAL_ASR_RECOGNITION_LANGUAGE_OPTIONS } from "../../services/asr/localAsrRecognitionLanguage";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { EnvLocalAsrSmallButton } from "./envLocalAsrPanelUi";

const fieldLabel = PANEL_TYPOGRAPHY.envFieldLabel;
const selectField = `${CONTROL_TEXT_INPUT} cursor-pointer pr-9`;

type SelectedPrepare = {
  cached: boolean;
  readyForTranscribe: boolean;
  sidecarMatchesSelection: boolean;
};

type Props = {
  localAsrModelCatalog: LocalAsrModelCatalogApi;
  asrCaps: AsrHealthCapabilities | null;
  selectedPrepare: SelectedPrepare;
  progress: number;
  prepareModelBusy: boolean;
  prepareModelFailure: PrepareModelFailureCopy | null;
  busy: boolean;
  modelsCached: boolean;
  prepareDefaultFunasrModel: (options?: PrepareDefaultModelOptions) => Promise<void>;
  cancelPrepareModel: () => void;
};

export function EnvLocalAsrModelCard({
  localAsrModelCatalog,
  asrCaps,
  selectedPrepare,
  progress,
  prepareModelBusy,
  prepareModelFailure,
  busy,
  modelsCached,
  prepareDefaultFunasrModel,
  cancelPrepareModel,
}: Props) {
  const catalog = localAsrModelCatalog;
  const catalogView = buildLocalAsrCatalogView(
    asrCaps,
    catalog.catalogStatus,
    catalog.selectedHubModelId,
  );
  const panelBusy = busy || prepareModelBusy || catalog.applyBusy;
  const sidecarHub = asrCaps?.funasr_model_id ?? null;
  const sidecarMatchesSelection = selectedModelMatchesSidecar(catalog.selectedHubModelId, sidecarHub);
  const selectedLabel =
    catalogEntryForHub(catalog.selectedHubModelId)?.label ?? catalog.selectedHubModelId;

  const progressLabel = prepareModelBusy
    ? `下载中… ${progress}%`
    : modelsCached
      ? "已缓存 · 100%"
      : selectedPrepare.cached
        ? "主模型已缓存 · 辅助模型待补齐"
        : "未下载";

  const progressTone = modelsCached && !prepareModelBusy ? "text-zen-success" : "text-notion-text-muted";

  const progressFillClass =
    modelsCached && !prepareModelBusy ? "bg-zen-success" : "bg-zen-saffron";

  return (
    <section className="flex flex-col gap-6">
        <label className="block space-y-2">
          <span className={fieldLabel}>所选模型</span>
          <select
            className={`${selectField} ${PANEL_CONTROL_TYPOGRAPHY.compactTechnicalInput}`}
            value={catalog.selectedHubModelId}
            disabled={panelBusy}
            onChange={(e) => catalog.setSelectedHubModelId(e.target.value)}
          >
            {catalogView.map((item) => (
              <option key={item.hubModelId} value={item.hubModelId}>
                {item.label}
                {item.cached ? " · 已缓存" : " · 未下载"}
                {item.active ? " · 运行中" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className={fieldLabel}>识别语言</span>
          <select
            className={selectField}
            value={catalog.recognitionLanguage}
            disabled={panelBusy}
            onChange={(e) =>
              catalog.setRecognitionLanguage(e.target.value as typeof catalog.recognitionLanguage)
            }
          >
            {LOCAL_ASR_RECOGNITION_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="mb-2 flex items-end justify-between gap-2">
            <span className={fieldLabel}>下载进度</span>
            <span className={`font-mono text-[12px] ${progressTone}`}>{progressLabel}</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-notion-divider"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressFillClass}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {!sidecarMatchesSelection ? (
            <p className={`mt-2 ${PANEL_TYPOGRAPHY.meta}`}>
              已选 {selectedLabel}，侧车{sidecarHub ? ` 仍在运行 ${sidecarHub}` : " 尚未切换"}。请先「应用并重启侧车」。
            </p>
          ) : null}
        </div>

        {prepareModelFailure ? (
          <div className="flex flex-col gap-1" role="alert">
            <p className={`${PANEL_TYPOGRAPHY.meta} font-semibold text-zen-cinnabar`}>
              {prepareModelFailure.headline}
            </p>
            <ul className={`list-inside list-disc ${PANEL_TYPOGRAPHY.meta} text-zen-cinnabar`}>
              {prepareModelFailure.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-notion-divider pt-5">
          {!modelsCached || prepareModelBusy ? (
            <>
              <button
                type="button"
                className={`mr-auto flex items-center gap-2 ${CONTROL_BTN_SECONDARY}`}
                disabled={panelBusy || !selectedPrepare.sidecarMatchesSelection}
                onClick={() => void prepareDefaultFunasrModel(modelsCached ? { force: true } : undefined)}
              >
                <Download className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                {prepareModelBusy ? "正在下载…" : modelsCached ? "校验/刷新缓存" : "下载当前模型"}
              </button>
              {prepareModelBusy ? (
                <EnvLocalAsrSmallButton disabled={busy} onClick={cancelPrepareModel}>
                  取消下载
                </EnvLocalAsrSmallButton>
              ) : null}
            </>
          ) : (
            <span className={`mr-auto ${PANEL_TYPOGRAPHY.meta}`}>当前模型已缓存，可直接转写或切换其他模型。</span>
          )}
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={panelBusy}
            onClick={() => void catalog.applySelectedModel()}
          >
            {catalog.applyBusy ? "正在应用…" : "应用并重启侧车"}
          </button>
        </div>
    </section>
  );
}
