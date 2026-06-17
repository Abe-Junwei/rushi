import { logRuntimeParity } from "../runtimeParity";

export type WaveformRenderPath = "peaks" | "decode";

export type WaveformPathReason =
  | "mount_peaks_bootstrap"
  | "mount_decode_no_cache"
  | "mount_decode_defer_timeout"
  | "mount_decode_peaks_unavailable"
  | "mount_decode_background_off"
  | "peaks_load_applied"
  | "peaks_load_failed"
  | "peaks_resample_failed"
  | "peaks_hot_switch_deferred"
  | "decode_only_zoom";

const DECODE_MOUNT_DIAGNOSTIC_REASON: WaveformPathReason = "mount_decode_background_off";

let lastLoggedPath: WaveformRenderPath | null = null;
let lastLoggedReason: WaveformPathReason | null = null;

export function logWaveformRenderPath(
  path: WaveformRenderPath,
  reason: WaveformPathReason,
  detail?: string,
): void {
  if (lastLoggedPath === path && lastLoggedReason === reason && !detail) return;
  lastLoggedPath = path;
  lastLoggedReason = reason;
  const suffix = detail ? ` ${detail}` : "";
  const level =
    path === "decode" && reason !== DECODE_MOUNT_DIAGNOSTIC_REASON ? "WARN" : "INFO";
  logRuntimeParity("waveform", `render_path=${path} reason=${reason}${suffix}`, level);
}

export function resetWaveformRenderPathLog(): void {
  lastLoggedPath = null;
  lastLoggedReason = null;
}

/** Intended render path before WaveSurfer mount (peaks-first policy). */
export function resolveIntendedWaveformMountPath(input: {
  backgroundPeaksEnabled: boolean;
  peakCache: unknown;
  peaksUnavailable: boolean;
  deferTimedOut: boolean;
}): { path: WaveformRenderPath; reason: WaveformPathReason } {
  if (!input.backgroundPeaksEnabled) {
    return { path: "decode", reason: "mount_decode_background_off" };
  }
  if (input.peaksUnavailable) {
    return { path: "decode", reason: "mount_decode_peaks_unavailable" };
  }
  if (input.peakCache) {
    return { path: "peaks", reason: "mount_peaks_bootstrap" };
  }
  if (input.deferTimedOut) {
    return { path: "decode", reason: "mount_decode_defer_timeout" };
  }
  return { path: "peaks", reason: "mount_peaks_bootstrap" };
}
