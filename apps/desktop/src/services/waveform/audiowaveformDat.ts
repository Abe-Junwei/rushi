/** audiowaveform v1 `.dat` → WaveSurfer peaks conversion helpers. */

import WaveformData from "waveform-data";
import { computeTimelineWidthPx } from "../../utils/pxPerSec";

const INT16_SCALE = 32767;

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

/** 上采样倍数硬上限，防止极长音频高缩放导致 OOM。
 * 注：当前逻辑中上采样路径（targetWidth > baseWidth）已在上方提前返回，
 * 因此下采样路径里 `baseWidth * MAX_UPSAMPLE_RATIO` 部分实际为死代码。
 * 保留常量作为文档/未来扩展的防护栏。 */
const MAX_UPSAMPLE_RATIO = 50;

export function resampleWaveformForPxPerSec(
  data: WaveformData,
  pxPerSec: number,
  layoutDurationSec?: number,
): WaveformData {
  const baseWidth = data.length;
  const layoutDur =
    layoutDurationSec != null && layoutDurationSec > 0 ? layoutDurationSec : data.duration;
  // Match `computeTimelineWidthPx` so resampled column count aligns with the
  // timeline / tile distribution width (incl. 320 px fit-all floor).
  const targetWidth = Math.max(1, computeTimelineWidthPx(layoutDur, pxPerSec));
  // waveform-data 的 resample 只支持下采样（targetWidth <= baseWidth）。
  // 若需要上采样，直接返回原数据，由 Canvas 绘制层做视觉拉伸。
  if (targetWidth > baseWidth) {
    return data;
  }
  // 下采样路径：targetWidth <= baseWidth，MAX_UPSAMPLE_RATIO 在此分支不生效。
  const width = Math.min(targetWidth, Math.max(1, baseWidth * MAX_UPSAMPLE_RATIO));
  return data.resample({ width });
}

/** Resample waveform data to a specific pixel width (overview use-case).
 *  Unlike `resampleWaveformForPxPerSec`, this does NOT go through
 *  `computeTimelineWidthPx` and its 320 px floor, so the column count
 *  exactly matches the overview container width.
 */
export function resampleWaveformToWidth(
  data: WaveformData,
  targetWidth: number,
): WaveformData {
  const baseWidth = data.length;
  const w = Math.max(1, Math.floor(targetWidth));
  if (w >= baseWidth) {
    return data;
  }
  return data.resample({ width: w });
}
