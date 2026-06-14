import type { WaveformPeaksPhase } from "./waveformPeaksPhase";

type StatusInput = {
  phase: WaveformPeaksPhase;
  mountDeferTimedOut: boolean;
  waveformReady: boolean;
};

/** Steady-state label for editor footer center (e.g. 正在优化波形…). */
export function resolveWaveformFooterStatusLabel(input: StatusInput): string | null {
  const label = resolveWaveformHeaderStatusLabel(input);
  if (!label) return null;
  // Idle「波形就绪」仅作波形区状态，不占底栏居中位（留给快捷键 hint 轮换）。
  if (label === "波形就绪") return null;
  return label;
}

export function resolveWaveformHeaderStatusLabel(input: StatusInput): string | null {
  const { phase, waveformReady } = input;

  switch (phase) {
    case "peaks":
      return waveformReady ? "波形就绪" : null;
    case "peaks_pending":
      return "暂停后将优化波形";
    case "decode":
      if (!waveformReady) return null;
      return "正在优化波形…";
    case "unavailable":
      return waveformReady ? "波形就绪" : null;
    default:
      return null;
  }
}

/** Active loading label — centered in the waveform viewport. */
export function resolveWaveformCenterStatusLabel(input: StatusInput): string | null {
  const { phase, mountDeferTimedOut, waveformReady } = input;

  switch (phase) {
    case "generating":
      if (mountDeferTimedOut && !waveformReady) return "正在加载波形…";
      return "正在生成波形…";
    case "decode":
      if (waveformReady) return null;
      return "正在加载波形…";
    case "unavailable":
      return null;
    default:
      return null;
  }
}
