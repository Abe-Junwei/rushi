import * as projectApi from "../../tauri/projectApi";
import {
  normalizeReleaseVersion,
  rushiReleaseAssetDownloadUrl,
} from "../../config/githubRelease";
import { fetchAsrHealthCaps, pollLoopbackHealthUntil } from "./asrHealthSnapshot";
import {
  setOfflineAsrModelsPackImportActive,
} from "./asrPrepareActivityGate";
import {
  DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
  computeLocalAsrTranscribeReady,
  migrateDeprecatedHubModelId,
} from "./localAsrModelCatalog";
import type { LocalAsrCatalogStatusItem } from "./localAsrModelCatalog";
import {
  computeOfflineImportWeightedPercent,
  listenOfflineAsrModelsPackProgress,
  offlineImportProgressLabel,
} from "./offlineAsrModelsPackProgress";

export function offlineAsrModelsPackAssetName(version: string): string {
  return `rushi-offline-asr-models_${normalizeReleaseVersion(version)}.zip`;
}

export function offlineAsrModelsPackDownloadUrl(version: string): string {
  return rushiReleaseAssetDownloadUrl(version, offlineAsrModelsPackAssetName(version));
}

export type OfflineAsrModelsPackImportFlowInput = {
  selectedHubModelId: string;
  catalogStatus: LocalAsrCatalogStatusItem[] | null;
  prepareModelBusy: boolean;
  prepareModelCancelling: boolean;
  onProgressMessage: (message: string) => void;
  onImportProgress?: (percent: number, phase: string) => void;
  onClearProgress: () => void;
  refreshAsrRuntimeInfo: () => Promise<void>;
  refreshAsrModelCacheInfo: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
};

export type OfflineAsrModelsPackImportFlowResult =
  | { kind: "cancelled" }
  | { kind: "blocked"; message: string }
  | { kind: "error"; message: string }
  | { kind: "success"; skippedReseed?: boolean };

function transcribeReadyFromCaps(
  caps: NonNullable<Awaited<ReturnType<typeof fetchAsrHealthCaps>>>,
  selectedHub: string,
  catalogStatus: LocalAsrCatalogStatusItem[] | null,
): boolean {
  return computeLocalAsrTranscribeReady({
    asrHealth: caps.funasr_ready ? "ok" : "error",
    asrCaps: caps,
    selectedHubModelId: selectedHub,
    catalogStatus,
  }).ready;
}

export async function runOfflineAsrModelsPackImportFlow(
  input: OfflineAsrModelsPackImportFlowInput,
): Promise<OfflineAsrModelsPackImportFlowResult> {
  if (input.prepareModelBusy || input.prepareModelCancelling) {
    return {
      kind: "blocked",
      message: "模型准备进行中，请先取消或等待完成后再导入离线包。",
    };
  }

  const selectedHub = migrateDeprecatedHubModelId(input.selectedHubModelId);
  if (selectedHub !== DEFAULT_LOCAL_ASR_HUB_MODEL_ID) {
    return {
      kind: "blocked",
      message:
        "离线模型包仅包含默认 Paraformer 长音频模型。请先在「所选模型」中选回该 SKU，或使用在线准备。",
    };
  }

  input.onProgressMessage("正在准备导入离线模型包…");
  const unlisten = input.onImportProgress
    ? await listenOfflineAsrModelsPackProgress((progress) => {
        const weighted = computeOfflineImportWeightedPercent(progress.phase, progress.percent);
        input.onImportProgress?.(weighted, progress.phase);
        input.onProgressMessage(offlineImportProgressLabel(progress.phase, weighted));
      })
    : null;

  setOfflineAsrModelsPackImportActive(true);
  let result: projectApi.OfflineAsrModelsPackImportResult | null;
  try {
    result = await projectApi.pickAndImportOfflineAsrModelsPack();
  } catch (error) {
    setOfflineAsrModelsPackImportActive(false);
    input.onClearProgress();
    return {
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (unlisten) unlisten();
  }

  if (!result) {
    setOfflineAsrModelsPackImportActive(false);
    input.onClearProgress();
    return { kind: "cancelled" };
  }

  if (result.skipped_reseed) {
    setOfflineAsrModelsPackImportActive(false);
    input.onClearProgress();
    return { kind: "success", skippedReseed: true };
  }

  try {
    input.onProgressMessage("正在重启侧车并刷新环境…");
    await input.retryBundledAsrSidecar();
    await input.refreshAsrRuntimeInfo();
    await input.refreshAsrModelCacheInfo();
  } catch (error) {
    setOfflineAsrModelsPackImportActive(false);
    input.onClearProgress();
    return {
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const caps = await pollLoopbackHealthUntil({
    deadlineMs: 90_000,
    intervalMs: 1_000,
    predicate: (c) =>
      c.funasr_required_models_cached === true &&
      transcribeReadyFromCaps(c, selectedHub, input.catalogStatus),
  });

  setOfflineAsrModelsPackImportActive(false);
  input.onClearProgress();

  if (!caps || !transcribeReadyFromCaps(caps, selectedHub, input.catalogStatus)) {
    return {
      kind: "error",
      message:
        "离线包已复制，但侧车尚未报告可转写。请点「应用并重启侧车」或重启应用后再试。",
    };
  }

  return { kind: "success" };
}
