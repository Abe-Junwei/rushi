import {
  computeFitAllPxPerSec,
  computeFitSelectionPxPerSec,
  computeTimelineWidthPx,
  FIT_ALL_FILL_GAP_MIN_PX,
  FIT_ALL_FILL_GAP_RATIO,
  isFitAllTimelineFilledInViewport,
  isTimelineFitInViewport,
  PX_PER_SEC_MAX,
  PX_PER_SEC_PEAKS_QUANTUM,
  resolveDefaultEditingPxPerSec,
  TIMELINE_PX_PER_SEC,
  type WaveformZoomLayoutIntent,
  type WaveformZoomSliderRange,
} from "./pxPerSec";

const ZOOM_EPS = 0.001;

/** px/s may sit slightly below computed fit-all min (binary search / rounding); don't treat as out-of-range. */
export function sliderMinTolerancePx(sliderMinPx: number): number {
  return Math.max(ZOOM_EPS, Math.min(PX_PER_SEC_PEAKS_QUANTUM, sliderMinPx * 0.05));
}

export function isPxPerSecBelowSliderMin(pxPerSec: number, sliderMinPx: number): boolean {
  return pxPerSec < sliderMinPx - sliderMinTolerancePx(sliderMinPx);
}

export function isPxPerSecNearFitAll(
  pxPerSec: number,
  fitAllPxPerSec: number,
): boolean {
  const tol = sliderMinTolerancePx(fitAllPxPerSec);
  return (
    Math.abs(pxPerSec - fitAllPxPerSec) <= Math.max(tol, fitAllPxPerSec * 0.05)
  );
}

/** True when px/s was fit-all for the timeline width currently rendered. */
export function wasFitAllPxPerSecForTimelineWidth(input: {
  timelineWidthPx: number;
  durationSec: number;
  pxPerSec: number;
}): boolean {
  const { timelineWidthPx, durationSec, pxPerSec } = input;
  if (!(timelineWidthPx > 0 && durationSec > 0 && Number.isFinite(pxPerSec))) {
    return false;
  }
  const fitAllForWidth = computeFitAllPxPerSec(timelineWidthPx, durationSec);
  const tol = sliderMinTolerancePx(fitAllForWidth);
  return Math.abs(pxPerSec - fitAllForWidth) <= Math.max(tol, fitAllForWidth * 0.05);
}

/**
 * When the user is at (or near) fit-all, recompute px/s after viewport or duration
 * changes so the timeline fills the tier instead of leaving blank space on the right.
 */
export function resolveFitAllPxPerSecAdjustment(
  viewportWidthPx: number,
  durationSec: number,
  currentPxPerSec: number,
  options?: {
    staleFitAllOnViewportGrow?: boolean;
    layoutIntent?: WaveformZoomLayoutIntent;
  },
): number | null {
  if (viewportWidthPx <= 0 || durationSec <= 0 || !Number.isFinite(currentPxPerSec)) {
    return null;
  }
  const fitAll = computeFitAllPxPerSec(viewportWidthPx, durationSec);
  const tol = sliderMinTolerancePx(fitAll);
  const timelineW = computeTimelineWidthPx(durationSec, currentPxPerSec);
  const fillGapPx = viewportWidthPx - timelineW;
  const fillGapThreshold = Math.max(
    FIT_ALL_FILL_GAP_MIN_PX,
    viewportWidthPx * FIT_ALL_FILL_GAP_RATIO,
  );

  if (options?.layoutIntent === "fit-all") {
    if (!isFitAllTimelineFilledInViewport(viewportWidthPx, durationSec, currentPxPerSec)) {
      return fitAll;
    }
    return null;
  }

  if (
    options?.staleFitAllOnViewportGrow &&
    fillGapPx > fillGapThreshold &&
    wasFitAllPxPerSecForTimelineWidth({
      timelineWidthPx: timelineW,
      durationSec,
      pxPerSec: currentPxPerSec,
    })
  ) {
    return fitAll;
  }

  const nearFitAll =
    currentPxPerSec >= fitAll - tol &&
    Math.abs(currentPxPerSec - fitAll) <= Math.max(tol, fitAll * 0.05);
  if (!nearFitAll) {
    return null;
  }
  if (fillGapPx > fillGapThreshold) {
    return fitAll;
  }
  if (
    !isTimelineFitInViewport(viewportWidthPx, durationSec, currentPxPerSec) &&
    currentPxPerSec <= fitAll * 1.02
  ) {
    return fitAll;
  }
  return null;
}

/** 当前横向缩放「视图模式」（由 px/s + 视口 + 时长 + 选中语段派生，非持久偏好）。 */
export type WaveformZoomViewMode = "fit-selection" | "default" | "custom";

export type WaveformZoomBarUiInput = {
  pxPerSec: number;
  viewportWidthPx: number;
  durationSec: number;
  layoutIntent?: WaveformZoomLayoutIntent;
  /** 有选中语段时传入，用于判定 fit-selection 视图。 */
  selectedStartSec?: number;
  selectedEndSec?: number;
  sliderRange?: WaveformZoomSliderRange;
};

