import { describe, expect, it } from "vitest";
import {
  buildTranscribeVocabularyPreflightSummary,
  formatTranscribeVocabularyPreflightLines,
} from "./transcribeVocabularyPreflight";
import type { GlossaryHotwordsPreview } from "../glossaryHotwords";

const sampleHotwords: GlossaryHotwordsPreview = {
  enabledEntryCount: 2,
  termCount: 3,
  includedTermCount: 3,
  droppedTermCount: 0,
  joinedCharCount: 20,
  submittedCharCount: 20,
  maxChars: 12000,
  truncated: false,
  preview: "制控 禅修",
};

describe("transcribeVocabularyPreflight", () => {
  it("local Paraformer shows hotword submit line", () => {
    const s = buildTranscribeVocabularyPreflightSummary({
      hotwords: sampleHotwords,
      hubModelId: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      isOnlineMode: false,
      onlineProviderId: null,
    });
    const lines = formatTranscribeVocabularyPreflightLines(s);
    expect(s.localSkuLabel).toContain("Paraformer");
    expect(lines.some((l) => l.includes("hotwords"))).toBe(true);
    expect(s.localHotwordNote).toBeNull();
  });

  it("local SenseVoice with hotwords adds weak bias note", () => {
    const s = buildTranscribeVocabularyPreflightSummary({
      hotwords: sampleHotwords,
      hubModelId: "iic/SenseVoiceSmall",
      isOnlineMode: false,
      onlineProviderId: null,
    });
    expect(s.localHotwordNote).toContain("SenseVoice");
  });

  it("online unsupported provider surfaces bias summary", () => {
    const s = buildTranscribeVocabularyPreflightSummary({
      hotwords: sampleHotwords,
      hubModelId: "iic/SenseVoiceSmall",
      isOnlineMode: true,
      onlineProviderId: "tencent-asr",
    });
    const lines = formatTranscribeVocabularyPreflightLines(s);
    expect(s.onlineChannel).toBe("unsupported");
    expect(lines.some((l) => l.includes("不支持"))).toBe(true);
  });

  it("empty enabled entries show empty glossary hint", () => {
    const s = buildTranscribeVocabularyPreflightSummary({
      hotwords: { ...sampleHotwords, enabledEntryCount: 0, termCount: 0, includedTermCount: 0 },
      hubModelId: "iic/SenseVoiceSmall",
      isOnlineMode: false,
      onlineProviderId: null,
    });
    expect(s.emptyGlossaryHint).toContain("词汇表为空");
  });
});
