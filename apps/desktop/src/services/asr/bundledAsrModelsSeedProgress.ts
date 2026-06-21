import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const BUNDLED_ASR_MODELS_SEED_PROGRESS_EVENT = "bundled-asr-models-seed-progress";

export type BundledAsrModelsSeedProgress = {
  phase: string;
  copiedBytes: number;
  totalBytes: number;
  percent: number;
};

export function listenBundledAsrModelsSeedProgress(
  onProgress: (progress: BundledAsrModelsSeedProgress) => void,
): Promise<UnlistenFn> {
  return listen<{
    phase: string;
    copiedBytes: number;
    totalBytes: number;
    percent: number;
  }>(BUNDLED_ASR_MODELS_SEED_PROGRESS_EVENT, (event) => {
    const p = event.payload;
    onProgress({
      phase: p.phase,
      copiedBytes: p.copiedBytes,
      totalBytes: p.totalBytes,
      percent: p.percent,
    });
  });
}

export function computeBundledSeedWeightedPercent(
  phase: string,
  phasePercent: number,
  lastWeighted: number,
): number {
  const weights: Record<string, [number, number]> = {
    validate: [0, 5],
    copy: [5, 85],
    merge: [85, 100],
  };
  const band = weights[phase] ?? [0, 100];
  const [start, end] = band;
  const span = Math.max(end - start, 1);
  const weighted = start + Math.round((phasePercent * span) / 100);
  return Math.max(lastWeighted, Math.min(100, weighted));
}

export function bundledSeedProgressLabel(phase: string, percent: number): string {
  if (phase === "merge") {
    return `正在准备内置语音模型… ${percent}%（写入应用数据）`;
  }
  return `正在准备内置语音模型… ${percent}%`;
}
