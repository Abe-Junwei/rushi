import { describe, expect, it } from "vitest";
import { correctionHighlightSpanToCharRange } from "./correctionHighlightCharRange";

describe("correctionHighlightSpanToCharRange", () => {
  it("maps grapheme span to char offsets", () => {
    const out = correctionHighlightSpanToCharRange("第二个要素是智控。", { startG: 6, endG: 8 });
    expect(out).toEqual({ charStart: 6, charEnd: 8 });
  });
});
