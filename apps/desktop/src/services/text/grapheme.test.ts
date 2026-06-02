import { describe, expect, it } from "vitest";
import { graphemeCount, sliceGraphemes, splitGraphemes } from "./grapheme";

describe("grapheme", () => {
  it("splits CJK by visible character", () => {
    expect(splitGraphemes("二六十中")).toEqual(["二", "六", "十", "中"]);
    expect(graphemeCount("尤其在二六十中道场")).toBe(9);
  });

  it("sliceGraphemes preserves surrogate pairs when segmenter available", () => {
    const emoji = "你好🙂世界";
    expect(sliceGraphemes(emoji, 0, 2)).toBe("你好");
    expect(sliceGraphemes(emoji, 2, 3)).toBe("🙂");
  });
});
