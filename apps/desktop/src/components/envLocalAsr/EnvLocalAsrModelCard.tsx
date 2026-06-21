import { CONTROL_BTN_SECONDARY, CONTROL_TEXT_INPUT } from "../../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../../config/typography";
import type { PrepareModelFailureCopy } from "../../pages/prepareModelDownloadCopy";
import type { LocalAsrModelCatalogApi } from "../../pages/useLocalAsrModelCatalog";
import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import type { AsrCatalogPresentation } from "../../services/asr/asrCatalogPresentation";
import { LOCAL_ASR_RECOGNITION_LANGUAGE_OPTIONS } from "../../services/asr/localAsrRecognitionLanguage";
import { ENV_PANEL_BUTTON_ROW_CLASS, ENV_PANEL_FORM_FIELDS_CLASS, ENV_PANEL_FORM_FIELD_CLASS } from "../../utils/environmentPanelNav";
import {
  PANEL_PROGRESS_FILL_COMPACT_CLASS,
  PANEL_PROGRESS_FILL_SUCCESS_CLASS,
  PANEL_PROGRESS_TRACK_COMPACT_CLASS,
} from "../panelProgressStyles";
import { CspProgressFill } from "../CspProgressFill";

const fieldLabel = PANEL_TYPOGRAPHY.envFieldLabel;
const fieldGroup = ENV_PANEL_FORM_FIELD_CLASS;
const selectField = `${CONTROL_TEXT_INPUT} cursor-pointer pr-9`;

type Props = {
  localAsrModelCatalog: LocalAsrModelCatalogApi;
  asrCaps: AsrHealthCapabilities | null;
  catalogPresentation: AsrCatalogPresentation;
  prepareModelBusy: boolean;
  prepareModelCancelling: boolean;
  prepareModelFailure: PrepareModelFailureCopy | null;
  funasrInstallMessage: string;
  busy: boolean;
};

export function EnvLocalAsrModelCard({
  localAsrModelCatalog,
  asrCaps,
  catalogPresentation,
  prepareModelBusy,
  prepareModelCancelling,
  prepareModelFailure,
  funasrInstallMessage,
  busy,
}: Props) {
  const catalog = localAsrModelCatalog;
  const {
    catalogView,
    modelsReady,
    progress,
    progressLabel,
    progressTone,
    sidecarMatchesSelection,
    selectedLabel,
  } = catalogPresentation;
  const panelBusy = busy || prepareModelBusy || prepareModelCancelling || catalog.applyBusy;
  const sidecarHub = asrCaps?.funasr_model_id ?? null;

  const progressToneClass =
    progressTone === "success" ? "text-zen-success" : "text-notion-text-muted";

  return (
    <section className={ENV_PANEL_FORM_FIELDS_CLASS}>
      <label className={fieldGroup}>
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
              {item.cached ? " · 已缓存" : " · 未就绪"}
              {item.active ? " · 运行中" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className={ENV_PANEL_FORM_FIELD_CLASS}>
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

      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          <span className={fieldLabel}>模型状态</span>
          <span className={`font-mono text-body ${progressToneClass}`}>{progressLabel}</span>
        </div>
        <div
          className={PANEL_PROGRESS_TRACK_COMPACT_CLASS}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <CspProgressFill
            percent={progress}
            className={
              progressTone === "success"
                ? PANEL_PROGRESS_FILL_SUCCESS_CLASS
                : PANEL_PROGRESS_FILL_COMPACT_CLASS
            }
          />
        </div>
        {funasrInstallMessage && (prepareModelBusy || prepareModelCancelling) ? (
          <p className={PANEL_TYPOGRAPHY.meta} role="status" aria-live="polite">
            {funasrInstallMessage}
          </p>
        ) : null}
        {!sidecarMatchesSelection ? (
          <p className={PANEL_TYPOGRAPHY.meta}>
            已选 {selectedLabel}，侧车{sidecarHub ? ` 仍在 ${sidecarHub}` : " 未切换"}。请先「应用并重启侧车」。
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

      <div className={ENV_PANEL_BUTTON_ROW_CLASS}>
        {!modelsReady ? (
          <span className={`mr-auto ${PANEL_TYPOGRAPHY.meta}`}>
            首次使用会自动从安装包复制内置 Paraformer 模型；若未完成，请重启应用。清除缓存后也会自动重新复制。
          </span>
        ) : (
          <span className={`mr-auto ${PANEL_TYPOGRAPHY.meta}`}>当前模型已就绪，可直接转写。</span>
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
