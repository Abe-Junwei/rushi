import { vi } from "vitest";
import { createWaveformAppliedZoomState } from "../utils/waveformAppliedZoom";

export async function flushRaf() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function makeAppliedZoom(
  initialPxPerSec: number,
  peaks?: { applied: boolean; loadPx: number },
) {
  const state = createWaveformAppliedZoomState(initialPxPerSec);
  if (peaks) {
    state.appliedPeaksRef.current = peaks.applied;
    state.appliedPeaksLoadPxPerSecRef.current = peaks.loadPx;
  }
  return state;
}

export function makeWs(overrides: Record<string, unknown> = {}) {
  return {
    setOptions: vi.fn(),
    zoom: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
    isPlaying: vi.fn(() => false),
    getCurrentTime: vi.fn(() => 0),
    setTime: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export const hotSwitchWhilePlayingRef = { current: true };

export const zoomSyncBase = {
  isReady: true,
  isPlaying: false,
  mediaUrl: "asset://audio.mp3",
  hotSwitchWhilePlayingRef,
  hotSwitchWhilePlaying: true,
} as const;
