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
};

export type AsrCatalogPresentation = {
  catalogView: LocalAsrCatalogStatusItem[];
  selectedPrepare: ReturnType<typeof selectedModelPrepareState>;
  modelsCached: boolean;
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
  const modelsCached = selectedPrepare.cached;
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

  const progress = prepareJob?.active
    ? prepareJob.progress
    : modelsCached
      ? 100
      : 0;

  const progressLabel = prepareJob
    ? prepareJob.progressLabel
    : modelsCached
      ? "已缓存 · 100%"
      : selectedPrepare.cached
        ? "主模型已缓存 · 辅助模型待补齐"
        : "未下载";

  const progressTone: AsrCatalogPresentation["progressTone"] =
    modelsCached && !prepareModelBusy && !prepareModelCancelling ? "success" : "muted";

  return {
    catalogView,
    selectedPrepare,
    modelsCached,
    progress,
    progressLabel,
    progressTone,
    sidecarMatchesSelection: selectedPrepare.sidecarMatchesSelection,
    selectedLabel,
  };
}
