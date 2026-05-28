/** 与波形 `minPxPerSec`、时间轨语段卡水平尺度共用 */
export const TIMELINE_PX_PER_SEC = 56;

/** 滑块 / 按钮手动缩放的下限 */
export const PX_PER_SEC_MIN = 16;
/** 「适配整段」可低于手动下限，以便长音频一屏显示 */
export const PX_PER_SEC_FIT_MIN = 0.05;
export const PX_PER_SEC_MAX = 400;

/** 语段 fit 时左右留白（与 `fitSelectionViewportWidthPx` 一致） */
export const VIEWPORT_FIT_HORIZONTAL_PADDING_PX = 24;

export function clampPxPerSec(x: number): number {
  if (!Number.isFinite(x)) return TIMELINE_PX_PER_SEC;
  return Math.min(PX_PER_SEC_MAX, Math.max(PX_PER_SEC_FIT_MIN, x));
}

/** 滑块与 +/- 按钮：不低于手动下限 */
export function clampPxPerSecForSlider(x: number): number {
  if (!Number.isFinite(x)) return TIMELINE_PX_PER_SEC;
  return Math.min(PX_PER_SEC_MAX, Math.max(PX_PER_SEC_MIN, x));
}

export function fitSelectionViewportWidthPx(viewportWidthPx: number): number {
  return Math.max(160, Math.max(1, viewportWidthPx) - VIEWPORT_FIT_HORIZONTAL_PADDING_PX);
}

/**
 * 将整段音频缩进视口所需的 px/s。
 * 与 `computeTimelineWidthPx` 的 320px 下限对齐，避免 fit 后时间轴仍宽于视口。
 */
export function computeFitAllPxPerSec(viewportWidthPx: number, durationSec: number): number {
  const w = Math.max(1, viewportWidthPx);
  const sec = Math.max(durationSec, 0.5);
  const timelineMinWidthPx = 320;
  const pxForViewport = w / sec;
  const pxForTimelineFloor = timelineMinWidthPx / sec;
  return clampPxPerSec(Math.max(pxForViewport, pxForTimelineFloor));
}

/** 将选中语段缩进视口可用宽度所需的 px/s。 */
export function computeFitSelectionPxPerSec(
  viewportWidthPx: number,
  startSec: number,
  endSec: number,
): number {
  const span = Math.max(endSec - startSec, 0.05);
  const vw = fitSelectionViewportWidthPx(viewportWidthPx);
  return clampPxPerSec(vw / span);
}

/** 使语段在视口中居中（或贴边钳制）的 tier scrollLeft。 */
export function computeSelectionFitScrollPx(input: {
  viewportWidthPx: number;
  timelineWidthPx: number;
  pxPerSec: number;
  startSec: number;
  endSec: number;
}): number {
  const vw = Math.max(1, input.viewportWidthPx);
  const maxSl = Math.max(0, input.timelineWidthPx - vw);
  const span = Math.max(input.endSec - input.startSec, 0.05);
  const segStartPx = input.startSec * input.pxPerSec;
  const segWidthPx = span * input.pxPerSec;
  const targetSl = segStartPx - (vw - segWidthPx) / 2;
  return Math.max(0, Math.min(maxSl, targetSl));
}

export type ViewportFitScrollIntent =
  | { kind: "all" }
  | { kind: "selection"; startSec: number; endSec: number };

export function computeViewportFitScrollPx(input: {
  intent: ViewportFitScrollIntent;
  viewportWidthPx: number;
  timelineWidthPx: number;
  pxPerSec: number;
}): number {
  if (input.intent.kind === "all") return 0;
  return computeSelectionFitScrollPx({
    viewportWidthPx: input.viewportWidthPx,
    timelineWidthPx: input.timelineWidthPx,
    pxPerSec: input.pxPerSec,
    startSec: input.intent.startSec,
    endSec: input.intent.endSec,
  });
}
