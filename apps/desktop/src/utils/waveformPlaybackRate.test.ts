import { describe, expect, it } from "vitest";
import {
  clampWaveformPlaybackRate,
  formatWaveformPlaybackRateLabel,
  snapWaveformPlaybackRate,
  WAVEFORM_PLAYBACK_RATE_FASTER_PRESETS,
  WAVEFORM_PLAYBACK_RATE_PRESETS,
  WAVEFORM_PLAYBACK_RATE_SLOWER_PRESETS,
} from "./waveformPlaybackRate";

describe("snapWaveformPlaybackRate", () => {
  it("snaps to nearest preset", () => {
    expect(snapWaveformPlaybackRate(0.3)).toBe(0.25);
    expect(snapWaveformPlaybackRate(0.7)).toBe(0.75);
    expect(snapWaveformPlaybackRate(1.1)).toBe(1);
    expect(snapWaveformPlaybackRate(1.4)).toBe(1.5);
    expect(snapWaveformPlaybackRate(2.8)).toBe(3);
  });

  it("keeps exact presets", () => {
    for (const p of WAVEFORM_PLAYBACK_RATE_PRESETS) {
      expect(snapWaveformPlaybackRate(p)).toBe(p);
    }
  });
});

describe("clampWaveformPlaybackRate", () => {
  it("returns preset only", () => {
    expect(clampWaveformPlaybackRate(0.1)).toBe(0.25);
    expect(clampWaveformPlaybackRate(4)).toBe(3);
  });
});

describe("playback rate menu tiers", () => {
  it("splits presets around 1.0 anchor", () => {
    expect(WAVEFORM_PLAYBACK_RATE_SLOWER_PRESETS).toEqual([0.25, 0.5, 0.75]);
    expect(WAVEFORM_PLAYBACK_RATE_FASTER_PRESETS).toEqual([1.25, 1.5, 2, 3]);
  });
});

describe("formatWaveformPlaybackRateLabel", () => {
  it("formats presets", () => {
    expect(formatWaveformPlaybackRateLabel(0.25)).toBe("0.25x");
    expect(formatWaveformPlaybackRateLabel(0.75)).toBe("0.75x");
    expect(formatWaveformPlaybackRateLabel(1.25)).toBe("1.25x");
    expect(formatWaveformPlaybackRateLabel(3)).toBe("3x");
  });
});
