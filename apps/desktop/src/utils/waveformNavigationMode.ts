/** 用户可理解的波形横向导航模式（footer / 无障碍文案）。 */
export type WaveformNavigationModeLabel = "手动缩放" | "跟随语段";

export function formatWaveformNavigationFooterLabel(input: {
  autoFitSelectionToViewport: boolean;
}): string {
  return input.autoFitSelectionToViewport ? "波形：跟随语段" : "波形：手动缩放";
}

export function formatWaveformNavigationModeLabel(input: {
  autoFitSelectionToViewport: boolean;
}): WaveformNavigationModeLabel {
  return input.autoFitSelectionToViewport ? "跟随语段" : "手动缩放";
}
