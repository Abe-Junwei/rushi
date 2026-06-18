import { describe, expect, it } from "vitest";
import { SEGMENT_FILL_CSS_VAR, segmentFillCssVar } from "./segmentFillTokens";

describe("segmentFillTokens", () => {
  it("exports stable CSS var names aligned with tokens.css", () => {
    expect(SEGMENT_FILL_CSS_VAR.selected).toBe("--segment-fill-selected");
    expect(SEGMENT_FILL_CSS_VAR.inSelectionWaveform).toBe("--segment-fill-in-selection-waveform");
    expect(segmentFillCssVar("visited")).toBe("var(--segment-fill-visited)");
  });
});
