/** 与波形 `minPxPerSec`、时间轨语段卡水平尺度共用 */
export const P1_TIMELINE_PX_PER_SEC = 56;

export const P1_PX_PER_SEC_MIN = 16;
export const P1_PX_PER_SEC_MAX = 400;

export function clampP1PxPerSec(x: number): number {
  if (!Number.isFinite(x)) return P1_TIMELINE_PX_PER_SEC;
  return Math.min(P1_PX_PER_SEC_MAX, Math.max(P1_PX_PER_SEC_MIN, x));
}
