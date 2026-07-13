import {
  computeTimelineWidthPx,
  PX_PER_SEC_FIT_MIN,
  PX_PER_SEC_FIT_SELECTION_MAX,
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
  PX_PER_SEC_PEAKS_QUANTUM,
  resolveMaxLayoutPxPerSec,
  resolveMaxPeaksTimelinePxPerSec,
  resolveMaxRenderablePxPerSec,
  TIMELINE_PX_PER_SEC,
} from "./pxPerSecConstants";

/**
 * Draw / peaks LOD budget（WS-era 全轨列数 + decode canvas）。
 * 勿用于 layout 时间轴宽度或「适配语段」——长音频会被压到不可操作。
 */
export function clampPxPerSecForWaveSurferRender(pxPerSec: number, durationSec: number): number {
  const capped = Math.min(
    pxPerSec,
    resolveMaxRenderablePxPerSec(durationSec),
    resolveMaxPeaksTimelinePxPerSec(durationSec),
  );
  return clampPxPerSecForFitSelection(capped);
}

/**
 * Layout / tier / overlay / fit-selection zoom（WS-2b soft timeline width）。
 * 可高于 peaks 列上限，使超长录音上语段仍可操作。
 */
export function clampPxPerSecForLayout(pxPerSec: number, durationSec: number): number {
  const capped = Math.min(pxPerSec, resolveMaxLayoutPxPerSec(durationSec));
  return clampPxPerSecForFitSelection(capped);
}

/** Timeline / tier 布局宽度（layout soft-cap）。 */
export function computeLayoutTimelineWidthPx(durationSec: number, pxPerSec: number): number {
  const sec = Math.max(durationSec, 0.5);
  const layoutPxPerSec = clampPxPerSecForLayout(pxPerSec, sec);
  return computeTimelineWidthPx(sec, layoutPxPerSec);
}

/** @deprecated Prefer {@link computeLayoutTimelineWidthPx}; kept for draw-path callers. */
export function computeRenderableTimelineWidthPx(
  durationSec: number,
  pxPerSec: number,
): number {
  return computeLayoutTimelineWidthPx(durationSec, pxPerSec);
}

export function clampPxPerSec(x: number): number {
  if (!Number.isFinite(x)) return TIMELINE_PX_PER_SEC;
  return Math.min(PX_PER_SEC_MAX, Math.max(PX_PER_SEC_FIT_MIN, x));
}

/** 滑块与 +/- 按钮：不低于手动下限 */
export function clampPxPerSecForSlider(x: number): number {
  if (!Number.isFinite(x)) return TIMELINE_PX_PER_SEC;
  return Math.min(PX_PER_SEC_MAX, Math.max(PX_PER_SEC_MIN, x));
}

export function clampPxPerSecForFitSelection(x: number): number {
  if (!Number.isFinite(x)) return TIMELINE_PX_PER_SEC;
  return Math.min(PX_PER_SEC_FIT_SELECTION_MAX, Math.max(PX_PER_SEC_FIT_MIN, x));
}

/** 将 px/s 量化到分档，减少 peaks resample + ws.load（fit 与缩放滑块共用）。 */
export function quantizePxPerSecForPeaksLoad(pxPerSec: number): number {
  if (!Number.isFinite(pxPerSec)) return TIMELINE_PX_PER_SEC;
  const clamped = clampPxPerSecForFitSelection(pxPerSec);
  const q = PX_PER_SEC_PEAKS_QUANTUM;
  let snapped = Math.round(clamped / q) * q;
  if (clamped < PX_PER_SEC_MIN) {
    if (snapped <= 0) {
      return clamped;
    }
    return clampPxPerSecForFitSelection(snapped);
  }
  if (snapped < PX_PER_SEC_FIT_MIN) {
    snapped = PX_PER_SEC_FIT_MIN;
  }
  if (snapped >= PX_PER_SEC_MIN) {
    return Math.min(PX_PER_SEC_FIT_SELECTION_MAX, Math.max(PX_PER_SEC_MIN, snapped));
  }
  return clampPxPerSecForFitSelection(snapped);
}

/**
 * Ultra-zoomed fit-all (px/s below manual slider min): peaks LOD is already sparse;
 * viewport refit / fullscreen should ws.zoom only — not ws.load per exact px/s.
 */
export function shouldZoomOnlyForSubMinFitAllPeaks(
  loadedPeaksPxPerSec: number,
  requestedPeaksPxPerSec: number,
): boolean {
  if (!Number.isFinite(loadedPeaksPxPerSec) || loadedPeaksPxPerSec <= 0) return false;
  if (loadedPeaksPxPerSec >= PX_PER_SEC_MIN) return false;
  return requestedPeaksPxPerSec < PX_PER_SEC_MIN;
}

const PEAK_TIMELINE_WIDTH_BUCKET_PX = 100;

/** Bucket timeline width for PeakCache resample keys (100px steps). */
export function quantizeTimelineWidthPx(widthPx: number): number {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return PEAK_TIMELINE_WIDTH_BUCKET_PX;
  return Math.max(
    PEAK_TIMELINE_WIDTH_BUCKET_PX,
    Math.round(widthPx / PEAK_TIMELINE_WIDTH_BUCKET_PX) * PEAK_TIMELINE_WIDTH_BUCKET_PX,
  );
}

/** Sub-min fit-all refit: zoom in place — skip ws.load on viewport px/s drift or in-flight peaks. */
export function shouldZoomOnlyForSubMinFitAllRefit(input: {
  requestedPeaksPxPerSec: number;
  loadedPeaksPxPerSec: number;
  peaksLoadedIntoWaveSurfer: boolean;
  peaksLoadInFlight: boolean;
}): boolean {
  const {
    requestedPeaksPxPerSec,
    loadedPeaksPxPerSec,
    peaksLoadedIntoWaveSurfer,
    peaksLoadInFlight,
  } = input;
  if (requestedPeaksPxPerSec >= PX_PER_SEC_MIN) return false;
  if (peaksLoadInFlight) return true;
  if (
    peaksLoadedIntoWaveSurfer &&
    shouldZoomOnlyForSubMinFitAllPeaks(loadedPeaksPxPerSec, requestedPeaksPxPerSec)
  ) {
    return true;
  }
  return false;
}
