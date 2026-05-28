import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Crosshair, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import {
  clampPxPerSecForSlider,
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
  TIMELINE_PX_PER_SEC,
} from "../utils/pxPerSec";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

export type WaveformZoomBarProps = {
  disabled: boolean;
  isReady: boolean;
  pxPerSec: number;
  hasSelectionSegment: boolean;
  onZoomToFitAll: () => void;
  onZoomToFitSelection: () => void;
  onResetDefaultZoom: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPxPerSecChange: (pxPerSec: number) => void;
  onZoomInteractionStart?: () => void;
  onZoomInteractionEnd?: () => void;
};

function pxPerSecToSliderPos(px: number): number {
  const c = clampPxPerSecForSlider(px);
  const lo = PX_PER_SEC_MIN;
  const hi = PX_PER_SEC_MAX;
  return Math.round((Math.log(c / lo) / Math.log(hi / lo)) * 1000);
}

function sliderPosToPxPerSec(pos: number): number {
  const lo = PX_PER_SEC_MIN;
  const hi = PX_PER_SEC_MAX;
  const t = Math.min(1000, Math.max(0, pos));
  return clampPxPerSecForSlider(lo * (hi / lo) ** (t / 1000));
}

/** 解语 TranscriptionLayoutSections / ZoomControls 同款：底部横向缩放条（布局与 icon-btn + 滑块 + 百分比）。 */
export const WaveformZoomBar = memo(function WaveformZoomBar({
  disabled,
  isReady,
  pxPerSec,
  hasSelectionSegment,
  onZoomToFitAll,
  onZoomToFitSelection,
  onResetDefaultZoom,
  onZoomIn,
  onZoomOut,
  onPxPerSecChange,
  onZoomInteractionStart,
  onZoomInteractionEnd,
}: WaveformZoomBarProps) {
  const off = disabled || !isReady;
  const atDefaultZoom = Math.abs(pxPerSec - TIMELINE_PX_PER_SEC) < 0.001;
  const sliderRafRef = useRef(0);
  const sliderInteractingRef = useRef(false);
  const pendingSliderPosRef = useRef<number | null>(null);
  const sliderValue = useMemo(() => pxPerSecToSliderPos(pxPerSec), [pxPerSec]);
  const zoomPercentLabel = useMemo(
    () => Math.round((pxPerSec / TIMELINE_PX_PER_SEC) * 100),
    [pxPerSec],
  );

  const beginSliderInteraction = useCallback(() => {
    if (sliderInteractingRef.current) return;
    sliderInteractingRef.current = true;
    onZoomInteractionStart?.();
  }, [onZoomInteractionStart]);

  const flushPendingSliderChange = useCallback(() => {
    const pos = pendingSliderPosRef.current;
    if (pos == null) return;
    pendingSliderPosRef.current = null;
    if (sliderRafRef.current) {
      cancelAnimationFrame(sliderRafRef.current);
      sliderRafRef.current = 0;
    }
    onPxPerSecChange(sliderPosToPxPerSec(pos));
  }, [onPxPerSecChange]);

  const endSliderInteraction = useCallback(() => {
    flushPendingSliderChange();
    if (!sliderInteractingRef.current) return;
    sliderInteractingRef.current = false;
    onZoomInteractionEnd?.();
  }, [flushPendingSliderChange, onZoomInteractionEnd]);

  const onSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      beginSliderInteraction();
      pendingSliderPosRef.current = Number(e.target.value);
      if (sliderRafRef.current) return;
      sliderRafRef.current = requestAnimationFrame(() => {
        sliderRafRef.current = 0;
        flushPendingSliderChange();
      });
    },
    [beginSliderInteraction, flushPendingSliderChange],
  );

  useEffect(
    () => () => {
      if (sliderRafRef.current) cancelAnimationFrame(sliderRafRef.current);
    },
    [],
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
          <Maximize2 className={`${LUCIDE_ICON_SIZE_LG} shrink-0 opacity-90`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={off || !hasSelectionSegment}
          title="将当前选中语段适配到视口"
          aria-label="适配选中语段"
          onClick={onZoomToFitSelection}
        >
          <Crosshair className={`${LUCIDE_ICON_SIZE_LG} shrink-0 opacity-90`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={off || atDefaultZoom}
          title={atDefaultZoom ? "已是默认横向比例（56 px/s，100%）" : "恢复默认横向比例（56 px/s，100%）"}
          aria-label="恢复默认横向缩放"
          aria-pressed={atDefaultZoom}
          onClick={onResetDefaultZoom}
        >
          <span className="icon-btn-label">默认</span>
        </button>
        <span className="toolbar-sep" aria-hidden />
        <button type="button" className="icon-btn" disabled={off} title="缩小" aria-label="缩小" onClick={onZoomOut}>
          <ZoomOut className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button type="button" className="icon-btn" disabled={off} title="放大" aria-label="放大" onClick={onZoomIn}>
          <ZoomIn className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
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
          onPointerDown={beginSliderInteraction}
          onPointerUp={endSliderInteraction}
          onPointerCancel={endSliderInteraction}
          onKeyDown={beginSliderInteraction}
          onKeyUp={endSliderInteraction}
          onBlur={endSliderInteraction}
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
