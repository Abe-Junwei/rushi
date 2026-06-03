import { describe, expect, it } from "vitest";
import {
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
});

describe("isPunctuationOnlyLineDiff", () => {
  it("detects punct diff", () => {
    expect(isPunctuationOnlyLineDiff("ab", "a，b。")).toBe(true);
  });
});
