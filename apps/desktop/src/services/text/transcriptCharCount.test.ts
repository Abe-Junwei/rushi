import { describe, expect, it } from "vitest";
import { countTranscriptBodyCharacters, isPunctuationGrapheme } from "./transcriptCharCount";

describe("transcriptCharCount", () => {
  it("treats CJK and ASCII punctuation as non-body", () => {
    expect(isPunctuationGrapheme("，")).toBe(true);
    expect(isPunctuationGrapheme(".")).toBe(true);
    expect(isPunctuationGrapheme("好")).toBe(false);
  });

  it("counts graphemes excluding punctuation", () => {
    expect(countTranscriptBodyCharacters("你好，世界。")).toBe(4);
    expect(countTranscriptBodyCharacters("a b")).toBe(3);
  });
});
