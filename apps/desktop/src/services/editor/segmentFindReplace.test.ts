import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../../tauri/projectApi";
import {
  applyReplaceAllToSegments,
  buildFindMatchListItems,
  buildMatchDisplaySnippet,
  buildReplaceAllPreviewRows,
  collectLiteralFindMatches,
  DEFAULT_MATCH_SNIPPET_CONTEXT_CHARS,
  formatSegmentStartTimeLabel,
  formatSegmentTimeLabel,
  replaceOnceInText,
} from "./segmentFindReplace";

function seg(text: string, idx = 0): SegmentDto {
  return {
    uid: `u${idx}`,
    idx,
    start_sec: idx,
    end_sec: idx + 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

describe("segmentFindReplace", () => {
  it("returns no matches for empty query", () => {
    expect(collectLiteralFindMatches([seg("abc")], "")).toEqual([]);
  });

  it("finds non-overlapping literal matches in one segment", () => {
    const matches = collectLiteralFindMatches([seg("aaa")], "aa");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.charStart).toBe(0);
  });

  it("does not overlap matches within a segment", () => {
    const matches = collectLiteralFindMatches([seg("ababab")], "ab");
    expect(matches.map((m) => m.charStart)).toEqual([0, 2, 4]);
  });

  it("skips frozen segments when collecting matches", () => {
    const frozen: SegmentDto = { ...seg("制控", 1), frozen: true };
    const matches = collectLiteralFindMatches([seg("制控", 0), frozen], "制");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.segmentIdx).toBe(0);
  });

  it("replace all updates each segment once per batch", () => {
    const segments = [seg("制控概讲"), seg("制控练习", 1)];
    const query = "制控";
    const replacement = "自控";
    const matches = collectLiteralFindMatches(segments, query);
    const next = applyReplaceAllToSegments(segments, query, replacement, matches);
    expect(next[0]?.text).toBe("自控概讲");
    expect(next[1]?.text).toBe("自控练习");
  });

  it("replaceOnceInText leaves unrelated substrings", () => {
    expect(replaceOnceInText("城市", 1, "市", "镇")).toBe("城镇");
    expect(replaceOnceInText("城市", 0, "城市", "乡镇")).toBe("乡镇");
  });

  it("buildFindMatchListItems includes segment number and time fields", () => {
    const segments = [seg("制控", 0), seg("其他", 1)];
    segments[0].start_sec = 65;
    segments[0].end_sec = 70;
    const matches = collectLiteralFindMatches(segments, "制");
    const items = buildFindMatchListItems(segments, matches);
    expect(items[0]?.segmentNumber).toBe(1);
    expect(items[0]?.timeLabel).toBe(formatSegmentTimeLabel(segments[0]));
    expect(items[0]?.startTimeLabel).toBe(formatSegmentStartTimeLabel(segments[0]));
    expect(items[0]?.fullText).toBe("制控");
    expect(items[0]?.displayText).toBe("制控");
    expect(items[0]?.highlightStart).toBe(0);
    expect(items[0]?.highlightEnd).toBe(1);
  });

  it("buildFindMatchListItems places end-of-segment matches near the display front", () => {
    const prefix = "甲".repeat(DEFAULT_MATCH_SNIPPET_CONTEXT_CHARS + 20);
    const segments = [seg(`${prefix}驾驭`, 0)];
    const matches = collectLiteralFindMatches(segments, "驾驭");
    const items = buildFindMatchListItems(segments, matches);
    expect(items[0]?.displayText.startsWith("…")).toBe(true);
    expect(items[0]?.highlightStart).toBe(1);
    expect(
      items[0]?.displayText.slice(items[0]?.highlightStart ?? 0, items[0]?.highlightEnd ?? 0),
    ).toBe("驾驭");
  });

  it("buildMatchDisplaySnippet centers match at end of long segment", () => {
    const prefix = "甲".repeat(DEFAULT_MATCH_SNIPPET_CONTEXT_CHARS + 5);
    const text = `${prefix}目标词`;
    const start = text.indexOf("目标词");
    const end = start + "目标词".length;
    const snippet = buildMatchDisplaySnippet(text, start, end);
    expect(snippet.displayText).toContain("目标词");
    expect(snippet.displayText.startsWith("…")).toBe(true);
    expect(snippet.displayText.slice(snippet.highlightStart, snippet.highlightEnd)).toBe("目标词");
  });

  it("buildMatchDisplaySnippet uses snippet-relative highlight indices", () => {
    const text = "前言抗美援朝后记";
    const start = text.indexOf("抗美援朝");
    const end = start + "抗美援朝".length;
    const snippet = buildMatchDisplaySnippet(text, start, end, { contextChars: 2 });
    expect(snippet.displayText).toContain("抗美援朝");
    expect(snippet.displayText.slice(snippet.highlightStart, snippet.highlightEnd)).toBe("抗美援朝");
  });

  it("buildMatchDisplaySnippet align start places match near front", () => {
    const prefix = "甲".repeat(DEFAULT_MATCH_SNIPPET_CONTEXT_CHARS + 5);
    const text = `${prefix}目标词后缀文字`;
    const start = text.indexOf("目标词");
    const end = start + "目标词".length;
    const snippet = buildMatchDisplaySnippet(text, start, end, { align: "start" });
    expect(snippet.displayText.startsWith("…")).toBe(true);
    expect(snippet.displayText).toContain("目标词");
    expect(snippet.highlightStart).toBe(1);
    expect(snippet.displayText.slice(snippet.highlightStart, snippet.highlightEnd)).toBe("目标词");
  });

  it("buildReplaceAllPreviewRows exposes before and after snippet highlights", () => {
    const segments = [seg("制控概讲")];
    const matches = collectLiteralFindMatches(segments, "制控");
    const rows = buildReplaceAllPreviewRows(segments, "制控", "自控", matches);
    expect(rows[0]?.beforeDisplayText).toContain("制控");
    expect(
      rows[0]?.beforeDisplayText.slice(
        rows[0]?.beforeHighlightStart ?? 0,
        rows[0]?.beforeHighlightEnd ?? 0,
      ),
    ).toBe("制控");
    expect(rows[0]?.afterDisplayText).toContain("自控");
    expect(
      rows[0]?.afterDisplayText.slice(
        rows[0]?.afterHighlightStart ?? 0,
        rows[0]?.afterHighlightEnd ?? 0,
      ),
    ).toBe("自控");
  });
});
