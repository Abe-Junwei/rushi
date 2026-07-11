import { describe, expect, it } from "vitest";
import { joinMergedSegmentTexts } from "./joinMergedSegmentTexts";

describe("joinMergedSegmentTexts", () => {
  it("joins Latin with a single space and never inserts newlines", () => {
    expect(joinMergedSegmentTexts("hello", "world")).toBe("hello world");
    expect(joinMergedSegmentTexts("hello ", " world")).toBe("hello world");
  });

  it("abuts CJK without a space", () => {
    expect(joinMergedSegmentTexts("语段0内容", "语段1内容")).toBe("语段0内容语段1内容");
    expect(joinMergedSegmentTexts("こんにちは", "世界")).toBe("こんにちは世界");
  });

  it("does not emit LF / CR", () => {
    expect(joinMergedSegmentTexts("a", "b")).not.toMatch(/[\n\r]/);
  });
});
