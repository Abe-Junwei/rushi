import { describe, expect, it } from "vitest";
import {
  buildParagraphsFromBreaks,
  coalesceExportParagraphBreaks,
  EXPORT_POLISH_MAX_PARAGRAPHS,
} from "./exportPolishParagraphs";

describe("coalesceExportParagraphBreaks", () => {
  it("merges breaks that are too close", () => {
    const breaks = coalesceExportParagraphBreaks(20, [1, 2, 3, 10, 11]);
    expect(breaks).toEqual([1, 10]);
  });

  it("caps paragraph count for long transcripts", () => {
    const dense = Array.from({ length: 49 }, (_, i) => i * 2);
    const breaks = coalesceExportParagraphBreaks(176, dense);
    expect(breaks.length).toBeLessThanOrEqual(EXPORT_POLISH_MAX_PARAGRAPHS - 1);
  });
});

describe("buildParagraphsFromBreaks", () => {
  it("joins lines between breaks", () => {
    expect(buildParagraphsFromBreaks(["A", "B", "C"], [0])).toEqual(["A", "BC"]);
  });
});
