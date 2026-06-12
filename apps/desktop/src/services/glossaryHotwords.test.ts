import { describe, expect, it } from "vitest";
import {
  formatGlossaryHotwordsPreflightLine,
  formatGlossaryHotwordsTranscribeSummary,
  parseGlossaryHotwordsPreview,
} from "./glossaryHotwords";

const samplePreview = {
  enabledEntryCount: 2,
  termCount: 4,
  includedTermCount: 4,
  droppedTermCount: 0,
  joinedCharCount: 11,
  submittedCharCount: 11,
  maxChars: 12000,
  truncated: false,
  preview: "三乘 主任 今天 有学",
};

describe("glossaryHotwords", () => {
  it("parses tauri camelCase preview payload", () => {
    const p = parseGlossaryHotwordsPreview(samplePreview);
    expect(p?.termCount).toBe(4);
    expect(p?.enabledEntryCount).toBe(2);
    expect(p?.truncated).toBe(false);
    expect(formatGlossaryHotwordsTranscribeSummary(p)).toContain("自动转录时将提交 4 个热词");
    expect(formatGlossaryHotwordsPreflightLine(p)).toBe("将携带 4 个热词（2 条词条）。");
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
    expect(formatGlossaryHotwordsTranscribeSummary(null)).toContain("不会携带术语表");
    expect(formatGlossaryHotwordsPreflightLine(null)).toBeNull();
  });

  it("formats glossary with entries but none enabled for hotwords", () => {
    const text = formatGlossaryHotwordsTranscribeSummary({
      enabledEntryCount: 0,
      termCount: 0,
      includedTermCount: 0,
      droppedTermCount: 0,
      joinedCharCount: 0,
      submittedCharCount: 0,
      maxChars: 12000,
      truncated: false,
      preview: "",
    });
    expect(text).toContain("无词条纳入热词");
    expect(text).toContain("纳入下次转写");
  });

  it("formats truncated summary without internal warning codes", () => {
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
    expect(text).toContain("8 个热词");
    expect(text).toContain("2 个热词因超出上限未纳入");
    expect(text).not.toContain("hotwords_truncated_12k");
    expect(formatGlossaryHotwordsPreflightLine({
      enabledEntryCount: 10,
      termCount: 10,
      includedTermCount: 8,
      droppedTermCount: 2,
      joinedCharCount: 15000,
      submittedCharCount: 12000,
      maxChars: 12000,
      truncated: true,
      preview: "a b",
    })).toContain("另有 2 个因超出上限未纳入");
  });
});
