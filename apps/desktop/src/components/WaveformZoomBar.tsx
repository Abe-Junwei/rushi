import { memo, useCallback, useMemo } from "react";
import { useWorkbenchToolbarCompact } from "../hooks/useWorkbenchToolbarCompact";
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
import {
  hasWaveformSegmentSelection,
  resolveFitAllTitle,
  resolveFitSelectionTitle,
  resolveResetTitle,
  resolveZoomInTitle,
  resolveZoomOutTitle,
} from "../utils/waveformZoomBarTitles";
import { WaveformZoomBarControls } from "./WaveformZoomBarControls";

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
  /** 测试/Story 覆盖：`true` 强制紧凑菜单，`false` 强制展开。 */
  compactLayout?: boolean;
};

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
  compactLayout,
}: WaveformZoomBarProps) {
  const compactFromMedia = useWorkbenchToolbarCompact();
  const compact = compactLayout ?? compactFromMedia;

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

  const zoomMenuEngaged =
    minimapEnabled || atFitSelectionZoom || atFitAllZoom || atDefaultZoom;

  return (
    <div className="waveform-zoom-toolbar" role="toolbar" aria-label="波形时间轴缩放">
      <div className={`waveform-zoom-bar${compact ? " waveform-zoom-bar-compact" : ""}`}>
        <WaveformZoomBarControls
          compact={compact}
          off={off}
          hasSelection={hasSelection}
          minimapEnabled={minimapEnabled}
          onToggleMinimap={onToggleMinimap}
          atFitSelectionZoom={atFitSelectionZoom}
          atFitAllZoom={atFitAllZoom}
          atDefaultZoom={atDefaultZoom}
          atMinZoom={atMinZoom}
          atMaxZoom={atMaxZoom}
          fitSelectionTitle={fitSelectionTitle}
          fitAllTitle={fitAllTitle}
          zoomOutTitle={zoomOutTitle}
          zoomInTitle={zoomInTitle}
          resetTitle={resetTitle}
          zoomMenuEngaged={zoomMenuEngaged}
          onFitSelection={onFitSelection}
          onFitAll={onFitAll}
          onResetDefaultZoom={onResetDefaultZoom}
          onZoomOut={handleZoomOut}
          onZoomIn={handleZoomIn}
        />
      </div>
    </div>
  );
});
