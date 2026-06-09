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

  it("flags online vocabulary unsupported", () => {
    const h = deriveTranscribeHints("assemblyai:v2", ["online_vocabulary_unsupported"], [{ text: "a" }]);
    expect(h.some((x) => x.includes("不支持术语偏置"))).toBe(true);
  });

  it("flags dashscope term truncation hint", () => {
    const h = deriveTranscribeHints(
      "dashscope:fun-asr-realtime",
      ["online_vocabulary_truncated_dashscope_terms"],
      [{ text: "a" }],
    );
    expect(h.some((x) => x.includes("百炼热词") && x.includes("15"))).toBe(true);
  });

  it("flags dashscope vocabulary sync failure", () => {
    const h = deriveTranscribeHints(
      "dashscope:fun-asr-realtime",
      ["online_vocabulary_sync_failed"],
      [{ text: "a" }],
    );
    expect(h.some((x) => x.includes("vocabulary_id"))).toBe(true);
  });

  it("flags openai prompt vocabulary truncation", () => {
    const h = deriveTranscribeHints(
      "openai",
      ["online_vocabulary_truncated_openai_prompt"],
      [{ text: "a" }],
    );
    expect(h.some((x) => x.includes("224") && x.includes("最近更新"))).toBe(true);
  });

  it("flags hotwords ignored", () => {
    const h = deriveTranscribeHints("funasr+x", ["hotwords_ignored_stub"], [{ text: "a" }]);
    expect(h.some((x) => x.includes("热词"))).toBe(true);
  });

  it("flags funasr_skipped", () => {
    const h = deriveTranscribeHints("stub", ["funasr_skipped:funasr_model_not_configured"], []);
    expect(h.some((x) => x.includes("FunASR 未参与"))).toBe(true);
  });

  it("flags stub_no_placeholder_segment", () => {
    const h = deriveTranscribeHints("stub", ["stub_no_placeholder_segment: x"], []);
    expect(h.some((x) => x.includes("未产出语段"))).toBe(true);
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

  it("flags dominant span auto-filter warning", () => {
    const h = deriveTranscribeHints("funasr+x", ["segments_dominant_span_filtered:2"], [
      { text: "分句一" },
      { text: "分句二" },
    ]);
    expect(h.some((x) => x.includes("已自动移除 2 条整轨占位语段"))).toBe(true);
  });

  it("flags whole-track fallback warning", () => {
    const h = deriveTranscribeHints(
      "funasr+iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      ["funasr_whole_track_fallback: x"],
      [
      { text: "你好世界" },
    ]);
    expect(h.some((x) => x.includes("整轨单语段"))).toBe(true);
  });

  it("flags long audio without segments", () => {
    const h = deriveTranscribeHints(
      "funasr+iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      ["funasr_long_audio_no_segments: x"],
      [],
    );
    expect(h.some((x) => x.includes("Paraformer"))).toBe(true);
    expect(h.some((x) => x.includes("未生成任何语段"))).toBe(false);
  });

  it("flags zero segments without stub", () => {
    const h = deriveTranscribeHints("funasr+x", [], []);
    expect(h.some((x) => x.includes("未生成任何语段"))).toBe(true);
  });
});
