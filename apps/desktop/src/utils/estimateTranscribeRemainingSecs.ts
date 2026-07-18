/**
 * Warm-up EMA remaining estimate for multi-window local transcribe.
 * Must not use timeout budgets. Returns null until ≥1 window completed (or p≥threshold).
 */
export function estimateTranscribeRemainingSecs(input: {
  windowIndex: number;
  windowCount: number;
  elapsedSec: number;
  /** Progress fraction threshold before showing ETA when fewer than 1 window completed. */
  minFraction?: number;
}): number | null {
  const { windowIndex, windowCount, elapsedSec } = input;
  const minFraction = input.minFraction ?? 0.05;
  if (
    !Number.isFinite(windowIndex) ||
    !Number.isFinite(windowCount) ||
    !Number.isFinite(elapsedSec) ||
    windowCount <= 1 ||
    windowIndex <= 0 ||
    elapsedSec <= 0
  ) {
    return null;
  }
  const p = Math.min(1, Math.max(0, windowIndex / windowCount));
  const windowsDone = Math.max(0, windowIndex - 1);
  if (windowsDone < 1 && p < minFraction) return null;
  if (p <= 0 || p >= 1) return null;
  // remaining ≈ (1−p)/p × elapsed (WhisperKit-style after warm-up)
  return ((1 - p) / p) * elapsedSec;
}

/** Coarse “约剩余 X–Y 分钟” band; null when estimate unavailable. */
export function formatApproxRemainingMinutes(remainingSec: number | null | undefined): string | null {
  if (remainingSec == null || !Number.isFinite(remainingSec) || remainingSec <= 0) return null;
  const minutes = remainingSec / 60;
  if (minutes < 1) return "约剩余不到 1 分钟";
  const low = Math.max(1, Math.floor(minutes * 0.85));
  const high = Math.max(low + 1, Math.ceil(minutes * 1.25));
  if (low === high) return `约剩余 ${low} 分钟`;
  return `约剩余 ${low}–${high} 分钟`;
}

export function transcribeDeterminateFraction(
  windowIndex: number,
  windowCount: number,
): number | null {
  if (!Number.isFinite(windowIndex) || !Number.isFinite(windowCount) || windowCount <= 1) {
    return null;
  }
  if (windowIndex <= 0) return 0;
  return Math.min(1, Math.max(0, windowIndex / windowCount));
}
