import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import {
  buildLocalAsrCatalogView,
  catalogEntryForHub,
  selectedModelPrepareState,
  type LocalAsrCatalogStatusItem,
} from "./localAsrModelCatalog";
import { buildPrepareJobPresentation } from "./prepareJobPresentation";

/** D1–D6 对齐：环境页「转写模型」区唯一 catalog presentation 真源。 */
export type BuildAsrCatalogPresentationInput = {
  asrCaps: AsrHealthCapabilities | null;
  catalogStatus: LocalAsrCatalogStatusItem[] | null;
  selectedHubModelId: string;
  prepareModelBusy?: boolean;
  prepareModelCancelling?: boolean;
  prepareModelProgress?: number;
  offlinePackImportBusy?: boolean;
  offlinePackImportProgress?: number;
};

export type AsrCatalogPresentation = {
  catalogView: LocalAsrCatalogStatusItem[];
  selectedPrepare: ReturnType<typeof selectedModelPrepareState>;
  modelsCached: boolean;
  modelsReady: boolean;
  progress: number;
  progressLabel: string;
  progressTone: "success" | "muted";
  sidecarMatchesSelection: boolean;
  selectedLabel: string;
};

export function buildAsrCatalogPresentation(
  input: BuildAsrCatalogPresentationInput,
): AsrCatalogPresentation {
  const catalogView = buildLocalAsrCatalogView(
    input.asrCaps,
    input.catalogStatus,
    input.selectedHubModelId,
  );
  const sidecarHub = input.asrCaps?.funasr_model_id ?? null;
  const selectedPrepare = selectedModelPrepareState(
    catalogView,
    input.selectedHubModelId,
    sidecarHub,
  );
  const prepareModelBusy = input.prepareModelBusy ?? false;
  const prepareModelCancelling = input.prepareModelCancelling ?? false;
  const prepareModelProgress = input.prepareModelProgress ?? 0;
  const offlinePackImportBusy = input.offlinePackImportBusy ?? false;
  const offlinePackImportProgress = input.offlinePackImportProgress ?? 0;
  const modelsCached = selectedPrepare.cached;
  const modelsReady =
    selectedPrepare.readyForTranscribe && selectedPrepare.sidecarMatchesSelection;
  const partialCache =
    !modelsCached &&
    selectedPrepare.sidecarMatchesSelection &&
    (input.asrCaps?.funasr_active_model_cached === true ||
      input.asrCaps?.funasr_default_model_cached === true);
  const selectedLabel =
    catalogEntryForHub(input.selectedHubModelId)?.label ?? input.selectedHubModelId;

  const prepareJob =
    prepareModelBusy || prepareModelCancelling
      ? buildPrepareJobPresentation({
          localBusy: prepareModelBusy,
          cancelling: prepareModelCancelling,
          progressOverride: prepareModelProgress,
          modelLabel: selectedLabel,
        })
      : null;

  const progress = offlinePackImportBusy
    ? offlinePackImportProgress
    : prepareJob?.active
      ? prepareJob.progress
      : modelsCached
        ? 100
        : prepareModelProgress > 0
          ? prepareModelProgress
          : 0;

  const progressLabel = offlinePackImportBusy
    ? `正在导入离线包… ${offlinePackImportProgress}%`
    : prepareJob
      ? prepareJob.progressLabel
      : modelsCached
        ? "已缓存 · 100%"
        : prepareModelProgress > 0
          ? `已暂停 · ${prepareModelProgress}%（可续传）`
          : partialCache
            ? "主模型已缓存 · 辅助模型待补齐"
            : "未准备";

  const progressTone: AsrCatalogPresentation["progressTone"] =
    modelsReady && !prepareModelBusy && !prepareModelCancelling && !offlinePackImportBusy
      ? "success"
      : "muted";

  return {
    catalogView,
    selectedPrepare,
    modelsCached,
    modelsReady,
    progress,
    progressLabel,
    progressTone,
    sidecarMatchesSelection: selectedPrepare.sidecarMatchesSelection,
    selectedLabel,
  };
}
