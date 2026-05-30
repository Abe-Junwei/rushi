import type WaveSurfer from "wavesurfer.js";
import type { PeakCache } from "./PeakCache";

/** Convert WaveSurfer exportPeaks (per-bucket max) to interleaved min/max for minimap draw. */
export function interleaveExportPeaksChannel(channel: number[] | undefined): Float32Array | null {
  if (!channel || channel.length === 0) return null;
  const out = new Float32Array(channel.length * 2);
  for (let i = 0; i < channel.length; i += 1) {
    const v = channel[i] ?? 0;
    out[i * 2] = -Math.abs(v);
    out[i * 2 + 1] = Math.abs(v);
  }
  return out;
}

export function exportMinimapPeaksFromWaveSurfer(
  ws: WaveSurfer | null | undefined,
  overviewWidthPx: number,
): Float32Array | null {
  if (!ws) return null;
  try {
    const widthPx = Math.max(1, Math.floor(overviewWidthPx));
    const exported = ws.exportPeaks({ channels: 1, maxLength: widthPx, precision: 4 });
    return interleaveExportPeaksChannel(exported[0]);
  } catch {
    return null;
  }
}

export async function resolveMinimapPeaksForDraw(input: {
  peakCache: PeakCache | null;
  overviewWidthPx: number;
  layoutDurationSec: number;
  exportFromWaveSurfer?: () => Float32Array | null;
}): Promise<Float32Array | null> {
  const { peakCache, overviewWidthPx, layoutDurationSec, exportFromWaveSurfer } = input;
  const widthPx = Math.max(1, Math.floor(overviewWidthPx));

  const exportPeaks = exportFromWaveSurfer?.() ?? null;
  if (exportPeaks && exportPeaks.length >= 2) {
    return exportPeaks;
  }

  if (peakCache && layoutDurationSec > 0) {
    const syncBundle = peakCache.getMinimapPeaks(widthPx, layoutDurationSec);
    const syncCh0 = syncBundle?.peaks[0];
    if (syncCh0 && syncCh0.length >= 2) {
      return syncCh0 instanceof Float32Array ? syncCh0 : Float32Array.from(syncCh0);
    }
    try {
      const bundle = await peakCache.getMinimapPeaksAsync(widthPx, layoutDurationSec);
      const ch0 = bundle?.peaks[0];
      if (ch0 && ch0.length >= 2) {
        return ch0 instanceof Float32Array ? ch0 : Float32Array.from(ch0);
      }
    } catch {
      /* fall through */
    }
  }

  return exportPeaks;
}
