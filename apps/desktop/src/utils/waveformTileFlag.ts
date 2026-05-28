/**
 * Feature flag for ADR-0004 content-tile peaks renderer.
 *
 * **Default: true** (per plan §决策 3, single-developer aggressive rollout).
 *
 * Regression escape hatch: in browser console
 *   `localStorage.setItem('RUSHI_WAVEFORM_TILE_RENDERER', 'false')`
 * and reload to fall back to legacy `WaveformPeaksViewportLayer`.
 *
 * Removed entirely in P4 once tile path is stable.
 */

const STORAGE_KEY = "RUSHI_WAVEFORM_TILE_RENDERER";

export function isWaveformTileRendererEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return true;
    return raw !== "false" && raw !== "0";
  } catch {
    return true;
  }
}
