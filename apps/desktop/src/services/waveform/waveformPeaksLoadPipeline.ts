import { PeakCache } from "./PeakCache";
import {
  peaksAllLevelsReady,
  pollWaveformPeaksUntilReady,
} from "./waveformPeaksPoll";
import {
  ensureWaveformPeaks,
  waveformPeaksStatus,
  type WaveformPeakLevelStatus,
  type WaveformPeaksStatus,
} from "../../tauri/waveformPeaksApi";
import { shouldForcePeaksRegenerate } from "../../utils/peakMediaDuration";

function levelToEntry(level: WaveformPeakLevelStatus) {
  return {
    level: level.level,
    pixelsPerSecond: level.pixelsPerSecond,
    path: level.path,
  };
}

export async function loadPeakCacheFromStatus(
  st: WaveformPeaksStatus,
  onBootstrap?: (cache: PeakCache) => void,
): Promise<PeakCache | null> {
  const ready = st.levels.filter((l) => l.exists);
  if (ready.length === 0) return null;

  const bootstrapLevels = ready.filter((l) => l.level <= 1);
  const deferredLevels = ready.filter((l) => l.level >= 2);
  const bootstrapEntries =
    bootstrapLevels.length > 0
      ? bootstrapLevels
      : [ready.reduce((a, b) => (a.level <= b.level ? a : b))];

  const cache = await PeakCache.fromLevelUrls(bootstrapEntries.map(levelToEntry));
  if (!cache) return null;
  onBootstrap?.(cache);

  if (deferredLevels.length > 0) {
    await cache.loadLevels(deferredLevels.map(levelToEntry));
  }
  return cache;
}

export async function ensurePeaksAlignedWithMedia(
  projectId: string,
  fileId: string,
  mediaDurationSec?: number,
): Promise<WaveformPeaksStatus> {
  let st = await ensureWaveformPeaks(projectId, fileId, {
    mediaDurationSec: mediaDurationSec,
  });

  if (
    mediaDurationSec != null &&
    mediaDurationSec > 0 &&
    shouldForcePeaksRegenerate(st.durationSec ?? 0, mediaDurationSec)
  ) {
    // One best-effort regenerate in case the cache is genuinely stale. If the
    // gap persists, the audio container is likely over-reporting its duration
    // (Rust already guarantees peaks cover the decodable audio). We do NOT
    // throw: media duration stays the timeline truth and peaks stretch to fill
    // it, instead of blanking the whole waveform. See ADR-0005 follow-up.
    st = await ensureWaveformPeaks(projectId, fileId, {
      force: true,
      mediaDurationSec: mediaDurationSec,
    });
  }

  return st;
}

export async function waitForPeaksWithPolling(input: {
  projectId: string;
  fileId: string;
  initial: WaveformPeaksStatus;
  mediaDurationSec: number;
  isCancelled: () => boolean;
  onStatus: (st: WaveformPeaksStatus) => void;
  onBootstrap: (cache: PeakCache) => void;
}): Promise<{ status: WaveformPeaksStatus; cache: PeakCache | null }> {
  let st = input.initial;
  input.onStatus(st);

  let cache = await loadPeakCacheFromStatus(st, input.onBootstrap);
  if (peaksAllLevelsReady(st)) {
    return { status: st, cache };
  }

  if (!st.generating && !st.levels.some((l) => l.exists)) {
    return { status: st, cache };
  }

  st = await pollWaveformPeaksUntilReady({
    readStatus: async () => {
      const next = await waveformPeaksStatus(input.projectId, input.fileId);
      if (!input.isCancelled()) {
        input.onStatus(next);
        if (!cache || next.levels.some((l) => l.exists && !st.levels.find((o) => o.level === l.level)?.exists)) {
          cache = await loadPeakCacheFromStatus(next, input.onBootstrap);
        }
        st = next;
      }
      return next;
    },
    mediaDurationSec: input.mediaDurationSec,
    isCancelled: input.isCancelled,
  });

  if (!input.isCancelled()) {
    input.onStatus(st);
    cache = await loadPeakCacheFromStatus(st, input.onBootstrap);
  }
  return { status: st, cache };
}
