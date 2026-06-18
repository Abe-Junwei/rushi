import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentBandFillStyle } from "./waveformSegmentBandCanvasColors";

const seg: SegmentDto = {
  idx: 0,
  start_sec: 0,
  end_sec: 2,
  text: "x",
  low_confidence: false,
};

const palette = {
  selected: "sel",
  inSelection: "in-sel",
  lowConfidence: "low",
  visited: "vis",
  idle: "idle",
  border: "border",
};

describe("segmentBandFillStyle", () => {
  it("uses inSelection tint for all multi-selected segments on band canvas", () => {
    expect(
      segmentBandFillStyle(seg, true, 0, palette, { multiSelectActive: true, inSelection: false }),
    ).toBe("in-sel");
    expect(
      segmentBandFillStyle(seg, false, 0, palette, { multiSelectActive: true, inSelection: true }),
    ).toBe("in-sel");
  });

  it("keeps primary selected tint for single selection", () => {
    expect(segmentBandFillStyle(seg, true, 0, palette)).toBe("sel");
  });

  it("uses inSelection tint when flagged without multiSelectActive", () => {
    expect(
      segmentBandFillStyle(seg, false, 0, palette, { inSelection: true, multiSelectActive: false }),
    ).toBe("in-sel");
  });
});
