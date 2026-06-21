import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type OfflineAsrModelsPackProgress = {
  phase: string;
  copiedBytes: number;
  totalBytes: number;
  percent: number;
};

export const OFFLINE_ASR_MODELS_PACK_PROGRESS_EVENT = "offline-asr-models-pack-progress";

/** Map phase-local 0–100% to a monotonic overall import percent. */
export function computeOfflineImportWeightedPercent(
  phase: string,
  phasePercent: number,
  previousWeighted = 0,
): number {
  const p = Math.min(100, Math.max(0, phasePercent));
  switch (phase) {
    case "extract":
      return Math.round(p * 0.05);
    case "copy":
      return 5 + Math.round(p * 0.4);
    case "merge":
      return 45 + Math.round(p * 0.5);
    case "validate":
      return 95 + Math.round(p * 0.05);
    default:
      return previousWeighted;
  }
}

export async function listenOfflineAsrModelsPackProgress(
  onProgress: (progress: OfflineAsrModelsPackProgress) => void,
): Promise<UnlistenFn> {
  return listen<OfflineAsrModelsPackProgress>(
    OFFLINE_ASR_MODELS_PACK_PROGRESS_EVENT,
    (event) => {
      onProgress(event.payload);
    },
  );
}

export function offlineImportProgressLabel(phase: string, weightedPercent: number): string {
  switch (phase) {
    case "extract":
      return `正在解压离线包… ${weightedPercent}%`;
    case "copy":
      return `正在复制模型文件… ${weightedPercent}%`;
    case "merge":
      return `正在写入本机缓存… ${weightedPercent}%`;
    case "validate":
      return "正在校验模型完整性…";
    default:
      return `正在导入离线模型包… ${weightedPercent}%`;
  }
}
