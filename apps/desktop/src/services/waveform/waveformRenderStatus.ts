import type { WaveformPeaksPhase } from "./waveformPeaksPhase";

type StatusInput = {
  phase: WaveformPeaksPhase;
  mountDeferTimedOut: boolean;
  waveformReady: boolean;
  peaksError?: string | null;
  peakCache?: unknown;
  mediaDurationSec?: number;
};

/** Steady-state label for editor footer center (e.g. 正在优化波形…). */
export function resolveWaveformFooterStatusLabel(input: StatusInput): string | null {
  if (input.peaksError) return `波形生成失败：${input.peaksError}`;
  const label = resolveWaveformHeaderStatusLabel(input);
  if (!label) return null;
  // Idle「波形就绪」仅作波形区状态，不占底栏居中位（留给快捷键 hint 轮换）。
  if (label === "波形就绪") return null;
  return label;
}

export function resolveWaveformHeaderStatusLabel(input: StatusInput): string | null {
  const { phase, waveformReady } = input;
  if (input.peaksError) return `波形生成失败：${input.peaksError}`;

  switch (phase) {
    case "peaks":
      return waveformReady ? "波形就绪" : null;
    case "peaks_pending":
      return "暂停后将优化波形";
    case "decode":
      if (!waveformReady) return null;
      return "正在优化波形…";
    case "unavailable":
      return null;
    default:
      return null;
  }
}

/** Active loading / error label — centered in the waveform viewport. */
export function resolveWaveformCenterStatusLabel(input: StatusInput): string | null {
  const { phase, mountDeferTimedOut, waveformReady } = input;

  if (input.peaksError) {
    return `波形生成失败：${input.peaksError}`;
  }

  if (phase === "unavailable") {
    return "波形生成失败";
  }

  // Prefer PeakCache presence over phase: WS-2b stub can look ready while canvas is blank.
  const awaitingPeaks =
    (input.mediaDurationSec ?? 0) > 0 &&
    input.peakCache == null &&
    (phase === "generating" || phase === "decode" || !waveformReady);

  if (awaitingPeaks || phase === "generating" || phase === "decode") {
    if (!waveformReady) {
      if (phase === "generating" && mountDeferTimedOut) return "正在加载波形…";
      if (phase === "generating") return "正在生成波形…";
      return "正在加载波形…";
    }
    return "正在生成波形…";
  }

  return null;
}
