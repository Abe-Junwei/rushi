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

/** Mirrors `docs/execution/specs/asr-voc-1-hand-test-checklist.md` §1–§3. */
describe("VOC-1 hand-test sign-off (contract)", () => {
  it("§1 Paraformer + 2 enabled terms → hotwords summary + multipart line", () => {
    const hotwords: GlossaryHotwordsPreview = {
      enabledEntryCount: 2,
      termCount: 2,
      includedTermCount: 2,
      droppedTermCount: 0,
      joinedCharCount: 8,
      submittedCharCount: 8,
      maxChars: 12000,
      truncated: false,
      preview: "制控 禅修",
    };
    const s = buildTranscribeVocabularyPreflightSummary({
      hotwords,
      hubModelId:
        "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      isOnlineMode: false,
      onlineProviderId: null,
    });
    const lines = formatTranscribeVocabularyPreflightLines(s);
    expect(s.localSkuLabel).toContain("Paraformer");
    expect(lines.some((l) => l.includes("2 个热词 token") && l.includes("2 条已纳入"))).toBe(true);
    expect(lines.some((l) => l.includes("multipart hotwords"))).toBe(true);
    expect(s.localHotwordNote).toBeNull();
  });

  it("§2 unsupported online provider + terms → 不支持说明（不阻断转写门闸）", () => {
    const s = buildTranscribeVocabularyPreflightSummary({
      hotwords: sampleHotwords,
      hubModelId: "iic/SenseVoiceSmall",
      isOnlineMode: true,
      onlineProviderId: "tencent-asr",
    });
    const lines = formatTranscribeVocabularyPreflightLines(s);
    expect(s.onlineChannel).toBe("unsupported");
    expect(lines.some((l) => l.includes("不支持"))).toBe(true);
    expect(lines.some((l) => l.includes("转写仍可进行"))).toBe(true);
  });

  it("§3 SenseVoice + terms → weak hotword note", () => {
    const s = buildTranscribeVocabularyPreflightSummary({
      hotwords: sampleHotwords,
      hubModelId: "iic/SenseVoiceSmall",
      isOnlineMode: false,
      onlineProviderId: null,
    });
    const lines = formatTranscribeVocabularyPreflightLines(s);
    expect(s.localHotwordNote).toContain("SenseVoice");
    expect(s.localHotwordNote).toContain("Paraformer");
    expect(lines.some((l) => l.includes(s.localHotwordNote!))).toBe(true);
  });
});

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
