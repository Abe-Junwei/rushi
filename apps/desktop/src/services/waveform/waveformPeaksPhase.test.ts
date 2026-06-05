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

  it("prefers peaks over unavailable when WaveSurfer still has peaks bound", () => {
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
    ).toBe("peaks");
  });

  it("returns peaks when peaks are applied to WaveSurfer", () => {
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

  it("returns peaks when decode is ready and background peaks will not load", () => {
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
    ).toBe("peaks");
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
