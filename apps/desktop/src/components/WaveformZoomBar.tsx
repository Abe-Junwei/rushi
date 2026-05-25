import { memo, useCallback, useMemo } from "react";
import { Crosshair, Maximize2 } from "lucide-react";
import {
  clampPxPerSec,
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
  TIMELINE_PX_PER_SEC,
} from "../utils/pxPerSec";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

export type WaveformZoomBarProps = {
  disabled: boolean;
  isReady: boolean;
  pxPerSec: number;
  hasSelectionSegment: boolean;
  onZoomToFitAll: () => void;
  onZoomToFitSelection: () => void;
  onZoomOneToOne: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPxPerSecChange: (pxPerSec: number) => void;
};

function pxPerSecToSliderPos(px: number): number {
  const c = clampPxPerSec(px);
  const lo = PX_PER_SEC_MIN;
  const hi = PX_PER_SEC_MAX;
  return Math.round((Math.log(c / lo) / Math.log(hi / lo)) * 1000);
}

function sliderPosToPxPerSec(pos: number): number {
  const lo = PX_PER_SEC_MIN;
  const hi = PX_PER_SEC_MAX;
  const t = Math.min(1000, Math.max(0, pos));
  return clampPxPerSec(lo * (hi / lo) ** (t / 1000));
}

/** 解语 TranscriptionLayoutSections / ZoomControls 同款：底部横向缩放条（布局与 icon-btn + 滑块 + 百分比）。 */
export const WaveformZoomBar = memo(function WaveformZoomBar({
  disabled,
  isReady,
  pxPerSec,
  hasSelectionSegment,
  onZoomToFitAll,
  onZoomToFitSelection,
  onZoomOneToOne,
  onZoomIn,
  onZoomOut,
  onPxPerSecChange,
}: WaveformZoomBarProps) {
  const off = disabled || !isReady;
  const sliderValue = useMemo(() => pxPerSecToSliderPos(pxPerSec), [pxPerSec]);
  const zoomPercentLabel = useMemo(
    () => Math.round((pxPerSec / TIMELINE_PX_PER_SEC) * 100),
    [pxPerSec],
  );

  const onSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const pos = Number(e.target.value);
      onPxPerSecChange(sliderPosToPxPerSec(pos));
    },
    [onPxPerSecChange],
  );

  return (
    <div className="waveform-zoom-toolbar" role="toolbar" aria-label="波形时间轴缩放">
      <div className="waveform-zoom-bar">
        <button
          type="button"
          className="icon-btn"
          disabled={off}
          title="适配整段时长到视口"
          aria-label="适配整段"
          onClick={onZoomToFitAll}
        >
          <Maximize2 className={`${LUCIDE_ICON_SIZE_MD} shrink-0 opacity-90`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={off || !hasSelectionSegment}
          title="将当前选中语段适配到视口"
          aria-label="适配选中语段"
          onClick={onZoomToFitSelection}
        >
          <Crosshair className={`${LUCIDE_ICON_SIZE_MD} shrink-0 opacity-90`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button type="button" className="icon-btn" disabled={off} title="默认横向比例（56 px/s）" aria-label="一比一" onClick={onZoomOneToOne}>
          <span className="icon-btn-label">1:1</span>
        </button>
        <span className="toolbar-sep" aria-hidden />
        <button type="button" className="icon-btn icon-btn-compact" disabled={off} title="缩小" aria-label="缩小" onClick={onZoomOut}>
          <span className="text-base leading-none">−</span>
        </button>
        <button type="button" className="icon-btn icon-btn-compact" disabled={off} title="放大" aria-label="放大" onClick={onZoomIn}>
          <span className="text-base leading-none">+</span>
        </button>
        <span className="toolbar-sep" aria-hidden />
        <input
          type="range"
          className="waveform-zoom-slider"
          min={0}
          max={1000}
          step={1}
          disabled={off}
          value={sliderValue}
          onChange={onSliderChange}
          title={`横向比例 ${zoomPercentLabel}%（相对默认）`}
          aria-label={`横向缩放滑块，当前 ${zoomPercentLabel}%`}
        />
        <span className="waveform-zoom-value" aria-live="polite">
          {zoomPercentLabel}%
        </span>
        <span className="waveform-zoom-px font-mono tabular-nums text-zen-stone/80" title="像素/秒">
          {Math.round(pxPerSec)} px/s
        </span>
      </div>
    </div>
  );
});
