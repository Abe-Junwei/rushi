import { memo, useCallback, useMemo } from "react";
import { Focus, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import {
  FIT_SELECTION_VIEWPORT_RATIO,
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
  resolveWaveformZoomSliderRange,
  type WaveformZoomLayoutIntent,
} from "../utils/pxPerSec";
import { computeWaveformZoomBarUiState } from "../utils/waveformZoomBarState";
import {
  computeZoomInPxPerSec,
  computeZoomOutPxPerSec,
} from "../utils/waveformZoomSlider";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

function fitSelectionPercentLabel(): string {
  return `${Math.round(FIT_SELECTION_VIEWPORT_RATIO * 100)}%`;
}

function resolveFitSelectionTitle(hasSelection: boolean, active: boolean): string {
  if (!hasSelection) {
    return "请先在语段列表或波形上选中一条语段";
  }
  const pct = fitSelectionPercentLabel();
  if (active) {
    return `语段适配（已激活）：选中语段约占视口 ${pct} 宽，并已滚入可见区域`;
  }
  return `语段适配：将选中语段缩放到约占视口 ${pct} 宽，并滚入可见区域`;
}

function resolveFitAllTitle(active: boolean): string {
  if (active) {
    return "整段可见（已激活）：整段音频时间轴已贴满视口宽度";
  }
  return "整段可见：缩小至整段音频贴满视口宽度（本文件最宽可见）";
}

function resolveZoomOutTitle(atMinZoom: boolean): string {
  if (atMinZoom) {
    return "已为本文件最宽可见（整段贴满视口）";
  }
  return "缩小一级";
}

function resolveZoomInTitle(atMaxZoom: boolean): string {
  if (atMaxZoom) {
    return "已为本文件最大缩放";
  }
  return "放大一级";
}

function resolveResetTitle(active: boolean): string {
  if (active) {
    return "默认比例（已激活）：当前为本文件编辑默认缩放（标签约 100%）";
  }
  return "默认比例：恢复本文件编辑默认（几何中点；±5 步可达最宽/最大）";
}

export type WaveformZoomBarProps = {
  disabled: boolean;
  isReady: boolean;
  minimapEnabled?: boolean;
  onToggleMinimap?: () => void;
  pxPerSec: number;
  layoutIntent?: WaveformZoomLayoutIntent;
  viewportWidthPx: number;
  durationSec: number;
  selectedStartSec?: number;
  selectedEndSec?: number;
  onFitSelection: () => void;
  onFitAll: () => void;
  onResetDefaultZoom: () => void;
  onPxPerSecChange: (pxPerSec: number) => void;
  editorHint?: string;
};

function hasWaveformSegmentSelection(
  selectedStartSec?: number,
  selectedEndSec?: number,
): boolean {
  return (
    selectedStartSec != null &&
    selectedEndSec != null &&
    Number.isFinite(selectedStartSec) &&
    Number.isFinite(selectedEndSec)
  );
}

/** 改稿向离散缩放：适配语段 / 整段可见 / ± 步进 / 重置（全文件导航见全局波形条）。 */
export const WaveformZoomBar = memo(function WaveformZoomBar({
  disabled,
  isReady,
  minimapEnabled = false,
  onToggleMinimap,
  pxPerSec,
  layoutIntent,
  viewportWidthPx,
  durationSec,
  selectedStartSec,
  selectedEndSec,
  onFitSelection,
  onFitAll,
  onResetDefaultZoom,
  onPxPerSecChange,
  editorHint,
}: WaveformZoomBarProps) {
  const off = disabled || !isReady;
  const hasSelection = hasWaveformSegmentSelection(selectedStartSec, selectedEndSec);

  const sliderRange = useMemo(() => {
    if (viewportWidthPx <= 0 || durationSec < 0.5) {
      return { minPxPerSec: PX_PER_SEC_MIN, maxPxPerSec: PX_PER_SEC_MAX };
    }
    return resolveWaveformZoomSliderRange(viewportWidthPx, durationSec);
  }, [durationSec, viewportWidthPx]);

  const { atMinZoom, atMaxZoom, atFitSelectionZoom, atFitAllZoom, atDefaultZoom } = useMemo(
    () =>
      computeWaveformZoomBarUiState({
        pxPerSec,
        layoutIntent,
        viewportWidthPx,
        durationSec,
        selectedStartSec,
        selectedEndSec,
        sliderRange,
      }),
    [durationSec, layoutIntent, pxPerSec, selectedEndSec, selectedStartSec, sliderRange, viewportWidthPx],
  );

  const handleZoomIn = useCallback(() => {
    onPxPerSecChange(computeZoomInPxPerSec(pxPerSec, sliderRange));
  }, [onPxPerSecChange, pxPerSec, sliderRange]);

  const handleZoomOut = useCallback(() => {
    onPxPerSecChange(computeZoomOutPxPerSec(pxPerSec, sliderRange));
  }, [onPxPerSecChange, pxPerSec, sliderRange]);

  const fitSelectionTitle = resolveFitSelectionTitle(hasSelection, atFitSelectionZoom);
  const fitAllTitle = resolveFitAllTitle(atFitAllZoom);
  const zoomOutTitle = resolveZoomOutTitle(atMinZoom);
  const zoomInTitle = resolveZoomInTitle(atMaxZoom);
  const resetTitle = resolveResetTitle(atDefaultZoom);

  return (
    <div className="waveform-zoom-toolbar" role="toolbar" aria-label="波形时间轴缩放">
      <div className="waveform-zoom-bar">
        {onToggleMinimap ? (
          <>
            <label className="waveform-minimap-toggle">
              <span className="waveform-minimap-toggle-label">波形总览</span>
              <button
                type="button"
                role="switch"
                className="waveform-minimap-switch"
                disabled={off}
                aria-checked={minimapEnabled}
                onClick={onToggleMinimap}
              >
                <span className="waveform-minimap-switch-thumb" aria-hidden />
              </button>
            </label>
            <span className="toolbar-sep" aria-hidden />
          </>
        ) : null}
        <button
          type="button"
          className={`icon-btn${atFitSelectionZoom ? " icon-btn-active" : ""}`}
          disabled={off || !hasSelection}
          title={fitSelectionTitle}
          aria-label="适配语段"
          aria-pressed={atFitSelectionZoom}
          onClick={onFitSelection}
        >
          <Focus className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button
          type="button"
          className={`icon-btn${atFitAllZoom ? " icon-btn-active" : ""}`}
          disabled={off}
          title={fitAllTitle}
          aria-label="整段可见"
          aria-pressed={atFitAllZoom}
          onClick={onFitAll}
        >
          <Maximize2 className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <span className="toolbar-sep" aria-hidden />
        <button
          type="button"
          className="icon-btn"
          disabled={off || atMinZoom}
          title={zoomOutTitle}
          aria-label="缩小"
          onClick={handleZoomOut}
        >
          <ZoomOut className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={off || atMaxZoom}
          title={zoomInTitle}
          aria-label="放大"
          onClick={handleZoomIn}
        >
          <ZoomIn className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button
          type="button"
          className={`icon-btn icon-btn-text${atDefaultZoom ? " icon-btn-active" : ""}`}
          disabled={off}
          title={resetTitle}
          aria-label="重置缩放"
          aria-pressed={atDefaultZoom}
          onClick={onResetDefaultZoom}
        >
          <span className="icon-btn-label">重置</span>
        </button>
      </div>
      {editorHint ? (
        <p className="m-0 min-w-0 flex-1 truncate text-right text-[11px] text-notion-text-muted" aria-live="polite">
          {editorHint}
        </p>
      ) : null}
    </div>
  );
});
