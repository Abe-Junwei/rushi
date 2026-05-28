import { describe, expect, it } from "vitest";
import {
  computeProgrammaticScrollSuppressMs,
  WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS,
  WAVEFORM_SCROLL_REVERSE_SYNC_EPSILON_PX,
  WAVEFORM_SCROLL_SYNC_EPSILON_PX,
} from "./waveformScrollSync";

describe("waveformScrollSync", () => {
  it("uses scroll epsilon above subpixel noise", () => {
    expect(WAVEFORM_SCROLL_SYNC_EPSILON_PX).toBeGreaterThanOrEqual(0.5);
  });

  it("reverse-sync threshold is significantly larger than forward, to swallow WaveSurfer rounding", () => {
    // Forward (user → ws) keeps tight precision so seeks are accurate; reverse
    // (ws → tier) needs slack so subpixel ws rounding doesn't snap user scroll.
    expect(WAVEFORM_SCROLL_REVERSE_SYNC_EPSILON_PX).toBeGreaterThanOrEqual(2);
    expect(WAVEFORM_SCROLL_REVERSE_SYNC_EPSILON_PX).toBeGreaterThan(
      WAVEFORM_SCROLL_SYNC_EPSILON_PX * 4,
    );
  });

  it("scales programmatic suppress ms with scroll distance", () => {
    expect(computeProgrammaticScrollSuppressMs(0)).toBe(WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS);
    expect(computeProgrammaticScrollSuppressMs(5000)).toBeGreaterThan(1000);
    expect(computeProgrammaticScrollSuppressMs(50000)).toBeLessThanOrEqual(4000);
  });
});
