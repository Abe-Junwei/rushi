export type WaveformViewportPeaksWindow = {
  leftPx: number;
  widthPx: number;
  bufferPx: number;
};

export type DrawWaveformViewportPeaksInput = {
  ctx: CanvasRenderingContext2D;
  peaks: Float32Array | number[];
  durationSec: number;
  timelineWidthPx: number;
  windowLeftPx: number;
  windowWidthPx: number;
  heightPx: number;
  waveColor: string;
  progressColor?: string;
  playheadSec?: number;
};

export const VIEWPORT_PEAKS_CANVAS_BUFFER_VIEWPORTS = 1.5;

/** Cap tint style writes — deep zoom moves many px/frame; per-frame width writes kill fps. */
export const VIEWPORT_PEAKS_PLAYED_TINT_MIN_INTERVAL_MS = 50;

export function computeViewportPlayedTintWidthPx(input: {
  playheadSec: number;
  durationSec: number;
  timelineWidthPx: number;
  windowLeftPx: number;
  windowWidthPx: number;
}): number {
  if (input.durationSec <= 0 || input.timelineWidthPx <= 0 || input.windowWidthPx <= 0) {
    return 0;
  }
  const t = Math.max(0, Math.min(input.durationSec, input.playheadSec));
  const playheadX = (t / input.durationSec) * input.timelineWidthPx;
  return Math.max(0, Math.min(input.windowWidthPx, Math.round(playheadX - input.windowLeftPx)));
}

export function computeWaveformViewportPeaksWindow(input: {
  scrollLeftPx: number;
  viewportWidthPx: number;
  timelineWidthPx: number;
}): WaveformViewportPeaksWindow {
  const timelineWidth = Math.max(1, input.timelineWidthPx);
  const viewportWidth = Math.max(1, input.viewportWidthPx);
  const bufferPx = viewportWidth * VIEWPORT_PEAKS_CANVAS_BUFFER_VIEWPORTS;
  const widthPx = Math.max(1, Math.floor(Math.min(timelineWidth, viewportWidth + bufferPx * 2)));
  const leftPx = Math.max(
    0,
    Math.min(Math.max(0, timelineWidth - widthPx), input.scrollLeftPx - bufferPx),
  );
  return { leftPx, widthPx, bufferPx };
}

function drawPeakRange(input: {
  ctx: CanvasRenderingContext2D;
  peaks: Float32Array | number[];
  columns: number;
  timelineWidthPx: number;
  windowLeftPx: number;
  startX: number;
  endX: number;
  heightPx: number;
  color: string;
}): void {
  const {
    ctx,
    peaks,
    columns,
    timelineWidthPx,
    windowLeftPx,
    startX,
    endX,
    heightPx,
    color,
  } = input;
  const midY = heightPx / 2;
  const ampScale = Math.max(1, heightPx * 0.46);
  const x0 = Math.max(0, Math.floor(startX));
  const x1 = Math.max(x0, Math.ceil(endX));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x0; x < x1; x += 1) {
    const timelineX = Math.max(0, Math.min(timelineWidthPx, windowLeftPx + x));
    const col = Math.min(columns - 1, Math.max(0, Math.floor((timelineX / timelineWidthPx) * columns)));
    const min = Number(peaks[col * 2] ?? 0);
    const max = Number(peaks[col * 2 + 1] ?? 0);
    const y0 = midY + Math.min(1, Math.max(-1, min)) * ampScale;
    const y1 = midY + Math.min(1, Math.max(-1, max)) * ampScale;
    ctx.moveTo(x + 0.5, y0);
    ctx.lineTo(x + 0.5, y1);
  }
  ctx.stroke();
}

export function drawWaveformViewportPeaks({
  ctx,
  peaks,
  durationSec,
  timelineWidthPx,
  windowLeftPx,
  windowWidthPx,
  heightPx,
  waveColor,
  progressColor,
  playheadSec,
}: DrawWaveformViewportPeaksInput): void {
  const width = Math.max(1, Math.floor(windowWidthPx));
  const height = Math.max(1, Math.floor(heightPx));
  ctx.clearRect(0, 0, width, height);
  if (durationSec <= 0 || timelineWidthPx <= 0 || peaks.length < 2) return;

  const columns = Math.max(1, Math.floor(peaks.length / 2));
  drawPeakRange({
    ctx,
    peaks,
    columns,
    timelineWidthPx,
    windowLeftPx,
    startX: 0,
    endX: width,
    heightPx: height,
    color: waveColor,
  });

  if (!progressColor || playheadSec == null) return;
  const playheadX = (Math.max(0, Math.min(durationSec, playheadSec)) / durationSec) * timelineWidthPx;
  const playedEndX = Math.max(0, Math.min(width, playheadX - windowLeftPx));
  if (playedEndX <= 0) return;
  drawPeakRange({
    ctx,
    peaks,
    columns,
    timelineWidthPx,
    windowLeftPx,
    startX: 0,
    endX: playedEndX,
    heightPx: height,
    color: progressColor,
  });
}
