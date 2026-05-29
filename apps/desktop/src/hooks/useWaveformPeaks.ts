import { useEffect, useRef, useState } from "react";
import { PeakCache } from "../services/waveform/PeakCache";
import {
  ensureWaveformPeaks,
  peakLevelAssetUrl,
  type WaveformPeaksStatus,
} from "../tauri/waveformPeaksApi";
import {
  peaksEnsureMediaDurationSec,
  peaksMediaDurationMismatch,
} from "../utils/peakMediaDuration";

async function loadPeakCacheFromStatus(st: WaveformPeaksStatus): Promise<PeakCache | null> {
  const ready = st.levels.filter((l) => l.exists);
  if (ready.length === 0) return null;
  return PeakCache.fromLevelUrls(
    ready.map((l) => ({
      level: l.level,
      pixelsPerSecond: l.pixelsPerSecond,
      url: peakLevelAssetUrl(l.path),
    })),
  );
}

function peaksStatusMismatch(
  status: WaveformPeaksStatus,
  mediaDurationSec: number,
): boolean {
  const peakDur = status.durationSec ?? 0;
  return peaksMediaDurationMismatch(peakDur, mediaDurationSec);
}

async function ensurePeaksAlignedWithMedia(
  projectId: string,
  fileId: string,
  mediaDurationSec?: number,
): Promise<WaveformPeaksStatus> {
  let st = await ensureWaveformPeaks(projectId, fileId, {
    mediaDurationSec: mediaDurationSec,
  });

  if (mediaDurationSec != null && mediaDurationSec > 0 && peaksStatusMismatch(st, mediaDurationSec)) {
    st = await ensureWaveformPeaks(projectId, fileId, {
      force: true,
      mediaDurationSec: mediaDurationSec,
    });
    if (peaksStatusMismatch(st, mediaDurationSec)) {
      const peakLabel = st.durationSec != null ? `${Math.round(st.durationSec)}s` : "?";
      throw new Error(
        `波形 peaks 不完整（${peakLabel} / ${Math.round(mediaDurationSec)}s）。请重新打开项目或检查音频文件。`,
      );
    }
  }

  return st;
}

export function useWaveformPeaks(
  projectId: string | null,
  fileId: string | null,
  mediaDurationSec = 0,
) {
  const [status, setStatus] = useState<WaveformPeaksStatus | null>(null);
  const [peakCache, setPeakCache] = useState<PeakCache | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef(0);
  const identityRef = useRef<string | null>(null);

  useEffect(() => {
    const runId = ++runIdRef.current;
    const identity = projectId && fileId ? `${projectId}|${fileId}` : null;
    const identityChanged = identityRef.current !== identity;
    identityRef.current = identity;

    if (!projectId || !fileId) {
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

    const mediaRef = peaksEnsureMediaDurationSec(mediaDurationSec);

    void (async () => {
      try {
        const st = await ensurePeaksAlignedWithMedia(projectId, fileId, mediaRef);
        if (cancelled || runId !== runIdRef.current) return;
        setStatus(st);
        const cache = await loadPeakCacheFromStatus(st);
        if (cancelled || runId !== runIdRef.current) return;
        setPeakCache(cache);
        setError(null);
      } catch (e) {
        if (cancelled || runId !== runIdRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
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
  }, [projectId, fileId, mediaDurationSec]);

  return { status, peakCache, loading, error };
}
