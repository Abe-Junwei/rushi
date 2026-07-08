import { describe, expect, it } from "vitest";
import { resolveDisplayPlayheadTimeSec } from "./waveformDisplayPlayhead";

describe("resolveDisplayPlayheadTimeSec", () => {
  it("uses media time when playing and media leads visual", () => {
    expect(
      resolveDisplayPlayheadTimeSec({
        isPlaying: true,
        isReady: true,
        getVisualPlayheadTimeSec: () => 12.5,
        getRawMediaPlayheadTimeSec: () => 12.7,
      }),
    ).toBe(12.7);
  });

  it("uses visual time when playing and visual leads media", () => {
    expect(
      resolveDisplayPlayheadTimeSec({
        isPlaying: true,
        isReady: true,
        getVisualPlayheadTimeSec: () => 12.5,
        getRawMediaPlayheadTimeSec: () => 12.1,
      }),
    ).toBe(12.5);
  });

  it("uses visual time when paused and ready", () => {
    expect(
      resolveDisplayPlayheadTimeSec({
        isPlaying: false,
        isReady: true,
        getVisualPlayheadTimeSec: () => 142,
        getRawMediaPlayheadTimeSec: () => 165,
      }),
    ).toBe(142);
  });

  it("uses media time when not ready even if playing flag is set", () => {
    expect(
      resolveDisplayPlayheadTimeSec({
        isPlaying: true,
        isReady: false,
        getVisualPlayheadTimeSec: () => 12.5,
        getRawMediaPlayheadTimeSec: () => 0,
      }),
    ).toBe(0);
  });
});
