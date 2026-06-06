import { useEffect } from "react";
import { resolveMediaDurationSec } from "../utils/waveformTimelineMetrics";

type DurationSyncInput = {
  setResolvedDurationSec: (value: number | ((prev: number) => number)) => void;
  projectId: string | null;
  fileId: string | null;
  mediaUrl: string | null;
  wfDuration: number;
  wfIsReady: boolean;
  peaksStatusDurationSec: number;
  peakCache: unknown;
};

/** Keeps peaks media-duration aligned with WS + peaks status (timeline controller). */
export function useWaveformTimelineDurationSync(input: DurationSyncInput) {
  useEffect(() => {
    input.setResolvedDurationSec(0);
  }, [input.projectId, input.fileId, input.mediaUrl, input.setResolvedDurationSec]);

  useEffect(() => {
    const d = resolveMediaDurationSec({
      wsDurationSec: input.wfDuration,
      peaksStatusDurationSec: input.peaksStatusDurationSec,
    });
    if (d > 0) {
      input.setResolvedDurationSec((prev) => (Math.abs(prev - d) < 1e-6 ? prev : d));
    }
  }, [
    input.wfDuration,
    input.wfIsReady,
    input.peaksStatusDurationSec,
    input.peakCache,
    input.setResolvedDurationSec,
  ]);
}
