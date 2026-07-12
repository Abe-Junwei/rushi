/** 语段 scoped 播放：在 end 前该 epsilon 内视为到达语段尾。 */
const SEGMENT_PLAYBACK_END_EPSILON_SEC = 0.016;

export type ActiveSegmentPlaybackBound = {
  startSec: number;
  endSec: number;
  generation: number;
  /** seek 完成、播放头离开语段尾前不触发 stop。 */
  armed: boolean;
};

export function segmentPlaybackReachedEnd(
  currentSec: number,
  endSec: number,
  epsilonSec = SEGMENT_PLAYBACK_END_EPSILON_SEC,
): boolean {
  if (!Number.isFinite(currentSec) || !Number.isFinite(endSec)) return false;
  return currentSec >= endSec - epsilonSec;
}

export function isActiveSegmentPlaybackBound(
  bound: ActiveSegmentPlaybackBound | null,
  generation: number,
): bound is ActiveSegmentPlaybackBound {
  return bound != null && bound.generation === generation;
}

/** 语段尾停住后回段首重播时，armed 前忽略误触发。 */
export function armSegmentPlaybackSession(
  session: ActiveSegmentPlaybackBound,
  currentSec: number,
  epsilonSec = SEGMENT_PLAYBACK_END_EPSILON_SEC,
): boolean {
  if (session.armed) return true;
  const nearStart = currentSec <= session.startSec + epsilonSec;
  const beforeEnd = currentSec < session.endSec - 0.05;
  if (nearStart || beforeEnd) {
    session.armed = true;
    return true;
  }
  // Sparse frames: first sample after mid-segment resume can already be past end.
  // Treat clear overshoot as armed so enforce can stop (still ignore exact-end freeze).
  if (currentSec > session.endSec + epsilonSec) {
    session.armed = true;
    return true;
  }
  return false;
}
