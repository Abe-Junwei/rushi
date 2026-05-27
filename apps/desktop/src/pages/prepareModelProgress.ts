/** Parse server-reported download percent from ``GET /v1/models/prepare-status``. */
export function parsePrepareProgressPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(99, Math.max(0, Math.round(value)));
}

/** Fallback when the sidecar has not reported byte progress yet. */
export function computePrepareModelProgress(message: string, stageElapsedMs: number): number {
  const t = Math.max(0, stageElapsedMs);
  switch (message) {
    case "downloading_vad":
      return Math.min(94, 72 + Math.floor((Math.min(t, 120_000) / 120_000) * 22));
    case "downloading_recognizer":
      return Math.min(70, 2 + Math.floor((Math.min(t, 900_000) / 900_000) * 68));
    case "starting":
      return Math.min(8, 1 + Math.floor((Math.min(t, 30_000) / 30_000) * 7));
    default:
      return Math.min(5, Math.floor(t / 3000));
  }
}
