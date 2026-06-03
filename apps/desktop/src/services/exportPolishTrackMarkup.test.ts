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

  it.each(fixture.cases)(
    "fixture $id expectMarkup=$expectMarkup",
    ({ before, after, expectMarkup }) => {
      expect(lineWouldHaveWordTrackMarkup(before, after)).toBe(expectMarkup);
    },
  );
});
