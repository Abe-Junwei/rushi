import { describe, expect, it } from "vitest";
import {
  computeProgrammaticScrollSuppressMs,
  WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS,
  WAVEFORM_SCROLL_SYNC_EPSILON_PX,
} from "./waveformScrollSync";

describe("waveformScrollSync", () => {
  it("uses scroll epsilon above subpixel noise", () => {
    expect(WAVEFORM_SCROLL_SYNC_EPSILON_PX).toBeGreaterThanOrEqual(0.5);
  });

  it("scales programmatic suppress ms with scroll distance", () => {
    expect(computeProgrammaticScrollSuppressMs(0)).toBe(WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS);
    expect(computeProgrammaticScrollSuppressMs(5000)).toBeGreaterThan(1000);
    expect(computeProgrammaticScrollSuppressMs(50000)).toBeLessThanOrEqual(4000);
  });
});
