import { describe, expect, it } from "vitest";
import { resolveWaveformMountDeferred } from "./waveformMountPolicy";

describe("resolveWaveformMountDeferred", () => {
  it("defers while peaks are loading with background generation on", () => {
    expect(
      resolveWaveformMountDeferred({
        backgroundPeaksEnabled: true,
        peaksLoading: true,
        peakCache: null,
        peaksUnavailable: false,
      }),
    ).toBe(true);
  });

  it("mounts immediately when background peaks are disabled", () => {
    expect(
      resolveWaveformMountDeferred({
        backgroundPeaksEnabled: false,
        peaksLoading: true,
        peakCache: null,
        peaksUnavailable: false,
      }),
    ).toBe(false);
  });

  it("mounts when bootstrap cache is ready", () => {
    expect(
      resolveWaveformMountDeferred({
        backgroundPeaksEnabled: true,
        peaksLoading: true,
        peakCache: {},
        peaksUnavailable: false,
      }),
    ).toBe(false);
  });

  it("falls back to decode when peaks are unavailable", () => {
    expect(
      resolveWaveformMountDeferred({
        backgroundPeaksEnabled: true,
        peaksLoading: true,
        peakCache: null,
        peaksUnavailable: true,
      }),
    ).toBe(false);
  });

  it("mounts after defer timeout", () => {
    expect(
      resolveWaveformMountDeferred({
        backgroundPeaksEnabled: true,
        peaksLoading: true,
        peakCache: null,
        peaksUnavailable: false,
        deferTimedOut: true,
      }),
    ).toBe(false);
  });

  it("skips defer for long media while peaks generate in background", () => {
    expect(
      resolveWaveformMountDeferred({
        backgroundPeaksEnabled: true,
        peaksLoading: true,
        peakCache: null,
        peaksUnavailable: false,
        mediaDurationSec: 48 * 60,
      }),
    ).toBe(false);
  });
});
