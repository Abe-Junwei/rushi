import { describe, expect, it } from "vitest";
import { deriveTranscribeHints } from "./asrTranscribeHints";

describe("deriveTranscribeHints", () => {
  it("flags stub engine", () => {
    const h = deriveTranscribeHints("stub", [], [{ text: "你好" }]);
    expect(h.some((x) => x.includes("stub"))).toBe(true);
  });

  it("flags hotwords ignored", () => {
    const h = deriveTranscribeHints("funasr+x", ["hotwords_ignored_stub"], [{ text: "a" }]);
    expect(h.some((x) => x.includes("热词"))).toBe(true);
  });

  it("flags all-empty segments", () => {
    const h = deriveTranscribeHints("funasr+x", [], [{ text: "" }, { text: "  " }]);
    expect(h.some((x) => x.includes("均为空"))).toBe(true);
  });

  it("surfaces correction-rule hint warnings", () => {
    const h = deriveTranscribeHints(
      "funasr+x",
      ["correction_rule_hint:安波那那->安那般那"],
      [{ text: "安波那那" }],
    );
    expect(h.some((x) => x.includes("安波那那") && x.includes("安那般那"))).toBe(true);
  });
});
