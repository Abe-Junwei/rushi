/** Extract interleaved min/max peaks for a viewport window from a LOD WaveformData. */

const INT16_SCALE = 32767;

export type ViewportWindowPeaksSource = {
  length: number;
  channel: (index: number) => {
    min_sample: (i: number) => number;
    max_sample: (i: number) => number;
  };
};

export type ExtractViewportWindowPeaksInput = {
  data: ViewportWindowPeaksSource;
  /** Layout media duration (kept for call-site symmetry / future sample-rate checks). */
  durationSec: number;
  timelineWidthPx: number;
  windowLeftPx: number;
  windowWidthPx: number;
};

/**
 * Map a layout timeline window to peak columns at ~1 CSS px per column.
 * LOD denser than the window → min/max downsample; sparser → nearest-neighbor (LOD limit).
 * Does **not** use the full-timeline 40960 column cap.
 * Optional `into` reuses a scratch buffer when `into.length >= windowWidth*2`.
 */
export function extractViewportWindowPeaks(
  input: ExtractViewportWindowPeaksInput,
  into?: Float32Array,
): Float32Array {
  const {
    data,
    timelineWidthPx,
    windowLeftPx,
    windowWidthPx,
  } = input;
  const outWidth = Math.max(1, Math.floor(windowWidthPx));
  const need = outWidth * 2;
  const out =
    into && into.length >= need ? into.subarray(0, need) : new Float32Array(need);
  const timelineWidth = Math.max(1, timelineWidthPx);
  const lodLen = Math.max(1, Math.floor(data.length));
  if (lodLen <= 0) {
    out.fill(0);
    return out;
  }

  const channel = data.channel(0);
  const left = Math.max(0, Math.min(timelineWidth, windowLeftPx));
  const right = Math.max(left, Math.min(timelineWidth, left + outWidth));

  // Inclusive-exclusive LOD index range covering the window.
  const startCol = Math.max(
    0,
    Math.min(lodLen - 1, Math.floor((left / timelineWidth) * lodLen)),
  );
  const endColExclusive = Math.max(
    startCol + 1,
    Math.min(lodLen, Math.ceil((right / timelineWidth) * lodLen)),
  );
  const span = endColExclusive - startCol;

  for (let x = 0; x < outWidth; x += 1) {
    const a = startCol + Math.floor((x * span) / outWidth);
    const b = Math.max(a + 1, startCol + Math.floor(((x + 1) * span) / outWidth));
    let minV = Number.POSITIVE_INFINITY;
    let maxV = Number.NEGATIVE_INFINITY;
    const hi = Math.min(lodLen, Math.max(a + 1, b));
    for (let i = a; i < hi; i += 1) {
      const mn = channel.min_sample(i) / INT16_SCALE;
      const mx = channel.max_sample(i) / INT16_SCALE;
      if (mn < minV) minV = mn;
      if (mx > maxV) maxV = mx;
    }
    if (!Number.isFinite(minV)) minV = 0;
    if (!Number.isFinite(maxV)) maxV = 0;
    out[x * 2] = minV;
    out[x * 2 + 1] = maxV;
  }

  return out;
}

/** Effective layout px/s for LOD pick (timeline soft-cap path). */
export function resolveViewportPeaksPxPerSec(
  timelineWidthPx: number,
  durationSec: number,
  fallbackPxPerSec: number,
): number {
  if (durationSec > 0 && timelineWidthPx > 0) {
    return timelineWidthPx / durationSec;
  }
  return fallbackPxPerSec > 0 ? fallbackPxPerSec : 1;
}
