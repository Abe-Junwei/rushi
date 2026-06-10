import { describe, expect, it } from "vitest";
import {
  classifyStageBEvidenceFlags,
  classifyStageBSegmentChangeFlags,
  evidenceKindLabel,
  formatStageBEvidenceSummary,
  parseRuleEvidenceRef,
} from "./postprocessLexiconOps";
import type { GroundedLexiconOp } from "../../tauri/postprocessApi";

describe("postprocessLexiconOps", () => {
  it("labels evidence kinds", () => {
    expect(evidenceKindLabel("punctuation")).toBe("标点");
    expect(evidenceKindLabel("rule")).toBe("纠错记忆");
    expect(evidenceKindLabel("glossary")).toBe("术语表");
    expect(evidenceKindLabel("llm_homophone")).toBe("同音推测");
  });

  it("formats evidence summary", () => {
    expect(formatStageBEvidenceSummary({ type: "rule", ref: "错→对" })).toBe("纠错记忆 · 错→对");
  });

  it("parses rule evidence ref", () => {
    expect(parseRuleEvidenceRef("安波那那→安那般那")).toEqual({
      before: "安波那那",
      after: "安那般那",
    });
  });

  it("classifies punct vs typo flags", () => {
    expect(classifyStageBEvidenceFlags({ type: "punctuation", ref: "补标点" })).toEqual({
      punctuateTouched: true,
      typoTouched: false,
    });
    expect(classifyStageBEvidenceFlags({ type: "glossary", ref: "觉观" })).toEqual({
      punctuateTouched: false,
      typoTouched: true,
    });
  });

  it("labels segment change from diff not mis-tagged evidence", () => {
    const evidenceItems = [
      {
        uid: "a",
        text: "你好，世界。",
        evidence: { type: "rule", ref: "智控→制控" },
      },
    ] satisfies GroundedLexiconOp[];
    expect(
      classifyStageBSegmentChangeFlags("你好世界", "你好，世界。", evidenceItems),
    ).toEqual({
      punctuateTouched: true,
      typoTouched: false,
      evidenceSummary: null,
    });
  });
});
