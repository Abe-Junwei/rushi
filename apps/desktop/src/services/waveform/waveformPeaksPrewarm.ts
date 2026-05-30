import { ensureWaveformPeaks } from "../../tauri/waveformPeaksApi";
import { readStoredBackgroundPeaksEnabled } from "../../utils/waveformPrefs";
import { peaksEnsureMediaDurationSec } from "../../utils/peakMediaDuration";

/** Fire-and-forget peaks ensure after import/open (Route C2). */
export function scheduleWaveformPeaksPrewarm(
  projectId: string,
  fileId: string,
  mediaDurationSec?: number,
): void {
  if (!readStoredBackgroundPeaksEnabled()) return;
  const mediaRef = peaksEnsureMediaDurationSec(mediaDurationSec ?? 0);
  void ensureWaveformPeaks(projectId, fileId, {
    mediaDurationSec: mediaRef,
  }).catch(() => {
    /* decode path remains available */
  });
}
