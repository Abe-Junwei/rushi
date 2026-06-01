import { describe, expect, it } from "vitest";
import {
  glossaryBiasFieldHint,
  providerSupportsGlossaryBias,
  vocabularyChannelForProviderId,
} from "./sttVocabularyBias";

describe("sttVocabularyBias", () => {
  it("maps v1 glossary-capable providers", () => {
    expect(vocabularyChannelForProviderId("openai")).toBe("openAiPrompt");
    expect(vocabularyChannelForProviderId("assemblyai")).toBe("assemblyAiKeyterms");
    expect(vocabularyChannelForProviderId("deepgram")).toBe("deepgramKeywords");
    expect(vocabularyChannelForProviderId("custom-proxy")).toBe("genericMultipartHotwords");
  });

  it("marks domestic native adapters unsupported for glossary bias", () => {
    expect(providerSupportsGlossaryBias("tencent-asr")).toBe(false);
    expect(providerSupportsGlossaryBias("baidu-speech")).toBe(false);
    expect(vocabularyChannelForProviderId("aliyun-nls")).toBe("unsupported");
  });

  it("exposes field hints for supported channels", () => {
    expect(glossaryBiasFieldHint("openAiPrompt")).toContain("prompt");
    expect(glossaryBiasFieldHint("unsupported")).toBe("");
  });
});
