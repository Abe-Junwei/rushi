/** Imperative seek already synced display playhead — skip duplicate WS `seeking` sync. */

export const IMPERATIVE_PLAYHEAD_SYNC_SUPPRESS_MS = 50;

export function imperativePlayheadSyncSuppressUntil(nowMs: number): number {
  return nowMs + IMPERATIVE_PLAYHEAD_SYNC_SUPPRESS_MS;
}

export function shouldSuppressSeekingPlayheadSync(
  nowMs: number,
  suppressUntilMs: number,
): boolean {
  return nowMs < suppressUntilMs;
}
