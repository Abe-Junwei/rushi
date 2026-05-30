import { memo, useCallback, useMemo } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import {
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

export type WaveformZoomBarProps = {
  disabled: boolean;
  isReady: boolean;
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

  return (
    <div className="waveform-zoom-toolbar" role="toolbar" aria-label="波形时间轴缩放">
      <div className="waveform-zoom-bar">
        <button
          type="button"
          className={`icon-btn icon-btn-text${atFitSelectionZoom ? " icon-btn-active" : ""}`}
          disabled={off || !hasSelection}
          title={hasSelection ? "将选中语段缩进当前视口" : "请先选中语段"}
          aria-label="适配语段"
          aria-pressed={atFitSelectionZoom}
          onClick={onFitSelection}
        >
          <span className="icon-btn-label">适配语段</span>
        </button>
        <button
          type="button"
          className={`icon-btn icon-btn-text${atFitAllZoom ? " icon-btn-active" : ""}`}
          disabled={off}
          title="整段音频缩进当前视口"
          aria-label="整段可见"
          aria-pressed={atFitAllZoom}
          onClick={onFitAll}
        >
          <span className="icon-btn-label">整段可见</span>
        </button>
        <span className="toolbar-sep" aria-hidden />
        <button
          type="button"
          className="icon-btn"
          disabled={off || atMinZoom}
          title={atMinZoom ? "已整段可见" : "缩小"}
          aria-label="缩小"
          onClick={handleZoomOut}
        >
          <ZoomOut className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={off || atMaxZoom}
          title={atMaxZoom ? "已达到最大缩放" : "放大"}
          aria-label="放大"
          onClick={handleZoomIn}
        >
          <ZoomIn className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button
          type="button"
          className={`icon-btn icon-btn-text${atDefaultZoom ? " icon-btn-active" : ""}`}
          disabled={off}
          title="重置为默认编辑比例"
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
