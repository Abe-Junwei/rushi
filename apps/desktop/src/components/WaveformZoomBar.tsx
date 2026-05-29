import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import {
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
  resolveWaveformZoomSliderRange,
} from "../utils/pxPerSec";
import { computeWaveformZoomBarUiState } from "../utils/waveformZoomBarState";
import {
  computeZoomInPxPerSec,
  computeZoomOutPxPerSec,
  pxPerSecToSliderPos,
  sliderPosToPxPerSec,
} from "../utils/waveformZoomSlider";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

export type WaveformZoomBarProps = {
  disabled: boolean;
  isReady: boolean;
  pxPerSec: number;
  viewportWidthPx: number;
  durationSec: number;
  selectedStartSec?: number;
  selectedEndSec?: number;
  onResetDefaultZoom: () => void;
  onPxPerSecChange: (pxPerSec: number) => void;
  onZoomInteractionStart?: () => void;
  onZoomInteractionEnd?: () => void;
  editorHint?: string;
};

/** 底部横向缩放滑块（全文件导航见底部全局波形条）。 */
export const WaveformZoomBar = memo(function WaveformZoomBar({
  disabled,
  isReady,
  pxPerSec,
  viewportWidthPx,
  durationSec,
  selectedStartSec,
  selectedEndSec,
  onResetDefaultZoom,
  onPxPerSecChange,
  onZoomInteractionStart,
  onZoomInteractionEnd,
  editorHint,
}: WaveformZoomBarProps) {
  const off = disabled || !isReady;

  const sliderRange = useMemo(() => {
    if (viewportWidthPx <= 0 || durationSec < 0.5) {
      return { minPxPerSec: PX_PER_SEC_MIN, maxPxPerSec: PX_PER_SEC_MAX };
    }
    return resolveWaveformZoomSliderRange(viewportWidthPx, durationSec);
  }, [durationSec, viewportWidthPx]);

  const { atMinZoom, atMaxZoom, belowManualSliderRange, atFitAllZoom, zoomPercentLabel } = useMemo(
    () =>
      computeWaveformZoomBarUiState({
        pxPerSec,
        viewportWidthPx,
        durationSec,
        selectedStartSec,
        selectedEndSec,
        sliderRange,
      }),
    [durationSec, pxPerSec, selectedEndSec, selectedStartSec, sliderRange, viewportWidthPx],
  );

  const sliderValue = useMemo(
    () => pxPerSecToSliderPos(pxPerSec, sliderRange),
    [pxPerSec, sliderRange],
  );

  const handleZoomIn = useCallback(() => {
    onPxPerSecChange(computeZoomInPxPerSec(pxPerSec, sliderRange));
  }, [onPxPerSecChange, pxPerSec, sliderRange]);

  const handleZoomOut = useCallback(() => {
    onPxPerSecChange(computeZoomOutPxPerSec(pxPerSec, sliderRange));
  }, [onPxPerSecChange, pxPerSec, sliderRange]);

  const sliderRafRef = useRef(0);
  const sliderInteractingRef = useRef(false);
  const pendingSliderPosRef = useRef<number | null>(null);

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
    onPxPerSecChange(sliderPosToPxPerSec(pos, sliderRange));
  }, [onPxPerSecChange, sliderRange]);

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
          disabled={off || atMinZoom}
          title={atMinZoom ? "已缩至整段可见（滑块最小档）" : "缩小"}
          aria-label="缩小"
          onClick={handleZoomOut}
        >
          <ZoomOut className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={off || atMaxZoom}
          title={atMaxZoom ? "已达到最大手动缩放" : "放大"}
          aria-label="放大"
          onClick={handleZoomIn}
        >
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
          title={
            belowManualSliderRange
              ? `当前缩放 ${zoomPercentLabel}% 低于本文件滑块下限；点「重置」或 +/- 调整`
              : atFitAllZoom
                ? `整段可见（约 ${zoomPercentLabel}% 相对默认 56 px/s）`
                : `横向比例 ${zoomPercentLabel}%（相对默认 56 px/s）`
          }
          aria-valuetext={
            belowManualSliderRange
              ? `${zoomPercentLabel}%（低于手动滑块下限）`
              : `${zoomPercentLabel}%`
          }
          aria-label={`横向缩放滑块，当前 ${zoomPercentLabel}%`}
        />
        <span className="waveform-zoom-value" aria-live="polite">
          {zoomPercentLabel}%
        </span>
        <span className="waveform-zoom-px font-mono tabular-nums text-zen-stone/80" title="像素/秒">
          {Math.round(pxPerSec)} px/s
        </span>
        <button
          type="button"
          className="icon-btn icon-btn-text"
          disabled={off}
          title="重置为默认横向比例（56 px/s，100%）"
          aria-label="重置缩放"
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
