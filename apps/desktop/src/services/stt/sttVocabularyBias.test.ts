import { describe, expect, it } from "vitest";
import {
  glossaryBiasFieldHint,
  glossaryBiasPreflightLineForProviderId,
  glossaryBiasSummaryForProviderId,
  vocabularyChannelForProviderId,
} from "./sttVocabularyBias";

describe("sttVocabularyBias", () => {
  it("maps provider ids to vocabulary channels", () => {
    expect(vocabularyChannelForProviderId("openai")).toBe("openAiPrompt");
    expect(vocabularyChannelForProviderId("assemblyai")).toBe("assemblyAiKeyterms");
    expect(vocabularyChannelForProviderId("deepgram")).toBe("deepgramKeywords");
    expect(vocabularyChannelForProviderId("dashscope-asr")).toBe("dashScopeVocabulary");
    expect(vocabularyChannelForProviderId("iflytek-speed-asr")).toBe("xunfeiSpeedAsrHotword");
    expect(vocabularyChannelForProviderId("tencent")).toBe("unsupported");
  });

  it("field hints document vendor limits and ordering", () => {
    expect(glossaryBiasFieldHint("openAiPrompt")).toContain("224");
    expect(glossaryBiasFieldHint("openAiPrompt")).toContain("最近更新");
    expect(glossaryBiasFieldHint("assemblyAiKeyterms")).toContain("100");
    expect(glossaryBiasFieldHint("assemblyAiKeyterms")).toContain("识别偏置");
    expect(glossaryBiasFieldHint("deepgramKeywords")).toContain("50");
  });

  it("summary for supported providers references mapping", () => {
    const s = glossaryBiasSummaryForProviderId("openai");
    expect(s).toContain("转写提示词");
    expect(s).toContain("224");
  });

  it("preflight line uses plain language for transcribe UI", () => {
    expect(glossaryBiasPreflightLineForProviderId("dashscope-asr")).toBe("在线百炼：术语同步为厂商热词表。");
    expect(glossaryBiasPreflightLineForProviderId("iflytek-speed-asr")).toBe(
      "在线讯飞极速大模型：术语将作为转写热词提交。",
    );
    expect(glossaryBiasPreflightLineForProviderId("openai")).toContain("在线 OpenAI");
    expect(glossaryBiasPreflightLineForProviderId("tencent")).toContain("不支持术语表");
  });
});
