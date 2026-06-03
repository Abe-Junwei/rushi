import { describe, expect, it } from "vitest";
import {
  glossaryBiasFieldHint,
  glossaryBiasSummaryForProviderId,
  vocabularyChannelForProviderId,
} from "./sttVocabularyBias";

describe("sttVocabularyBias", () => {
  it("maps provider ids to vocabulary channels", () => {
    expect(vocabularyChannelForProviderId("openai")).toBe("openAiPrompt");
    expect(vocabularyChannelForProviderId("assemblyai")).toBe("assemblyAiKeyterms");
    expect(vocabularyChannelForProviderId("deepgram")).toBe("deepgramKeywords");
    expect(vocabularyChannelForProviderId("tencent")).toBe("unsupported");
  });

  it("field hints document vendor limits and ordering", () => {
    expect(glossaryBiasFieldHint("openAiPrompt")).toContain("224");
    expect(glossaryBiasFieldHint("openAiPrompt")).toContain("最近更新");
    expect(glossaryBiasFieldHint("assemblyAiKeyterms")).toContain("100");
    expect(glossaryBiasFieldHint("assemblyAiKeyterms")).toContain("custom_spelling");
    expect(glossaryBiasFieldHint("deepgramKeywords")).toContain("50");
  });

  it("summary for supported providers references mapping", () => {
    const s = glossaryBiasSummaryForProviderId("openai");
    expect(s).toContain("prompt");
    expect(s).toContain("224");
  });
});
