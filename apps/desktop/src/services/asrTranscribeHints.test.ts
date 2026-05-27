import { describe, expect, it } from "vitest";
import { deriveTranscribeHints } from "./asrTranscribeHints";

describe("deriveTranscribeHints", () => {
  it("flags stub engine", () => {
    const h = deriveTranscribeHints("stub", [], [{ text: "你好" }]);
    expect(h.some((x) => x.includes("stub"))).toBe(true);
  });

  it("flags hotwords truncated at 12k", () => {
    const h = deriveTranscribeHints("funasr+x", ["hotwords_truncated_12k"], [{ text: "a" }]);
    expect(h.some((x) => x.includes("12,000"))).toBe(true);
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

  it("flags whole-track fallback warning", () => {
    const h = deriveTranscribeHints("funasr+iic/SenseVoiceSmall", ["funasr_whole_track_fallback: x"], [
      { text: "你好世界" },
    ]);
    expect(h.some((x) => x.includes("整轨单语段"))).toBe(true);
  });

  it("flags long audio without segments", () => {
    const h = deriveTranscribeHints("funasr+iic/SenseVoiceSmall", ["funasr_long_audio_no_segments: x"], []);
    expect(h.some((x) => x.includes("Paraformer"))).toBe(true);
    expect(h.some((x) => x.includes("未生成任何语段"))).toBe(false);
  });

  it("flags zero segments without stub", () => {
    const h = deriveTranscribeHints("funasr+x", [], []);
    expect(h.some((x) => x.includes("未生成任何语段"))).toBe(true);
  });
});
