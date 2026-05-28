import { useEffect, useRef, useState } from "react";
import { PeakCache } from "../services/waveform/PeakCache";
import { ensureWaveformPeaks, peakLevelAssetUrl, type WaveformPeaksStatus } from "../tauri/waveformPeaksApi";

export function useWaveformPeaks(projectId: string | null, fileId: string | null) {
  const [status, setStatus] = useState<WaveformPeaksStatus | null>(null);
  const [peakCache, setPeakCache] = useState<PeakCache | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    const runId = ++runIdRef.current;
    if (!projectId || !fileId) {
      setStatus(null);
      setPeakCache(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const st = await ensureWaveformPeaks(projectId, fileId);
        if (cancelled || runId !== runIdRef.current) return;
        setStatus(st);
        const ready = st.levels.filter((l) => l.exists);
        if (ready.length === 0) {
          setPeakCache(null);
          return;
        }
        const cache = await PeakCache.fromLevelUrls(
          ready.map((l) => ({
            level: l.level,
            pixelsPerSecond: l.pixelsPerSecond,
            url: peakLevelAssetUrl(l.path),
          })),
        );
        if (cancelled || runId !== runIdRef.current) return;
        setPeakCache(cache);
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
  }, [projectId, fileId]);

  return { status, peakCache, loading, error };
}
