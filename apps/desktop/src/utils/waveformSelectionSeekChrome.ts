/** Selection seek: reveal + flushTierScrollFrame already repainted tier chrome. */

export const SELECTION_SEEK_CHROME_SUPPRESS_MS = 1200;

export function selectionSeekChromeSuppressUntil(nowMs: number): number {
  return nowMs + SELECTION_SEEK_CHROME_SUPPRESS_MS;
}

export function shouldCoalesceSelectionSeekChrome(
  nowMs: number,
  suppressUntilMs: number,
): boolean {
  return nowMs < suppressUntilMs;
}
