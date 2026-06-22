import { describe, expect, it } from "vitest";
import { resolveDisplayPlayheadTimeSec } from "./waveformDisplayPlayhead";

describe("resolveDisplayPlayheadTimeSec", () => {
  it("uses visual time while playing", () => {
    expect(
      resolveDisplayPlayheadTimeSec({
        isPlaying: true,
        isReady: true,
        getVisualPlayheadTimeSec: () => 12.5,
        getMediaPlayheadTimeSec: () => 12.1,
      }),
    ).toBe(12.5);
  });

  it("uses visual time when paused and ready", () => {
    expect(
      resolveDisplayPlayheadTimeSec({
        isPlaying: false,
        isReady: true,
        getVisualPlayheadTimeSec: () => 142,
        getMediaPlayheadTimeSec: () => 165,
      }),
    ).toBe(142);
  });

  it("uses media time when not ready even if playing flag is set", () => {
    expect(
      resolveDisplayPlayheadTimeSec({
        isPlaying: true,
        isReady: false,
        getVisualPlayheadTimeSec: () => 12.5,
        getMediaPlayheadTimeSec: () => 0,
      }),
    ).toBe(0);
  });
});
