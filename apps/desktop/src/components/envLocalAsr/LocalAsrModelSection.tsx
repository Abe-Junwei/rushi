import { PANEL_TYPOGRAPHY } from "../../config/typography";
import {
  buildLocalAsrCatalogView,
  catalogEntryForHub,
  selectedModelMatchesSidecar,
  sidecarMemoryModelMatchesConfig,
} from "../../services/asr/localAsrModelCatalog";
import {
  LOCAL_ASR_RECOGNITION_LANGUAGE_OPTIONS,
  localAsrRecognitionLanguageLabel,
  normalizeLocalAsrRecognitionLanguage,
  sidecarRecognitionLanguageMatchesSelection,
} from "../../services/asr/localAsrRecognitionLanguage";
import type { LocalAsrModelCatalogApi } from "../../pages/useLocalAsrModelCatalog";
import type { AsrHealthCapabilities } from "../../tauri/projectApi";

type Props = {
  catalog: LocalAsrModelCatalogApi;
  asrCaps: AsrHealthCapabilities | null;
  busy: boolean;
  prepareModelBusy?: boolean;
};

export function LocalAsrModelSection({ catalog, asrCaps, busy, prepareModelBusy = false }: Props) {
  const sidecarHub = asrCaps?.funasr_model_id ?? null;
  const catalogView = buildLocalAsrCatalogView(
    asrCaps,
    catalog.catalogStatus,
    catalog.selectedHubModelId,
  );
  const selectedView =
    catalogView.find((item) => item.hubModelId === catalog.selectedHubModelId) ?? catalogView[0];
  const sidecarMatchesSelection = selectedModelMatchesSidecar(
    catalog.selectedHubModelId,
    sidecarHub,
  );
  const languageMatchesSidecar = sidecarRecognitionLanguageMatchesSelection(
    asrCaps?.funasr_language,
    catalog.recognitionLanguage,
  );
  const memoryMatchesConfig = sidecarMemoryModelMatchesConfig(asrCaps);
  const panelBusy = busy || prepareModelBusy;
  const selectedLabel =
    catalogEntryForHub(catalog.selectedHubModelId)?.label ?? catalog.selectedHubModelId;

  return (
    <section className="flex flex-col gap-4">
      <div className="pb-1">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>转写模型</h3>
        <p className={PANEL_TYPOGRAPHY.sectionDescription}>
          选择本机 FunASR 主模型。切换后点「应用并重启侧车」；长音频推荐 Paraformer。
          {!catalog.bundledSidecarManaged
            ? " 开发模式会重启源码侧车（services/asr/.venv），无需手动 Ctrl+C 终端。"
            : null}
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>当前模型</span>
        <select
          className="w-full max-w-xl rounded border border-notion-divider bg-notion-bg px-2.5 py-2 font-mono text-[12px] text-notion-text"
          value={catalog.selectedHubModelId}
          disabled={panelBusy || catalog.applyBusy}
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

      <label className="flex flex-col gap-1.5">
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>识别语言</span>
        <select
          className="w-full max-w-xl rounded border border-notion-divider bg-notion-bg px-2.5 py-2 text-[12px] text-notion-text"
          value={catalog.recognitionLanguage}
          disabled={panelBusy || catalog.applyBusy}
          onChange={(e) =>
            catalog.setRecognitionLanguage(
              e.target.value as typeof catalog.recognitionLanguage,
            )
          }
        >
          {LOCAL_ASR_RECOGNITION_LANGUAGE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <p className={PANEL_TYPOGRAPHY.meta}>
          {
            LOCAL_ASR_RECOGNITION_LANGUAGE_OPTIONS.find(
              (o) => o.id === catalog.recognitionLanguage,
            )?.description
          }{" "}
          切换后请点「应用并重启侧车」生效。
        </p>
      </label>

      <p className={PANEL_TYPOGRAPHY.meta}>{selectedView?.description ?? catalog.selectedEntry.description}</p>
      <p className={PANEL_TYPOGRAPHY.meta}>
        磁盘约 {selectedView?.diskHint ?? catalog.selectedEntry.diskHint}
        {(selectedView?.recommendLongAudio ?? catalog.selectedEntry.recommendLongAudio)
          ? " · 适合长音频多语段"
          : ""}
      </p>

      <div className="flex flex-col gap-1">
        {catalogView.map((item) => (
          <div
            key={item.catalogId}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-notion-divider py-1.5 last:border-0"
          >
            <span className={PANEL_TYPOGRAPHY.meta}>{item.label}</span>
            <span className={PANEL_TYPOGRAPHY.meta}>
              {item.cached ? "已缓存" : "未下载"}
              {item.readyForTranscribe ? " · 可转写" : ""}
              {item.active ? " · 侧车当前" : ""}
            </span>
          </div>
        ))}
      </div>

      {!catalog.sidecarCatalogCapable ? (
        <p className={`${PANEL_TYPOGRAPHY.meta} rounded border border-notion-divider bg-notion-callout-bg px-3 py-2`}>
          8741 上的侧车进程较旧（无模型目录接口）。应用会自动尝试结束旧进程并拉起新侧车；若仍失败，请完全退出应用后再开。
        </p>
      ) : null}

      {catalog.sidecarCatalogCapable && !catalog.sidecarPuncPrepareCapable ? (
        <p
          className={`${PANEL_TYPOGRAPHY.meta} rounded border border-zen-saffron/30 bg-zen-saffron/10 px-3 py-2 text-notion-text`}
          role="status"
        >
          侧车版本过旧（无标点模型准备与下载取消接口），长音频 Paraformer 易整轨单语段。请完全退出应用后重开，或在下方点「重试内置侧车」，再「校验/刷新缓存」。
        </p>
      ) : null}

      {catalog.sidecarCatalogCapable &&
      catalog.sidecarPuncPrepareCapable &&
      !catalog.sidecarAsyncTranscribeCapable ? (
        <p
          className={`${PANEL_TYPOGRAPHY.meta} rounded border border-zen-saffron/30 bg-zen-saffron/10 px-3 py-2 text-notion-text`}
          role="status"
        >
          侧车版本过旧（无增量转写接口 POST /v1/transcribe/async），拉取语段将无法分批预览。请完全退出应用后重开，或执行 npm run asr:build-sidecar-unix 重建内置侧车。
        </p>
      ) : null}

      {sidecarMatchesSelection && !languageMatchesSidecar ? (
        <p
          className={`${PANEL_TYPOGRAPHY.meta} rounded border border-zen-saffron/30 bg-zen-saffron/10 px-3 py-2 text-notion-text`}
          role="status"
        >
          已选识别语言{" "}
          <strong className="font-medium">
            {localAsrRecognitionLanguageLabel(catalog.recognitionLanguage)}
          </strong>
          ，但侧车仍在使用{" "}
          <code className="font-mono text-[11px]">
            {localAsrRecognitionLanguageLabel(
              normalizeLocalAsrRecognitionLanguage(asrCaps?.funasr_language),
            )}
          </code>
          。请点「应用并重启侧车」。
        </p>
      ) : null}

      {!sidecarMatchesSelection ? (
        <p
          className={`${PANEL_TYPOGRAPHY.meta} rounded border border-zen-saffron/30 bg-zen-saffron/10 px-3 py-2 text-notion-text`}
          role="status"
        >
          {sidecarHub ? (
            <>
              已选 <strong className="font-medium">{selectedLabel}</strong>，但侧车仍在运行{" "}
              <code className="font-mono text-[11px]">{sidecarHub}</code>。请点「应用并重启侧车」后再下载/转写。
            </>
          ) : (
            <>
              已选 <strong className="font-medium">{selectedLabel}</strong>，侧车尚未切换到该模型。请点「应用并重启侧车」后再下载/转写。
            </>
          )}
        </p>
      ) : null}

      {sidecarMatchesSelection && !memoryMatchesConfig ? (
        <p
          className={`${PANEL_TYPOGRAPHY.meta} rounded border border-zen-saffron/30 bg-zen-saffron/10 px-3 py-2 text-notion-text`}
          role="status"
        >
          侧车配置为 <code className="font-mono text-[11px]">{sidecarHub}</code>，但内存仍加载{" "}
          <code className="font-mono text-[11px]">{asrCaps?.funasr_loaded_model_id}</code>。请点「应用并重启侧车」或等待侧车完成切换后再转写。
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-notion-divider bg-notion-bg px-2.5 py-1 text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:opacity-40"
          disabled={panelBusy || catalog.applyBusy}
          onClick={() => void catalog.applySelectedModel()}
        >
          {catalog.applyBusy
            ? "正在应用…"
            : "应用并重启侧车"}
        </button>
      </div>

      {sidecarHub ? (
        <p className={`${PANEL_TYPOGRAPHY.meta} font-mono text-[11px]`}>
          侧车运行中：{sidecarHub}
          {sidecarMatchesSelection ? "（与所选一致）" : ""}
          {asrCaps?.funasr_language
            ? ` · 识别语言 ${localAsrRecognitionLanguageLabel(
                normalizeLocalAsrRecognitionLanguage(asrCaps.funasr_language),
              )}`
            : ""}
        </p>
      ) : null}
    </section>
  );
}
