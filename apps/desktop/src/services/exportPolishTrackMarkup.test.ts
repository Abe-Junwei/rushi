import { describe, expect, it } from "vitest";
import fixture from "./fixtures/exportTrackMarkupCases.json";
import { lineWouldHaveWordTrackMarkup } from "./exportPolishTrackMarkup";

describe("lineWouldHaveWordTrackMarkup", () => {
  it("marks punctuation-only diff", () => {
    expect(lineWouldHaveWordTrackMarkup("你好", "你好。")).toBe(true);
  });

  it("marks typo hunks inside long line", () => {
    const before = "脊柱向上屈肩背胸小胸小向两臂自然舒展";
    const after = "脊柱向上，屈肩背，胸腔向两臂自然舒展";
    expect(lineWouldHaveWordTrackMarkup(before, after)).toBe(true);
  });

  it("does not mark large pure mid-line deletion as track markup", () => {
    const before =
      "开场先说纪律。我们把禅堂看得比殿堂还要重。虽然条件简陋，但对学修很投入。";
    const after = "开场先说纪律。虽然条件简陋，但对学修很投入。";
    // Filter path keeps deleted text as Same (not w:del); markup should be absent.
    expect(lineWouldHaveWordTrackMarkup(before, after)).toBe(false);
  });

  it.each(fixture.cases)(
    "fixture $id expectMarkup=$expectMarkup",
    ({ before, after, expectMarkup }) => {
      expect(lineWouldHaveWordTrackMarkup(before, after)).toBe(expectMarkup);
    },
  );
});
