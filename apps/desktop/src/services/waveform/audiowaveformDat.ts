/** audiowaveform v1 `.dat` → WaveSurfer peaks conversion helpers. */

import WaveformData from "waveform-data";

const INT16_SCALE = 32768;

export type WaveformDataInstance = WaveformData;

export async function loadWaveformDatFromUrl(url: string): Promise<WaveformData> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`加载 peaks 失败: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  return WaveformData.create(buf);
}

/** WaveSurfer v7 expects `[channel0Peaks]` with interleaved min/max floats in 0..1. */
export function waveformDataToWaveSurferPeaks(data: WaveformData): number[][] {
  const channel = data.channel(0);
  const len = data.length;
  const peaks = new Array<number>(len * 2);
  for (let i = 0; i < len; i += 1) {
    peaks[i * 2] = channel.min_sample(i) / INT16_SCALE;
    peaks[i * 2 + 1] = channel.max_sample(i) / INT16_SCALE;
  }
  return [peaks];
}

export function waveformDurationSec(data: WaveformData): number {
  return data.duration;
}

export function resampleWaveformForPxPerSec(data: WaveformData, pxPerSec: number): WaveformData {
  const width = Math.max(1, Math.ceil(data.duration * pxPerSec));
  return data.resample({ width });
}
