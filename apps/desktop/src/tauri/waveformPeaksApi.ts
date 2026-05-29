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
