/** Peaks canvas vs WaveSurfer decode fallback (ADR-0005). */
export type WaveformTimelineMode = "peaks" | "decode-fallback";

export type ViewportFitPhase = "idle" | "pending-scroll" | "pending-peaks" | "done";

export function resolveWaveformTimelineMode(peakCache: unknown): WaveformTimelineMode {
  return peakCache != null ? "peaks" : "decode-fallback";
}

export function isPeaksCanvasTimelineMode(mode: WaveformTimelineMode): boolean {
  return mode === "peaks";
}
