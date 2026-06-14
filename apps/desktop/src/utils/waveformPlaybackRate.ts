/** 固定播放速度档位（从低到高）。 */
export const WAVEFORM_PLAYBACK_RATE_PRESETS = [0.25, 0.5, 1, 1.25, 1.5, 2, 3] as const;

/** 锚点 1.0 之上（更快）。 */
export const WAVEFORM_PLAYBACK_RATE_FASTER_PRESETS = WAVEFORM_PLAYBACK_RATE_PRESETS.filter(
  (r): r is WaveformPlaybackRatePreset => r > 1,
);

/** 锚点 1.0 之下（更慢）。 */
export const WAVEFORM_PLAYBACK_RATE_SLOWER_PRESETS = WAVEFORM_PLAYBACK_RATE_PRESETS.filter(
  (r): r is WaveformPlaybackRatePreset => r < 1,
);

export type WaveformPlaybackRatePreset = (typeof WAVEFORM_PLAYBACK_RATE_PRESETS)[number];

export function snapWaveformPlaybackRate(rate: number): WaveformPlaybackRatePreset {
  if (!Number.isFinite(rate)) return 1;
  let best: WaveformPlaybackRatePreset = 1;
  let bestDiff = Infinity;
  for (const preset of WAVEFORM_PLAYBACK_RATE_PRESETS) {
    const diff = Math.abs(preset - rate);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = preset;
    }
  }
  return best;
}

export function clampWaveformPlaybackRate(rate: number): number {
  return snapWaveformPlaybackRate(rate);
}

export function formatWaveformPlaybackRateLabel(rate: number): string {
  const snapped = snapWaveformPlaybackRate(rate);
  if (snapped === 1) return "1x";
  return `${snapped}x`;
}

/** 菜单项展示（固定一位小数仅用于 1.0）。 */
export function formatWaveformPlaybackRatePresetMenuLabel(rate: WaveformPlaybackRatePreset): string {
  if (rate === 1) return "1.0";
  return String(rate);
}
