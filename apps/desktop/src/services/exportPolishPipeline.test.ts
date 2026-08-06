import { describe, expect, it } from "vitest";
import {
  applyPunctuationOnlyExportPolish,
  exportPolishLinesPreserveTrustedContent,
  isPunctuationOnlyLineDiff,
  lineEligibleForExportTrack,
} from "./exportPolishPipeline";

describe("applyPunctuationOnlyExportPolish", () => {
  it("accepts punctuation and whitespace changes", () => {
    const result = applyPunctuationOnlyExportPolish(
      ["你好世界", "甲 乙"],
      ["你好，世界。", "甲\n乙！"],
      true,
      [],
    );
    expect(result).toEqual({
      lines: ["你好，世界。", "甲\n乙！"],
      revertedContentLines: 0,
      revertedContentLineIndices: [],
      contractFallback: false,
      contractFallbackLineIndices: [],
    });
  });

  it("reverts a long mid-line deletion", () => {
    const trusted = "开场先说纪律。学校主要是留守儿童，人生前景需要认真对待。然后继续下一议题。";
    const candidate = "开场先说纪律。然后继续下一议题。";
    expect(applyPunctuationOnlyExportPolish([trusted], [candidate], true, []).lines).toEqual([
      trusted,
    ]);
  });

  it("reverts a short equal-length rewrite", () => {
    expect(
      applyPunctuationOnlyExportPolish(["留守儿童"], ["人生前景"], true, []),
    ).toMatchObject({
      lines: ["留守儿童"],
      revertedContentLines: 1,
      revertedContentLineIndices: [0],
      contractFallback: false,
    });
  });

  it("falls back all trusted lines when the id contract is invalid", () => {
    expect(
      applyPunctuationOnlyExportPolish(["甲", "乙"], ["甲。", "乙。"], false, []),
    ).toEqual({
      lines: ["甲", "乙"],
      revertedContentLines: 0,
      revertedContentLineIndices: [],
      contractFallback: true,
      contractFallbackLineIndices: [0, 1],
    });
  });

  it("preserves valid-batch punctuation when another batch falls back", () => {
    expect(
      applyPunctuationOnlyExportPolish(
        ["第一批", "第二批"],
        ["第一批。", "第二批"],
        false,
        [1],
      ),
    ).toEqual({
      lines: ["第一批。", "第二批"],
      revertedContentLines: 0,
      revertedContentLineIndices: [],
      contractFallback: true,
      contractFallbackLineIndices: [1],
    });
  });

  it("falls back all trusted lines when the line count differs", () => {
    expect(applyPunctuationOnlyExportPolish(["甲", "乙"], ["甲。"], true, []).lines).toEqual([
      "甲",
      "乙",
    ]);
  });

  it("uses locally corrected text as the trusted baseline", () => {
    expect(applyPunctuationOnlyExportPolish(["觉观"], ["觉观。"], true, []).lines).toEqual([
      "觉观。",
    ]);
  });
});

describe("exportPolishLinesPreserveTrustedContent", () => {
  it("accepts punctuation-only output and rejects any body change", () => {
    expect(exportPolishLinesPreserveTrustedContent(["甲乙"], ["甲，乙。"])).toBe(true);
    expect(exportPolishLinesPreserveTrustedContent(["甲乙"], ["甲丙。"])).toBe(false);
    expect(exportPolishLinesPreserveTrustedContent(["甲", "乙"], ["甲。"])).toBe(false);
  });
});

describe("lineEligibleForExportTrack", () => {
  it("allows punctuation-only", () => {
    expect(lineEligibleForExportTrack("你好", "你好。")).toBe(true);
  });

  it("allows small typo", () => {
    expect(lineEligibleForExportTrack("辛库", "辛苦")).toBe(true);
  });

  it("skips large rewrite", () => {
    expect(
      lineEligibleForExportTrack(
        "嗯那个我们今天呢就来说一下",
        "今天我们讨论这个问题。",
      ),
    ).toBe(false);
  });

  it("rejects mid-line sentence deletion even when relative edit distance is small", () => {
    const head = "今天我们开会讨论产品路线和排期，";
    const mid = "这一点非常重要必须讲清楚，";
    const tail = "然后继续看下一议题。";
    const before = `${head}${mid}${tail}`;
    const after = `${head}${tail}`;
    // ~20% 删除，但旧门禁 dist/maxLen≤12% 在部分长行上仍可能放行；净删门禁应挡住。
    expect(lineEligibleForExportTrack(before, after)).toBe(false);
  });

  it("rejects long-line mid deletion that stays under the old 12% distance gate", () => {
    // 实录形态：长语段中挖掉一句；相对编辑距离可 ≤12%，旧门禁会放行。
    const pad =
      "他原来在公司里呢就特别忙累得半死后来经过调整状态好多了我们继续说下去啊对吧然后呢";
    const head = pad.repeat(3);
    const mid = "他是一个小公司每天晚上都要工作到八九点才能下班";
    const tail = pad.repeat(3);
    const before = `${head}${mid}${tail}`;
    const after = `${head}${tail}`;
    const maxLen = Math.max(before.length, after.length, 1);
    const approxDist = mid.length;
    expect(approxDist / maxLen).toBeLessThanOrEqual(0.12);
    expect(lineEligibleForExportTrack(before, after)).toBe(false);
  });
});

describe("isPunctuationOnlyLineDiff", () => {
  it("detects punct diff", () => {
    expect(isPunctuationOnlyLineDiff("ab", "a，b。")).toBe(true);
  });
});
