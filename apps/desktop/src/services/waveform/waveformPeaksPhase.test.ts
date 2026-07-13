import { describe, expect, it } from "vitest";
import { resolveWaveformPeaksPhase } from "./waveformPeaksPhase";

describe("resolveWaveformPeaksPhase", () => {
  it("returns idle without media", () => {
    expect(
      resolveWaveformPeaksPhase({
        mediaUrl: null,
        peaksLoading: false,
        peakCache: null,
        peaksUnavailable: false,
        peaksApplied: false,
        peaksHotSwitchPending: false,
        waveformReady: false,
      }),
    ).toBe("idle");
  });

  it("returns unavailable when peaks generation failed", () => {
    expect(
      resolveWaveformPeaksPhase({
        mediaUrl: "asset://a.mp3",
        peaksLoading: false,
        peakCache: null,
        peaksUnavailable: true,
        peaksApplied: false,
        peaksHotSwitchPending: false,
        waveformReady: true,
      }),
    ).toBe("unavailable");
  });

  it("shows unavailable when generation failed and PeakCache is missing", () => {
    expect(
      resolveWaveformPeaksPhase({
        mediaUrl: "asset://a.mp3",
        peaksLoading: false,
        peakCache: null,
        peaksUnavailable: true,
        peaksApplied: true,
        peaksHotSwitchPending: false,
        waveformReady: true,
      }),
    ).toBe("unavailable");
  });

  it("returns peaks when PeakCache exists and peaks are applied", () => {
    expect(
      resolveWaveformPeaksPhase({
        mediaUrl: "asset://a.mp3",
        peaksLoading: false,
        peakCache: {},
        peaksUnavailable: false,
        peaksApplied: true,
        peaksHotSwitchPending: false,
        waveformReady: true,
      }),
    ).toBe("peaks");
  });

  it("keeps decode for WS-2b stub peaksApplied without PeakCache (long audio blank)", () => {
    expect(
      resolveWaveformPeaksPhase({
        mediaUrl: "asset://a.mp3",
        peaksLoading: true,
        peakCache: null,
        peaksUnavailable: false,
        peaksApplied: true,
        peaksHotSwitchPending: false,
        waveformReady: true,
        backgroundPeaksEnabled: true,
        mountDeferred: false,
      }),
    ).toBe("decode");
  });

  it("returns peaks_pending when hot switch is deferred", () => {
    expect(
      resolveWaveformPeaksPhase({
        mediaUrl: "asset://a.mp3",
        peaksLoading: false,
        peakCache: {},
        peaksUnavailable: false,
        peaksApplied: false,
        peaksHotSwitchPending: true,
        waveformReady: true,
      }),
    ).toBe("peaks_pending");
  });

  it("returns decode when background peaks are disabled", () => {
    expect(
      resolveWaveformPeaksPhase({
        mediaUrl: "asset://a.mp3",
        peaksLoading: false,
        peakCache: null,
        peaksUnavailable: false,
        peaksApplied: false,
        peaksHotSwitchPending: false,
        waveformReady: true,
        backgroundPeaksEnabled: false,
      }),
    ).toBe("decode");
  });

  it("returns generating when mount is deferred", () => {
    expect(
      resolveWaveformPeaksPhase({
        mediaUrl: "asset://a.mp3",
        peaksLoading: true,
        peakCache: null,
        peaksUnavailable: false,
        peaksApplied: false,
        peaksHotSwitchPending: false,
        waveformReady: false,
        backgroundPeaksEnabled: true,
        mountDeferred: true,
      }),
    ).toBe("generating");
  });

  it("keeps decode when ready but background peaks have not produced a cache yet", () => {
    expect(
      resolveWaveformPeaksPhase({
        mediaUrl: "asset://a.mp3",
        peaksLoading: false,
        peakCache: null,
        peaksUnavailable: false,
        peaksApplied: false,
        peaksHotSwitchPending: false,
        waveformReady: true,
        backgroundPeaksEnabled: true,
        mountDeferred: false,
      }),
    ).toBe("decode");
  });

  it("returns decode when mount started while peaks still load", () => {
    expect(
      resolveWaveformPeaksPhase({
        mediaUrl: "asset://a.mp3",
        peaksLoading: true,
        peakCache: null,
        peaksUnavailable: false,
        peaksApplied: false,
        peaksHotSwitchPending: false,
        waveformReady: false,
        backgroundPeaksEnabled: true,
        mountDeferred: false,
      }),
    ).toBe("decode");
  });
});
