/** Parse server-reported download percent from ``GET /v1/models/prepare-status``. */
export function parsePrepareProgressPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return clampPrepareProgressPercent(value, "running");
}

/** Clamp UI percent to 0–100 (running jobs cap at 99 until sidecar marks done). */
export function clampPrepareProgressPercent(value: number, phase?: string): number {
  const rounded = Math.round(value);
  if (phase === "done") return Math.min(100, Math.max(0, rounded));
  if (phase === "running") return Math.min(99, Math.max(0, rounded));
  return Math.min(100, Math.max(0, rounded));
}

/**
 * Keep progress monotonic during an active download (Steam/Firefox-style bar).
 * Sidecar byte totals can shrink when a new file registers; UI must not jump backward.
 */
export function monotonicPrepareProgress(previous: number, next: number): number {
  if (!Number.isFinite(previous) || previous < 0) return next;
  return Math.max(previous, next);
}

/**
 * Fallback when the sidecar has not reported byte progress yet.
 * Stage bands mirror Python aggregate budgets (recognizer → vad → punc → done).
 */
export function computePrepareModelProgress(message: string, stageElapsedMs: number): number {
  const t = Math.max(0, stageElapsedMs);
  switch (message) {
    case "downloading_punc":
      return Math.min(98, 88 + Math.floor((Math.min(t, 180_000) / 180_000) * 10));
    case "downloading_vad":
      return Math.min(87, 72 + Math.floor((Math.min(t, 120_000) / 120_000) * 15));
    case "downloading_recognizer":
      return Math.min(70, 2 + Math.floor((Math.min(t, 900_000) / 900_000) * 68));
    case "starting":
      return Math.min(8, 1 + Math.floor((Math.min(t, 30_000) / 30_000) * 7));
    case "cancelling":
      return 0;
    default:
      return Math.min(5, Math.floor(t / 3000));
  }
}
