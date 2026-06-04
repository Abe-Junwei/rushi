import { describe, expect, it } from "vitest";
import {
  buildTranscribeVocabularyPreflightSummary,
  formatTranscribeVocabularyPreflightLines,
} from "./transcribeVocabularyPreflight";
import { DEFAULT_LOCAL_ASR_HUB_MODEL_ID } from "./localAsrModelCatalog";
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

/** Mirrors `docs/execution/specs/asr-voc-1-hand-test-checklist.md` §1–§2. */
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
      hubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
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
      hubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      isOnlineMode: true,
      onlineProviderId: "tencent-asr",
    });
    const lines = formatTranscribeVocabularyPreflightLines(s);
    expect(s.onlineChannel).toBe("unsupported");
    expect(lines.some((l) => l.includes("不支持"))).toBe(true);
    expect(lines.some((l) => l.includes("转写仍可进行"))).toBe(true);
  });
});

describe("transcribeVocabularyPreflight", () => {
  it("local Paraformer shows hotword submit line", () => {
    const s = buildTranscribeVocabularyPreflightSummary({
      hotwords: sampleHotwords,
      hubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      isOnlineMode: false,
      onlineProviderId: null,
    });
    const lines = formatTranscribeVocabularyPreflightLines(s);
    expect(s.localSkuLabel).toContain("Paraformer");
    expect(lines.some((l) => l.includes("hotwords"))).toBe(true);
    expect(s.localHotwordNote).toBeNull();
  });

  it("deprecated SenseVoice hub id resolves to Paraformer without weak hotword note", () => {
    const s = buildTranscribeVocabularyPreflightSummary({
      hotwords: sampleHotwords,
      hubModelId: "iic/SenseVoiceSmall",
      isOnlineMode: false,
      onlineProviderId: null,
    });
    expect(s.localSkuLabel).toContain("Paraformer");
    expect(s.localHotwordNote).toBeNull();
  });

  it("online unsupported provider surfaces bias summary", () => {
    const s = buildTranscribeVocabularyPreflightSummary({
      hotwords: sampleHotwords,
      hubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
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
      hubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      isOnlineMode: false,
      onlineProviderId: null,
    });
    expect(s.emptyGlossaryHint).toContain("暂无纳入热词");
  });
});
