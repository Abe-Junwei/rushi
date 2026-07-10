import type WaveSurfer from "wavesurfer.js";

/** One interleaved min/max column — enough for WaveSurfer createBuffer, not for display. */
export function buildWaveSurferMediaOnlyStubPeaks(): Float32Array[] {
  return [new Float32Array([0, 0])];
}

type WaveSurferOptionsSnapshot = {
  minPxPerSec?: number;
  fillParent?: boolean;
};

function readWaveSurferOptions(ws: WaveSurfer): WaveSurferOptionsSnapshot | null {
  const options = (ws as { options?: WaveSurferOptionsSnapshot }).options;
  return options ?? null;
}

/** True when WS renderer is already pinned to parent-sized media-only mode. */
export function isWaveSurferMediaOnlyCollapsed(ws: WaveSurfer): boolean {
  const options = readWaveSurferOptions(ws);
  return options?.minPxPerSec === 0 && options?.fillParent === true;
}

/**
 * Collapse WaveSurfer's renderer to a parent-sized (≈1px host) surface so
 * WKWebView is not compositing a 40k-wide canvas stack.
 * Media element / play / seek / getCurrentTime stay intact.
 *
 * Idempotent: skips setOptions when already collapsed (avoids afterRender loops).
 */
export function collapseWaveSurferToMediaOnly(ws: WaveSurfer): boolean {
  const duration = ws.getDuration();
  if (!(duration > 0) || !Number.isFinite(duration)) return false;
  if (isWaveSurferMediaOnlyCollapsed(ws)) return false;
  try {
    ws.setOptions({
      peaks: buildWaveSurferMediaOnlyStubPeaks(),
      duration,
      minPxPerSec: 0,
      fillParent: true,
    });
    return true;
  } catch {
    return false;
  }
}
