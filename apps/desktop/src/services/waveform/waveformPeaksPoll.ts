import type { WaveformPeaksStatus } from "../../tauri/waveformPeaksApi";

const PEAKS_POLL_INTERVAL_MS = 400;

/** All configured LOD `.dat` files are on disk. */
export function peaksAllLevelsReady(st: WaveformPeaksStatus): boolean {
  return st.levels.length > 0 && st.levels.every((l) => l.exists);
}

export function resolvePeaksPollTimeoutMs(mediaDurationSec: number): number {
  if (!(mediaDurationSec > 0)) return 120_000;
  return Math.min(900_000, Math.max(120_000, mediaDurationSec * 350 + 60_000));
}

export async function pollWaveformPeaksUntilReady(input: {
  readStatus: () => Promise<WaveformPeaksStatus>;
  mediaDurationSec: number;
  isCancelled: () => boolean;
}): Promise<WaveformPeaksStatus> {
  const deadline = Date.now() + resolvePeaksPollTimeoutMs(input.mediaDurationSec);

  while (!input.isCancelled()) {
    const st = await input.readStatus();
    if (peaksAllLevelsReady(st)) {
      return st;
    }
    if (!st.generating && !st.levels.some((l) => l.exists)) {
      throw new Error("波形 peaks 生成未启动或已失败");
    }
    if (Date.now() >= deadline) {
      throw new Error("等待波形 peaks 生成超时");
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, PEAKS_POLL_INTERVAL_MS);
    });
  }

  throw new Error("波形 peaks 加载已取消");
}
