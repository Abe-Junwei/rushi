import { describe, expect, it } from "vitest";
import {
  clampExportPolishLinesToEligible,
  isPunctuationOnlyLineDiff,
  lineEligibleForExportTrack,
  reconcileLlmPolishLines,
} from "./exportPolishPipeline";

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
    expect(clampExportPolishLinesToEligible([before], [after])).toEqual([before]);
  });
});

describe("clampExportPolishLinesToEligible", () => {
  it("keeps typo and punct fixes, reverts rewrites in final lines", () => {
    const before = ["辛库", "你好", "嗯那个我们今天呢就来说一下"];
    const after = ["辛苦", "你好。", "今天我们讨论这个问题。"];
    expect(clampExportPolishLinesToEligible(before, after)).toEqual([
      "辛苦",
      "你好。",
      "嗯那个我们今天呢就来说一下",
    ]);
  });

  it("reverts scattered mid-paragraph deletions that would drop original sentences", () => {
    const before = [
      "开场先说纪律。我们把禅堂看得比殿堂还要重。虽然条件简陋，但对学修很投入。",
      "第二段保持不变。",
    ];
    const after = [
      "开场先说纪律。虽然条件简陋，但对学修很投入。",
      "第二段保持不变。",
    ];
    expect(clampExportPolishLinesToEligible(before, after)).toEqual(before);
  });
});

describe("reconcileLlmPolishLines", () => {
  it("pads when llm has fewer lines", () => {
    const before = Array.from({ length: 6 }, (_, i) => `语段${i}`);
    const llm = before.slice(0, 5).map((t) => `${t}。`);
    const { lines, stats } = reconcileLlmPolishLines(before, llm);
    expect(lines).toHaveLength(6);
    expect(lines[5]).toBe("语段5");
    expect(stats.paddedLineIndices).toEqual([5]);
  });

  it("merges extra llm lines into last segment without dropping chars", () => {
    const before = ["第一段", "第二\n段"];
    const llm = ["第一段。", "第二", "段。"];
    const { lines } = reconcileLlmPolishLines(before, llm);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("第一段。");
    expect(lines[1]).toBe("第二段。");
  });
});

describe("isPunctuationOnlyLineDiff", () => {
  it("detects punct diff", () => {
    expect(isPunctuationOnlyLineDiff("ab", "a，b。")).toBe(true);
  });
});
