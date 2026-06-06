import { useCallback, useEffect, useRef, useState } from "react";
import { PeakCache } from "../services/waveform/PeakCache";
import {
  peaksAllLevelsReady,
  pollWaveformPeaksUntilReady,
} from "../services/waveform/waveformPeaksPoll";
import {
  clearWaveformPeaksForFile,
  ensureWaveformPeaks,
  peakLevelAssetUrl,
  waveformPeaksStatus,
  type WaveformPeakLevelStatus,
  type WaveformPeaksStatus,
} from "../tauri/waveformPeaksApi";
import {
  peaksEnsureMediaDurationSec,
  shouldForcePeaksRegenerate,
} from "../utils/peakMediaDuration";
import { logDesktopUi } from "../services/desktopUiLog";

function levelToEntry(level: WaveformPeakLevelStatus) {
  return {
    level: level.level,
    pixelsPerSecond: level.pixelsPerSecond,
    url: peakLevelAssetUrl(level.path),
  };
}

async function loadPeakCacheFromStatus(
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

async function ensurePeaksAlignedWithMedia(
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

async function waitForPeaksWithPolling(input: {
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

export function useWaveformPeaks(
  projectId: string | null,
  fileId: string | null,
  mediaDurationSec = 0,
  backgroundGenerationEnabled = true,
  mediaUrl: string | null = null,
) {
  const backgroundGenerationEnabledRef = useRef(backgroundGenerationEnabled);
  backgroundGenerationEnabledRef.current = backgroundGenerationEnabled;
  const prevMediaUrlRef = useRef(mediaUrl);
  const [status, setStatus] = useState<WaveformPeaksStatus | null>(null);
  const [peakCache, setPeakCache] = useState<PeakCache | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peakCacheGeneration, setPeakCacheGeneration] = useState(0);
  const runIdRef = useRef(0);
  const identityRef = useRef<string | null>(null);
  const mediaDurationSecRef = useRef(mediaDurationSec);
  const mismatchRetryKeyRef = useRef<string | null>(null);
  mediaDurationSecRef.current = mediaDurationSec;

  useEffect(() => {
    if (prevMediaUrlRef.current === mediaUrl) return;
    prevMediaUrlRef.current = mediaUrl;
    runIdRef.current += 1;
    identityRef.current = null;
    mismatchRetryKeyRef.current = null;
    setPeakCache(null);
    setStatus(null);
    setError(null);
    setLoading(false);
    setPeakCacheGeneration(0);
  }, [mediaUrl]);

  useEffect(() => {
    const runId = ++runIdRef.current;
    const identity = projectId && fileId ? `${projectId}|${fileId}` : null;
    const identityChanged = identityRef.current !== identity;
    identityRef.current = identity;
    mismatchRetryKeyRef.current = null;

    if (!projectId || !fileId) {
      setStatus(null);
      setPeakCache(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!backgroundGenerationEnabledRef.current) {
      setStatus(null);
      setPeakCache(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    if (identityChanged) {
      setPeakCache(null);
      setStatus(null);
    }
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const mediaRef = peaksEnsureMediaDurationSec(mediaDurationSecRef.current);
        const initial = await ensurePeaksAlignedWithMedia(projectId, fileId, mediaRef);
        if (cancelled || runId !== runIdRef.current) return;

        const { status: st, cache } = await waitForPeaksWithPolling({
          projectId,
          fileId,
          initial,
          mediaDurationSec: mediaRef ?? 0,
          isCancelled: () => cancelled || runId !== runIdRef.current,
          onStatus: (next) => {
            if (cancelled || runId !== runIdRef.current) return;
            setStatus(next);
          },
          onBootstrap: (partial) => {
            if (cancelled || runId !== runIdRef.current) return;
            setPeakCache(partial);
            setPeakCacheGeneration((g) => g + 1);
            setLoading(false);
          },
        });
        if (cancelled || runId !== runIdRef.current) return;
        setStatus(st);
        setPeakCache(cache);
        setPeakCacheGeneration((g) => g + 1);
        setError(null);
      } catch (e) {
        if (cancelled || runId !== runIdRef.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        logDesktopUi("ERROR", `waveform peaks: ${msg}`);
        setError(msg);
        setPeakCache(null);
      } finally {
        if (!cancelled && runId === runIdRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, fileId, backgroundGenerationEnabled]);

  // Duration probe after identity load — refresh cache once when peaks/media diverge.
  useEffect(() => {
    if (!backgroundGenerationEnabledRef.current) return;
    if (!projectId || !fileId || mediaDurationSec <= 0 || !status) return;
    if (!status.levels.some((l) => l.exists)) return;
    if (!shouldForcePeaksRegenerate(status.durationSec ?? 0, mediaDurationSec)) return;

    const key = `${projectId}|${fileId}|${mediaDurationSec.toFixed(4)}`;
    if (mismatchRetryKeyRef.current === key) return;
    mismatchRetryKeyRef.current = key;

    const runId = ++runIdRef.current;
    let cancelled = false;

    setLoading(true);
    void (async () => {
      try {
        const initial = await ensurePeaksAlignedWithMedia(projectId, fileId, mediaDurationSec);
        if (cancelled || runId !== runIdRef.current) return;

        const { status: st, cache } = await waitForPeaksWithPolling({
          projectId,
          fileId,
          initial,
          mediaDurationSec,
          isCancelled: () => cancelled || runId !== runIdRef.current,
          onStatus: (next) => {
            if (cancelled || runId !== runIdRef.current) return;
            setStatus(next);
          },
          onBootstrap: (partial) => {
            if (cancelled || runId !== runIdRef.current) return;
            setPeakCache(partial);
            setPeakCacheGeneration((g) => g + 1);
            setLoading(false);
          },
        });
        if (cancelled || runId !== runIdRef.current) return;
        setStatus(st);
        setPeakCache(cache);
        setPeakCacheGeneration((g) => g + 1);
        setError(null);
      } catch (e) {
        if (cancelled || runId !== runIdRef.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        logDesktopUi("ERROR", `waveform peaks: ${msg}`);
        setError(msg);
      } finally {
        if (!cancelled && runId === runIdRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, fileId, mediaDurationSec, backgroundGenerationEnabled]);

  const clearAndReloadPeaks = useCallback(async () => {
    if (!projectId || !fileId) {
      throw new Error("未打开音频文件");
    }

    const runId = ++runIdRef.current;
    mismatchRetryKeyRef.current = null;
    setPeakCache(null);
    setStatus(null);
    setLoading(true);
    setError(null);

    try {
      await clearWaveformPeaksForFile(projectId, fileId);
      const mediaRef = peaksEnsureMediaDurationSec(mediaDurationSecRef.current);
      const initial = await ensurePeaksAlignedWithMedia(projectId, fileId, mediaRef);
      if (runId !== runIdRef.current) return;

      const { status: st, cache } = await waitForPeaksWithPolling({
        projectId,
        fileId,
        initial,
        mediaDurationSec: mediaRef ?? 0,
        isCancelled: () => runId !== runIdRef.current,
        onStatus: (next) => {
          if (runId !== runIdRef.current) return;
          setStatus(next);
        },
        onBootstrap: (partial) => {
          if (runId !== runIdRef.current) return;
          setPeakCache(partial);
          setPeakCacheGeneration((g) => g + 1);
          setLoading(false);
        },
      });
      if (runId !== runIdRef.current) return;
      setStatus(st);
      setPeakCache(cache);
      setPeakCacheGeneration((g) => g + 1);
      setError(null);
    } catch (e) {
      if (runId !== runIdRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setPeakCache(null);
      throw e;
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
      }
    }
  }, [projectId, fileId]);

  const peaksUnavailable =
    Boolean(projectId && fileId) && !loading && !peakCache && error != null;

  return { status, peakCache, peakCacheGeneration, loading, error, peaksUnavailable, clearAndReloadPeaks };
}
