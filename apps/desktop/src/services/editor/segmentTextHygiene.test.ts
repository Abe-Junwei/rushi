import { describe, expect, it } from "vitest";
import {
  applySegmentTextHygiene,
  collapseConsecutiveWhitespace,
  collapseDuplicatePunctuation,
  normalizeFullWidthAlphanumeric,
  normalizeHalfWidthPunctuationToFullWidth,
} from "./segmentTextHygiene";

describe("segmentTextHygiene", () => {
  it("normalizes full-width alphanumerics and ideographic space", () => {
    expect(normalizeFullWidthAlphanumeric("ＡＢＣ　１２３")).toBe("ABC 123");
  });

  it("converts half-width punctuation to full-width Chinese forms", () => {
    expect(normalizeHalfWidthPunctuationToFullWidth("你好,真的吗?")).toBe("你好，真的吗？");
    expect(normalizeHalfWidthPunctuationToFullWidth("结束.")).toBe("结束。");
    expect(normalizeHalfWidthPunctuationToFullWidth("3.14")).toBe("3.14");
    expect(normalizeHalfWidthPunctuationToFullWidth("12:30")).toBe("12:30");
    expect(normalizeHalfWidthPunctuationToFullWidth("等等...")).toBe("等等…");
  });

  it("preserves existing full-width Chinese punctuation", () => {
    expect(normalizeHalfWidthPunctuationToFullWidth("你好，世界。")).toBe("你好，世界。");
  });

  it("collapses consecutive whitespace", () => {
    expect(collapseConsecutiveWhitespace("a   b\t\tc")).toBe("a b c");
  });

  it("collapses duplicate punctuation", () => {
    expect(collapseDuplicatePunctuation("你好。。。真的吗！！")).toBe("你好。真的吗！");
  });

  it("applySegmentTextHygiene combines NFKC, full-width punct, and dedupe", () => {
    expect(applySegmentTextHygiene("ＨＥＬＬＯ,,, 　 世界...")).toBe("HELLO， 世界…");
    expect(applySegmentTextHygiene("制控　系统。。。")).toBe("制控 系统。");
  });
});
