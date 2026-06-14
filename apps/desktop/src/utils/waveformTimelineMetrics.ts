import { clampPxPerSecForWaveSurferRender, computeTimelineWidthPx } from "./pxPerSec";

export type ResolveWaveformTimelineMetricsInput = {
  /** WaveSurfer / media element duration once known. */
  wsDurationSec: number;
  /** Cached peaks manifest duration (fallback before WS ready). */
  peaksStatusDurationSec: number;
  pxPerSec: number;
};

export type WaveformTimelineMetrics = {
  /** Layout / segments / scroll / ruler duration truth. */
  mediaDurationSec: number;
  timelineWidthPx: number;
};

/** Merge WS and peaks-manifest durations into one layout timeline length. */
export function resolveMediaDurationSec(input: {
  wsDurationSec: number;
  peaksStatusDurationSec: number;
}): number {
  const d = input.wsDurationSec || input.peaksStatusDurationSec || 0;
  return d > 0 ? d : 0;
}

/**
 * Single layout duration for seek / peaks load / scroll clamp.
 * Synced layout ref wins; otherwise merged WS + peaks manifest (+ optional cache).
 */
export function resolveLayoutDurationSec(input: {
  layoutDurationSecRef?: number;
  layoutDurationSec?: number;
  wsDurationSec?: number;
  peaksStatusDurationSec?: number;
  peakCacheDurationSec?: number;
}): number {
  const fromRef = input.layoutDurationSecRef ?? 0;
  if (fromRef > 0) return fromRef;
  const fromProp = input.layoutDurationSec ?? 0;
  if (fromProp > 0) return fromProp;
  const peaksManifest = input.peaksStatusDurationSec ?? 0;
  const peaksCache = input.peakCacheDurationSec ?? 0;
  return resolveMediaDurationSec({
    wsDurationSec: input.wsDurationSec ?? 0,
    peaksStatusDurationSec: peaksManifest > 0 ? peaksManifest : peaksCache,
  });
}

/** Single export for timeline width and duration helpers. */
export function resolveWaveformTimelineMetrics(
  input: ResolveWaveformTimelineMetricsInput,
): WaveformTimelineMetrics {
  const mediaDurationSec = resolveMediaDurationSec({
    wsDurationSec: input.wsDurationSec,
    peaksStatusDurationSec: input.peaksStatusDurationSec,
  });
  const renderPxPerSec =
    mediaDurationSec > 0
      ? clampPxPerSecForWaveSurferRender(input.pxPerSec, mediaDurationSec)
      : input.pxPerSec;
  const timelineWidthPx = computeTimelineWidthPx(mediaDurationSec, renderPxPerSec);

  return {
    mediaDurationSec,
    timelineWidthPx,
  };
}
