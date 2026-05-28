import { describe, expect, it } from "vitest";
import { clientXToTimelinePx, timelinePxToTimeSec } from "./waveformPointerTime";

describe("waveformPointerTime", () => {
  it("maps clientX relative to container viewport without adding scrollLeft", () => {
    const containerLeft = 120;
    const scrollLeft = 500;
    const clientX = containerLeft + 80;
    void scrollLeft;
    expect(clientXToTimelinePx(clientX, containerLeft)).toBe(80);
    expect(timelinePxToTimeSec(80, 100, 60)).toBe(0.8);
  });

  it("clamps time to duration", () => {
    expect(timelinePxToTimeSec(99999, 56, 10)).toBe(10);
    expect(timelinePxToTimeSec(-5, 56, 10)).toBe(0);
  });
});
