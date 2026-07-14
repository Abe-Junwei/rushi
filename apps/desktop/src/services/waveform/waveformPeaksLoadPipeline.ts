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

/** Grace polls while spawn / lock may still be settling (React Strict Mode remount). */
const PEAKS_SPAWN_GRACE_POLLS = 20;
const PEAKS_SPAWN_GRACE_INTERVAL_MS = 250;

function levelToEntry(level: WaveformPeakLevelStatus) {
  return {
    level: level.level,
    pixelsPerSecond: level.pixelsPerSecond,
    path: level.path,
  };
}

function peaksIdleWithoutFiles(st: WaveformPeaksStatus): boolean {
  return !st.generating && !st.levels.some((l) => l.exists);
}

export async function loadPeakCacheFromStatus(
  st: WaveformPeaksStatus,
  onBootstrap?: (cache: PeakCache) => void,
): Promise<PeakCache | null> {
  const ready = st.levels.filter((l) => l.exists);
  if (ready.length === 0) return null;

  const bootstrapLevels = ready.filter((l) => l.level <= 1);
  const bootstrapEntries =
    bootstrapLevels.length > 0
      ? bootstrapLevels
      : [ready.reduce((a, b) => (a.level <= b.level ? a : b))];

  const cache = await PeakCache.fromLevelUrls(bootstrapEntries.map(levelToEntry));
  if (!cache) return null;
  cache.registerLevels(ready.map(levelToEntry));
  onBootstrap?.(cache);
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

async function sleepMs(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Soft-join an in-flight (or not-yet-visible) generation.
 *
 * Do NOT `force: true` here: force used to unlink the live `.generating.lock`,
 * which made status flip to idle while the worker kept running — UI showed
 * failure after a few seconds, then re-enter revealed a complete waveform.
 */
async function recoverIdlePeaksStatus(input: {
  projectId: string;
  fileId: string;
  mediaDurationSec: number;
  isCancelled: () => boolean;
  onStatus: (st: WaveformPeaksStatus) => void;
  initial: WaveformPeaksStatus;
}): Promise<WaveformPeaksStatus> {
  if (input.isCancelled()) return input.initial;
  const mediaDurationSec =
    input.mediaDurationSec > 0 ? input.mediaDurationSec : undefined;

  // Soft ensure joins a lock holder (wait) or spawns if idle.
  let st = await ensureWaveformPeaks(input.projectId, input.fileId, {
    mediaDurationSec,
  });
  if (!input.isCancelled()) input.onStatus(st);
  if (!peaksIdleWithoutFiles(st)) return st;

  for (let i = 0; i < PEAKS_SPAWN_GRACE_POLLS; i++) {
    if (input.isCancelled()) return st;
    if (!peaksIdleWithoutFiles(st)) return st;
    await sleepMs(PEAKS_SPAWN_GRACE_INTERVAL_MS);
    st = await waveformPeaksStatus(input.projectId, input.fileId);
    if (!input.isCancelled()) input.onStatus(st);
  }
  if (input.isCancelled() || !peaksIdleWithoutFiles(st)) return st;

  // Still idle after grace — soft ensure once more (never force).
  st = await ensureWaveformPeaks(input.projectId, input.fileId, {
    mediaDurationSec,
  });
  if (!input.isCancelled()) input.onStatus(st);
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

  if (peaksIdleWithoutFiles(st)) {
    st = await recoverIdlePeaksStatus({
      projectId: input.projectId,
      fileId: input.fileId,
      mediaDurationSec: input.mediaDurationSec,
      isCancelled: input.isCancelled,
      onStatus: input.onStatus,
      initial: st,
    });
    if (input.isCancelled()) return { status: st, cache };
    cache = (await loadPeakCacheFromStatus(st, input.onBootstrap)) ?? cache;
    if (peaksAllLevelsReady(st)) {
      return { status: st, cache };
    }
    if (peaksIdleWithoutFiles(st)) {
      throw new Error("波形 peaks 生成未启动或已失败");
    }
  }

  st = await pollWaveformPeaksUntilReady({
    readStatus: async () => {
      const next = await waveformPeaksStatus(input.projectId, input.fileId);
      if (!input.isCancelled()) {
        input.onStatus(next);
        if (!cache || next.levels.some((l) => l.exists && !st.levels.find((o) => o.level === l.level)?.exists)) {
          if (cache) {
            cache.registerLevels(next.levels.filter((l) => l.exists).map(levelToEntry));
          } else {
            cache = await loadPeakCacheFromStatus(next, input.onBootstrap);
          }
        }
        st = next;
      }
      return next;
    },
    mediaDurationSec: Math.max(
      input.mediaDurationSec > 0 ? input.mediaDurationSec : 0,
      st.durationSec ?? 0,
      input.initial.durationSec ?? 0,
    ),
    isCancelled: input.isCancelled,
  });

  if (!input.isCancelled()) {
    input.onStatus(st);
    if (cache) {
      cache.registerLevels(st.levels.filter((l) => l.exists).map(levelToEntry));
    } else {
      cache = await loadPeakCacheFromStatus(st, input.onBootstrap);
    }
  }
  return { status: st, cache };
}
