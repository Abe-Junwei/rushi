import { describe, expect, it } from "vitest";
import { timelinePxToTime } from "./waveformProjection";
import { clientXToTimelinePx, clientXToTimeSecInTierScroll } from "./waveformPointerTime";

describe("waveformPointerTime", () => {
  it("clientXToTimelinePx subtracts container left", () => {
    expect(clientXToTimelinePx(180, 100)).toBe(80);
  });

  it("clientXToTimeSecInTierScroll accounts for tier scrollLeft", () => {
    const sec = clientXToTimeSecInTierScroll({
      clientX: 200,
      tierViewportLeftPx: 100,
      tierScrollLeftPx: 500,
      timelineWidthPx: 5600,
      durationSec: 60,
    });
    expect(sec).toBeCloseTo(timelinePxToTime(600, 5600, 60), 5);
  });

  it("timeline projection inverts time from timeline px", () => {
    expect(timelinePxToTime(80, 560, 60)).toBeCloseTo(8.571, 2);
    expect(timelinePxToTime(99999, 320, 10)).toBe(10);
    expect(timelinePxToTime(-5, 320, 10)).toBe(0);
  });
});
