import {
  computeFitAllPxPerSec,
  computeFitSelectionPxPerSec,
  isTimelineFitInViewport,
  PX_PER_SEC_MAX,
  TIMELINE_PX_PER_SEC,
  type WaveformZoomSliderRange,
} from "./pxPerSec";

const ZOOM_EPS = 0.001;

/** 当前横向缩放「视图模式」（由 px/s + 视口 + 时长 + 选中语段派生，非持久偏好）。 */
export type WaveformZoomViewMode = "fit-selection" | "default" | "custom";

export type WaveformZoomBarUiInput = {
  pxPerSec: number;
  viewportWidthPx: number;
  durationSec: number;
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
  /** px/s 低于当前文件滑块下限（如跟随语段 fit），滑块停在 0 档。 */
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

export function deriveWaveformZoomViewMode(input: WaveformZoomBarUiInput): WaveformZoomViewMode {
  if (Math.abs(input.pxPerSec - TIMELINE_PX_PER_SEC) < ZOOM_EPS) {
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

/** 缩放条：视图模式 + 按钮/滑块派生 UI（纯函数）。 */
export function computeWaveformZoomBarUiState(input: WaveformZoomBarUiInput | number): WaveformZoomBarUiState {
  const resolved: WaveformZoomBarUiInput =
    typeof input === "number"
      ? { pxPerSec: input, viewportWidthPx: 0, durationSec: 0 }
      : input;

  const { pxPerSec, viewportWidthPx, durationSec, selectedStartSec, selectedEndSec, sliderRange } =
    resolved;
  const atFitSelectionZoom = computeAtFitSelectionZoom(
    pxPerSec,
    viewportWidthPx,
    selectedStartSec,
    selectedEndSec,
  );
  const atDefaultZoom = Math.abs(pxPerSec - TIMELINE_PX_PER_SEC) < ZOOM_EPS;
  const sliderMinPx =
    sliderRange?.minPxPerSec ??
    (viewportWidthPx > 0 && durationSec > 0
      ? computeFitAllPxPerSec(viewportWidthPx, durationSec)
      : pxPerSec);
  const belowManualSliderRange = pxPerSec < sliderMinPx - ZOOM_EPS;
  const atFitAllZoom =
    viewportWidthPx > 0 &&
    durationSec > 0 &&
    isTimelineFitInViewport(viewportWidthPx, durationSec, pxPerSec);

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
    zoomPercentLabel: Math.round((pxPerSec / TIMELINE_PX_PER_SEC) * 100),
  };
}

/** 跟随语段偏好是否应显示为激活（与默认 100% 视图互斥高亮）。 */
export function computeCrosshairTogglePressed(
  autoFitSelectionToViewport: boolean,
  viewMode: WaveformZoomViewMode,
): boolean {
  return autoFitSelectionToViewport && viewMode !== "default";
}
