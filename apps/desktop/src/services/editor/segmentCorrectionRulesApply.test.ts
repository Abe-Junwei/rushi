import { describe, expect, it } from "vitest";
import { applyCorrectionRulesToText, buildSegmentCorrectionChanges } from "./segmentCorrectionRulesApply";
import type { SegmentDto } from "../../tauri/projectApi";

describe("applyCorrectionRulesToText", () => {
  it("does not apply single-char wrong inside longer word (城市 vs 市)", () => {
    const { text, count } = applyCorrectionRulesToText("城市", [{ wrong: "市", right: "镇" }]);
    expect(text).toBe("城市");
    expect(count).toBe(0);
  });

  it("applies longer wrong first", () => {
    const { text, count } = applyCorrectionRulesToText("城市市中心", [
      { wrong: "城市", right: "城镇" },
      { wrong: "市中心", right: "中心" },
    ]);
    expect(count).toBeGreaterThan(0);
    expect(text).not.toContain("城市");
  });

  it("replaces stable typo pair", () => {
    const { text, count } = applyCorrectionRulesToText("安波那那开示", [
      { wrong: "安波那那", right: "安那般那" },
    ]);
    expect(text).toBe("安那般那开示");
    expect(count).toBe(1);
  });

  it("records separate highlight spans for multiple replacements in apply scan", () => {
    const { text, beforeHighlights, afterHighlights, count } = applyCorrectionRulesToText("智控与系统", [
      { wrong: "智控", right: "制控" },
      { wrong: "系统", right: "体系" },
    ]);
    expect(count).toBe(2);
    expect(text).toBe("制控与体系");
    expect(beforeHighlights).toEqual([
      { startG: 0, endG: 2 },
      { startG: 3, endG: 5 },
    ]);
    expect(afterHighlights).toEqual([
      { startG: 0, endG: 2 },
      { startG: 3, endG: 5 },
    ]);
  });

  it("buildSegmentCorrectionChanges uses diff-based preview highlights", () => {
    const segments: SegmentDto[] = [{ uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "第二个要素是智控。" }];
    const changes = buildSegmentCorrectionChanges(segments, [{ wrong: "智控", right: "制控" }]);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.beforeHighlights).toEqual([{ startG: 6, endG: 7 }]);
    expect(changes[0]?.afterHighlights).toEqual([{ startG: 6, endG: 7 }]);
  });
});
