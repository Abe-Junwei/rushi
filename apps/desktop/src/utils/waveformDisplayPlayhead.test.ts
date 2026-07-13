import { describe, expect, it } from "vitest";
import { resolveDisplayPlayheadTimeSec } from "./waveformDisplayPlayhead";

describe("resolveDisplayPlayheadTimeSec", () => {
  it("uses visual time when ready (even while playing)", () => {
    expect(
      resolveDisplayPlayheadTimeSec({
        isReady: true,
        getVisualPlayheadTimeSec: () => 12.5,
        getEngineDisplayTimeSec: () => 12.7,
      }),
    ).toBe(12.5);
  });

  it("uses visual time when ready and media lags", () => {
    expect(
      resolveDisplayPlayheadTimeSec({
        isReady: true,
        getVisualPlayheadTimeSec: () => 12.5,
        getEngineDisplayTimeSec: () => 12.1,
      }),
    ).toBe(12.5);
  });

  it("uses visual time when paused and ready", () => {
    expect(
      resolveDisplayPlayheadTimeSec({
        isReady: true,
        getVisualPlayheadTimeSec: () => 142,
        getEngineDisplayTimeSec: () => 165,
      }),
    ).toBe(142);
  });

  it("uses media time when not ready", () => {
    expect(
      resolveDisplayPlayheadTimeSec({
        isReady: false,
        getVisualPlayheadTimeSec: () => 12.5,
        getEngineDisplayTimeSec: () => 0,
      }),
    ).toBe(0);
  });
});
