import { describe, expect, it } from "vitest";
import { clampTimelineScrollLeftPx } from "./waveformScrollSync";

describe("waveformScrollSync", () => {
  it("clamps scroll against timeline width", () => {
    expect(
      clampTimelineScrollLeftPx({
        scrollLeftPx: 500,
        timelineWidthPx: 320,
        viewportWidthPx: 200,
      }),
    ).toBe(120);
  });
});