export type WaveformZoomBarUiState = {
  viewMode: WaveformZoomViewMode;
  atDefaultZoom: boolean;
  atMinZoom: boolean;
  atMaxZoom: boolean;
  atFitSelectionZoom: boolean;
  /** px/s 低于当前文件手动下限（如语段 fit 到极长句）。 */
  belowManualSliderRange: boolean;
  atFitAllZoom: boolean;
  zoomPercentLabel: number;
};

function computeAtFitSelectionZoom(
  pxPerSec: number,
  viewportWidthPx: number,
  selectedStartSec?: number,
  selectedEndSec?: number,
): boolean {
  if (
    viewportWidthPx <= 0 ||
    selectedStartSec == null ||
    selectedEndSec == null ||
    !Number.isFinite(selectedStartSec) ||
    !Number.isFinite(selectedEndSec)
  ) {
    return false;
  }
  const fitSelPx = computeFitSelectionPxPerSec(viewportWidthPx, selectedStartSec, selectedEndSec);
  return Math.abs(pxPerSec - fitSelPx) < ZOOM_EPS;
}

function resolveEditingDefaultPxPerSec(input: WaveformZoomBarUiInput): number {
  if (input.viewportWidthPx > 0 && input.durationSec >= 0.5) {
    return resolveDefaultEditingPxPerSec(input.viewportWidthPx, input.durationSec);
  }
  return TIMELINE_PX_PER_SEC;
}

function isNearEditingDefaultPxPerSec(pxPerSec: number, defaultPx: number): boolean {
  const tol = Math.max(ZOOM_EPS, defaultPx * 0.01);
  return Math.abs(pxPerSec - defaultPx) <= tol;
}

export function isNearEditingDefaultForMedia(
  pxPerSec: number,
  viewportWidthPx: number,
  durationSec: number,
): boolean {
  return isNearEditingDefaultPxPerSec(
    pxPerSec,
    resolveEditingDefaultPxPerSec({ pxPerSec, viewportWidthPx, durationSec }),
  );
}

export function deriveWaveformZoomViewMode(input: WaveformZoomBarUiInput): WaveformZoomViewMode {
  const defaultPx = resolveEditingDefaultPxPerSec(input);
  if (isNearEditingDefaultPxPerSec(input.pxPerSec, defaultPx)) {
    return "default";
  }
  if (computeAtFitSelectionZoom(
    input.pxPerSec,
    input.viewportWidthPx,
    input.selectedStartSec,
    input.selectedEndSec,
  )) {
    return "fit-selection";
  }
  return "custom";
}

/** 缩放条：视图模式 + 离散按钮派生 UI（纯函数）。 */
export function computeWaveformZoomBarUiState(input: WaveformZoomBarUiInput | number): WaveformZoomBarUiState {
  const resolved: WaveformZoomBarUiInput =
    typeof input === "number"
      ? { pxPerSec: input, viewportWidthPx: 0, durationSec: 0 }
      : input;

  const {
    pxPerSec,
    viewportWidthPx,
    durationSec,
    layoutIntent,
    selectedStartSec,
    selectedEndSec,
    sliderRange,
  } = resolved;
  const atFitSelectionZoom = computeAtFitSelectionZoom(
    pxPerSec,
    viewportWidthPx,
    selectedStartSec,
    selectedEndSec,
  );
  const defaultPx = resolveEditingDefaultPxPerSec(resolved);
  const atDefaultZoom = isNearEditingDefaultPxPerSec(pxPerSec, defaultPx);
  const sliderMinPx =
    sliderRange?.minPxPerSec ??
    (viewportWidthPx > 0 && durationSec > 0
      ? computeFitAllPxPerSec(viewportWidthPx, durationSec)
      : pxPerSec);
  const belowManualSliderRange = isPxPerSecBelowSliderMin(pxPerSec, sliderMinPx);
  const atFitAllZoom =
    layoutIntent === "fit-all" ||
    (layoutIntent == null &&
      viewportWidthPx > 0 &&
      durationSec > 0 &&
      isFitAllTimelineFilledInViewport(viewportWidthPx, durationSec, pxPerSec));

  return {
    viewMode: deriveWaveformZoomViewMode(resolved),
    atDefaultZoom,
    atMinZoom: belowManualSliderRange
      ? false
      : Math.abs(pxPerSec - sliderMinPx) < ZOOM_EPS || atFitAllZoom,
    atMaxZoom: pxPerSec >= (sliderRange?.maxPxPerSec ?? PX_PER_SEC_MAX) - ZOOM_EPS,
    atFitSelectionZoom,
    belowManualSliderRange,
    atFitAllZoom,
    zoomPercentLabel: Math.round((pxPerSec / defaultPx) * 100),
  };
}
