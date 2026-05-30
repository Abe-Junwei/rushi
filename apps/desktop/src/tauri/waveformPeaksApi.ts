import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";

export interface WaveformPeakLevelStatus {
  level: number;
  pixelsPerSecond: number;
  path: string;
  exists: boolean;
}

export interface WaveformPeaksStatus {
  levels: WaveformPeakLevelStatus[];
  sampleRate: number | null;
  durationSec: number | null;
  generating: boolean;
}

export interface EnsureWaveformPeaksOptions {
  force?: boolean;
  mediaDurationSec?: number;
}

export async function ensureWaveformPeaks(
  projectId: string,
  fileId: string,
  options?: EnsureWaveformPeaksOptions,
): Promise<WaveformPeaksStatus> {
  return invoke<WaveformPeaksStatus>("ensure_waveform_peaks", {
    projectId,
    fileId,
    force: options?.force ?? false,
    mediaDurationSec: options?.mediaDurationSec ?? null,
  });
}

export async function waveformPeaksStatus(projectId: string, fileId: string): Promise<WaveformPeaksStatus> {
  return invoke<WaveformPeaksStatus>("waveform_peaks_status", { projectId, fileId });
}

export function peakLevelAssetUrl(diskPath: string): string {
  return convertFileSrc(diskPath);
}

export interface ClearWaveformPeaksForFileResult {
  freed_bytes: number;
}

/** Remove on-disk peaks for one file (does not regenerate; caller should ensure). */
export async function clearWaveformPeaksForFile(
  projectId: string,
  fileId: string,
): Promise<ClearWaveformPeaksForFileResult> {
  return invoke<ClearWaveformPeaksForFileResult>("clear_waveform_peaks_for_file", {
    projectId,
    fileId,
  });
}
