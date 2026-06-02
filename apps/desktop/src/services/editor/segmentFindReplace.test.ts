import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../../tauri/projectApi";
import {
  applyReplaceAllToSegments,
  buildFindMatchListItems,
  collectLiteralFindMatches,
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

  it("buildFindMatchListItems includes segment number and time", () => {
    const segments = [seg("制控", 0), seg("其他", 1)];
    segments[0]!.start_sec = 65;
    segments[0]!.end_sec = 70;
    const matches = collectLiteralFindMatches(segments, "制");
    const items = buildFindMatchListItems(segments, matches);
    expect(items[0]?.segmentNumber).toBe(1);
    expect(items[0]?.timeLabel).toBe(formatSegmentTimeLabel(segments[0]!));
    expect(items[0]?.fullText).toBe("制控");
  });
});
