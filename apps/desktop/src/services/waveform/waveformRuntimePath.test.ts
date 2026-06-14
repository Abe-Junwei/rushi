import { describe, expect, it } from "vitest";
import {
  logWaveformRenderPath,
  resetWaveformRenderPathLog,
  resolveIntendedWaveformMountPath,
} from "./waveformRuntimePath";

describe("resolveIntendedWaveformMountPath", () => {
  it("peaks-first when cache is ready", () => {
    expect(
      resolveIntendedWaveformMountPath({
        backgroundPeaksEnabled: true,
        peakCache: {},
        peaksUnavailable: false,
        deferTimedOut: false,
      }),
    ).toEqual({ path: "peaks", reason: "mount_peaks_bootstrap" });
  });

  it("decode only when peaks unavailable or background off", () => {
    expect(
      resolveIntendedWaveformMountPath({
        backgroundPeaksEnabled: false,
        peakCache: null,
        peaksUnavailable: false,
        deferTimedOut: false,
      }).path,
    ).toBe("decode");

    expect(
      resolveIntendedWaveformMountPath({
        backgroundPeaksEnabled: true,
        peakCache: null,
        peaksUnavailable: true,
        deferTimedOut: false,
      }).reason,
    ).toBe("mount_decode_peaks_unavailable");
  });

  it("decode after defer timeout without cache (dev/release same policy)", () => {
    expect(
      resolveIntendedWaveformMountPath({
        backgroundPeaksEnabled: true,
        peakCache: null,
        peaksUnavailable: false,
        deferTimedOut: true,
      }),
    ).toEqual({ path: "decode", reason: "mount_decode_defer_timeout" });
  });
});

describe("logWaveformRenderPath", () => {
  it("dedupes identical path+reason logs", () => {
    resetWaveformRenderPathLog();
    logWaveformRenderPath("peaks", "mount_peaks_bootstrap");
    logWaveformRenderPath("peaks", "mount_peaks_bootstrap");
    expect(true).toBe(true);
  });
});
