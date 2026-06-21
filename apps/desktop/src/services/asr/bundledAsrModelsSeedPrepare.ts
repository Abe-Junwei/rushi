import { isDefaultBundledAsrTarget, isTauriRuntime } from "../../config/env";
import { seedBundledAsrModelsIfNeeded } from "../../tauri/projectAsrMaintenanceApi";
import { retryBundledAsrSidecar } from "../../tauri/projectApi";
import { fetchAsrHealthCaps } from "./asrHealthSnapshot";
import {
  computeLocalAsrTranscribeReady,
  readStoredLocalAsrHubModelId,
  resolveLocalAsrHubModelId,
} from "./localAsrModelCatalog";
import {
  bundledSeedProgressLabel,
  computeBundledSeedWeightedPercent,
  listenBundledAsrModelsSeedProgress,
} from "./bundledAsrModelsSeedProgress";

const SEED_READY_POLL_MS = 1500;
const SEED_READY_MAX_POLLS = 120;

export type BundledSeedPrepareOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string; noBundle: boolean };

/** D7：一键准备 / 8741 外来路径复制时同步顶栏 chip 与 env 四灯（不经模型卡按钮）。 */
export type BundledCopyPresentationSync = {
  begin: () => void;
  setProgress: (percent: number) => void;
  end: () => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntilSelectedModelDiskReady(
  hubModelId: string,
): Promise<boolean> {
  for (let i = 0; i < SEED_READY_MAX_POLLS; i++) {
    const caps = await fetchAsrHealthCaps();
    const hub = resolveLocalAsrHubModelId(hubModelId);
    const { ready, sidecarMatchesSelection } = computeLocalAsrTranscribeReady({
      asrHealth: caps ? "ok" : "error",
      asrCaps: caps,
      selectedHubModelId: hub,
    });
    if (ready && sidecarMatchesSelection) {
      return true;
    }
    if (
      caps &&
      sidecarMatchesSelection &&
      caps.funasr_required_models_cached === true
    ) {
      return true;
    }
    await sleep(SEED_READY_POLL_MS);
  }
  return false;
}

/** Plan B: copy bundled Paraformer triplet into App Data — never ModelScope download. */
export async function ensureBundledAsrModelsSeededForPrepare(options?: {
  onProgress?: (percent: number, message: string) => void;
  presentationSync?: BundledCopyPresentationSync;
}): Promise<BundledSeedPrepareOutcome> {
  if (!isTauriRuntime()) {
    return {
      ok: false,
      noBundle: false,
      message: "需在桌面应用中运行才能从安装包复制模型。",
    };
  }
  if (!isDefaultBundledAsrTarget()) {
    return {
      ok: false,
      noBundle: false,
      message: "当前未使用内置侧车，无法从安装包复制模型。",
    };
  }

  let presentationStarted = false;
  let lastWeighted = 0;
  const unlisten = await listenBundledAsrModelsSeedProgress((progress) => {
    const weighted = computeBundledSeedWeightedPercent(
      progress.phase,
      progress.percent,
      lastWeighted,
    );
    lastWeighted = weighted;
    options?.presentationSync?.setProgress(weighted);
    options?.onProgress?.(
      weighted,
      bundledSeedProgressLabel(progress.phase, weighted),
    );
  });

  try {
    options?.presentationSync?.begin();
    presentationStarted = true;
    const result = await seedBundledAsrModelsIfNeeded();
    if (result.status === "skipped_no_bundle") {
      return {
        ok: false,
        noBundle: true,
        message:
          "安装包内未找到内置语音模型。请使用含 bundled-asr-models 的 Release 安装包，或重新安装。",
      };
    }
    if (result.status === "seeded") {
      await retryBundledAsrSidecar();
    }

    const hubModelId = resolveLocalAsrHubModelId(readStoredLocalAsrHubModelId());
    const ready = await pollUntilSelectedModelDiskReady(hubModelId);
    if (ready) {
      return {
        ok: true,
        message: "内置 Paraformer 模型已从安装包复制完成，可直接转写。",
      };
    }
    return {
      ok: false,
      noBundle: false,
      message:
        "内置模型复制已完成或已跳过，但侧车尚未报告模型就绪。请重启应用或点「重试内置侧车」。",
    };
  } finally {
    unlisten();
    if (presentationStarted) {
      options?.presentationSync?.end();
    }
  }
}
