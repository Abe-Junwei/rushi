import { describe, expect, it } from "vitest";
import {
  peaksEnsureMediaDurationSec,
  peaksMediaDurationMismatch,
  resolvePeaksDrawMediaDurationSec,
  resolveWaveformPeaksUiState,
  waveformPeaksStatusMessage,
} from "./peakMediaDuration";

describe("peaksMediaDurationMismatch", () => {
  it("flags when peaks cover less than 98% of media", () => {
    expect(peaksMediaDurationMismatch(732, 1195)).toBe(true);
    expect(peaksMediaDurationMismatch(1180, 1195)).toBe(false);
  });

  it("returns false when either duration is unknown", () => {
    expect(peaksMediaDurationMismatch(0, 1195)).toBe(false);
    expect(peaksMediaDurationMismatch(732, 0)).toBe(false);
  });
});

describe("peaksEnsureMediaDurationSec", () => {
  it("returns undefined until media duration is known", () => {
    expect(peaksEnsureMediaDurationSec(0)).toBeUndefined();
    expect(peaksEnsureMediaDurationSec(1195)).toBe(1195);
  });
});

describe("resolvePeaksDrawMediaDurationSec", () => {
  it("uses peak duration while reloading stale peaks", () => {
    expect(
      resolvePeaksDrawMediaDurationSec({
        peakDurationSec: 960,
        layoutMediaDurationSec: 1195,
        peaksLoading: true,
      }),
    ).toBe(960);
  });

  it("uses layout duration when peaks cover media", () => {
    expect(
      resolvePeaksDrawMediaDurationSec({
        peakDurationSec: 1180,
        layoutMediaDurationSec: 1195,
        peaksLoading: false,
      }),
    ).toBe(1195);
  });

  it("falls back to peak duration when layout is unknown", () => {
    expect(
      resolvePeaksDrawMediaDurationSec({
        peakDurationSec: 600,
        layoutMediaDurationSec: 0,
        peaksLoading: false,
      }),
    ).toBe(600);
  });
});

describe("resolveWaveformPeaksUiState", () => {
  it("prefers loading over mismatch error", () => {
    expect(
      resolveWaveformPeaksUiState({
        peakCache: {},
        peaksLoading: true,
        peaksError: null,
        layoutMediaDurationSec: 1195,
        peakDurationSec: 960,
      }),
    ).toBe("loading");
  });

  it("surfaces mismatch as error when idle", () => {
    expect(
      resolveWaveformPeaksUiState({
        peakCache: {},
        peaksLoading: false,
        peaksError: null,
        layoutMediaDurationSec: 1195,
        peakDurationSec: 960,
      }),
    ).toBe("error");
  });
});

describe("waveformPeaksStatusMessage", () => {
  it("returns mismatch copy for error without peaksError", () => {
    expect(waveformPeaksStatusMessage("error", null)).toBe("波形数据与音频时长不一致");
  });
});
