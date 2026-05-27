import { describe, expect, it } from "vitest";
import {
  formatGlossaryHotwordsTranscribeSummary,
  parseGlossaryHotwordsPreview,
} from "./glossaryHotwords";

describe("glossaryHotwords", () => {
  it("parses tauri camelCase preview payload", () => {
    const p = parseGlossaryHotwordsPreview({
      enabledEntryCount: 2,
      termCount: 4,
      includedTermCount: 4,
      droppedTermCount: 0,
      joinedCharCount: 11,
      submittedCharCount: 11,
      maxChars: 12000,
      truncated: false,
      preview: "三乘 主任 今天 有学",
    });
    expect(p?.termCount).toBe(4);
    expect(p?.enabledEntryCount).toBe(2);
    expect(p?.truncated).toBe(false);
    expect(formatGlossaryHotwordsTranscribeSummary(p)).toContain("4 个热词 token");
  });

  it("parses snake_case preview payload", () => {
    const p = parseGlossaryHotwordsPreview({
      term_count: 3,
      included_term_count: 2,
      dropped_term_count: 1,
      joined_char_count: 13000,
      submitted_char_count: 12000,
      max_chars: 12000,
      truncated: true,
      preview: "foo bar",
    });
    expect(p?.truncated).toBe(true);
    expect(p?.droppedTermCount).toBe(1);
  });

  it("formats empty glossary", () => {
    expect(formatGlossaryHotwordsTranscribeSummary(null)).toContain("无热词 token");
  });

  it("formats truncated summary with token wording", () => {
    const text = formatGlossaryHotwordsTranscribeSummary({
      enabledEntryCount: 10,
      termCount: 10,
      includedTermCount: 8,
      droppedTermCount: 2,
      joinedCharCount: 15000,
      submittedCharCount: 12000,
      maxChars: 12000,
      truncated: true,
      preview: "a b",
    });
    expect(text).toContain("8 个热词 token");
    expect(text).toContain("2 个 token");
    expect(text).toContain("hotwords_truncated_12k");
  });
});
