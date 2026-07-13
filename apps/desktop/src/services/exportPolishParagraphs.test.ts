import { describe, expect, it } from "vitest";
import {
  buildParagraphsFromBreaks,
  coalesceExportParagraphBreaks,
  EXPORT_POLISH_MAX_PARAGRAPH_GRAPHEMES,
} from "./exportPolishParagraphs";

describe("coalesceExportParagraphBreaks", () => {
  it("keeps semantic breaks that form readable paragraphs", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `语段${i}内容若干字`);
    const breaks = coalesceExportParagraphBreaks(lines, [1, 2, 3, 10, 11]);
    expect(breaks).toContain(10);
    // 过碎断点（本段字数过少）被合并
    expect(breaks).not.toContain(2);
  });

  it("forces breaks so paragraphs stay near the grapheme cap", () => {
    // 每行约 50 字 → 超过 300 字应切开
    const chunk = "甲".repeat(50);
    const lines = Array.from({ length: 10 }, () => chunk);
    const breaks = coalesceExportParagraphBreaks(lines, []);
    const paras = buildParagraphsFromBreaks(lines, breaks);
    for (const p of paras) {
      // 单行本身不超过上限时，合并段不应明显超过上限+一行
      expect(p.length).toBeLessThanOrEqual(EXPORT_POLISH_MAX_PARAGRAPH_GRAPHEMES + 50);
    }
    expect(paras.length).toBeGreaterThan(1);
  });

  it("no longer caps total paragraphs at 12", () => {
    // 每行 100 字、无语义断点 → 仅靠 300 字上限也会切出 >12 段
    const lines = Array.from({ length: 40 }, () => "字".repeat(100));
    const breaks = coalesceExportParagraphBreaks(lines, []);
    expect(breaks.length).toBeGreaterThan(11);
    const paras = buildParagraphsFromBreaks(lines, breaks);
    expect(paras.length).toBeGreaterThan(12);
  });
});

describe("buildParagraphsFromBreaks", () => {
  it("joins lines between breaks", () => {
    expect(buildParagraphsFromBreaks(["A", "B", "C"], [0])).toEqual(["A", "BC"]);
  });
});
