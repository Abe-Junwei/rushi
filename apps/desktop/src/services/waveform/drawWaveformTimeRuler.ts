import {
  buildVisibleRulerTicks,
  computeEmbeddedRulerLabelStride,
} from "./waveformRulerTicks";
import type { WaveformRulerCanvasPalette } from "../../utils/waveformRulerCanvasColors";
import {
  effectiveTimelinePxPerSec,
  paddedVisibleTimeWindow,
  timeToTimelinePx,
} from "../../utils/waveformProjection";

export const WAVEFORM_EMBEDDED_RULER_HEIGHT_PX = 22;
const VIEWPORT_TICK_MARGIN_PX = 8;
const LABEL_VIEWPORT_MARGIN_PX = 4;
const RULER_FONT =
  '500 11px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

export type DrawWaveformTimeRulerInput = {
  ctx: CanvasRenderingContext2D;
  scrollLeftPx: number;
  viewportWidthPx: number;
  timelineWidthPx: number;
  durationSec: number;
  formatMediaTime: (sec: number) => string;
  interactionActive: boolean;
  palette: WaveformRulerCanvasPalette;
  rulerHeightPx?: number;
};

function timelinePxToViewportPx(timelinePx: number, scrollLeftPx: number): number {
  return timelinePx - Math.max(0, scrollLeftPx);
}

function isVisibleViewportPx(displayPx: number, viewportWidthPx: number, marginPx: number): boolean {
  return displayPx >= -marginPx && displayPx <= viewportWidthPx + marginPx;
}

export function drawWaveformTimeRuler(input: DrawWaveformTimeRulerInput): void {
  const {
    ctx,
    scrollLeftPx,
    viewportWidthPx,
    timelineWidthPx,
    durationSec,
    formatMediaTime,
    interactionActive,
    palette,
    rulerHeightPx = WAVEFORM_EMBEDDED_RULER_HEIGHT_PX,
  } = input;

  const widthPx = Math.max(1, viewportWidthPx);
  const heightPx = Math.max(1, rulerHeightPx);
  ctx.clearRect(0, 0, widthPx, heightPx);

  if (durationSec <= 0 || timelineWidthPx <= 0) return;

  const visibleView = paddedVisibleTimeWindow({
    scrollLeftPx,
    viewportWidthPx: widthPx,
    timelineWidthPx,
    durationSec,
  });
  const tickPxPerSec = effectiveTimelinePxPerSec(timelineWidthPx, durationSec);
  const { ticks, majorStep } = buildVisibleRulerTicks({
    durationSec,
    tickPxPerSec,
    visibleStart: visibleView.start,
    visibleEnd: visibleView.end,
  });
  const majorTicks = ticks.filter((tick) => tick.major);
  const labelStride = computeEmbeddedRulerLabelStride(true, majorStep, tickPxPerSec);

  const minorColor = palette.minorTick;
  const majorColor = interactionActive ? palette.labelActive : palette.majorTick;
  const labelColor = palette.label;

  ctx.lineWidth = 1;
  ctx.textBaseline = "alphabetic";
  ctx.font = RULER_FONT;

  for (const { t, major } of ticks) {
    const viewportPx = timelinePxToViewportPx(
      timeToTimelinePx(t, timelineWidthPx, durationSec),
      scrollLeftPx,
    );
    if (!isVisibleViewportPx(viewportPx, widthPx, VIEWPORT_TICK_MARGIN_PX)) continue;

    const tickLen = major ? 7 : 3;
    const yBottom = heightPx;
    const yTop = yBottom - tickLen;

    ctx.strokeStyle = major ? majorColor : minorColor;
    ctx.beginPath();
    ctx.moveTo(viewportPx + 0.5, yTop);
    ctx.lineTo(viewportPx + 0.5, yBottom);
    ctx.stroke();
  }

  majorTicks.forEach((tick, index) => {
    if (index % labelStride !== 0) return;
    const viewportPx = timelinePxToViewportPx(
      timeToTimelinePx(tick.t, timelineWidthPx, durationSec),
      scrollLeftPx,
    );
    if (!isVisibleViewportPx(viewportPx, widthPx, LABEL_VIEWPORT_MARGIN_PX)) return;

    ctx.fillStyle = labelColor;
    ctx.font = RULER_FONT;
    ctx.fillText(formatMediaTime(tick.t), viewportPx + 2, heightPx - 1);
  });
}
