import { describe, expect, it } from "vitest";
import {
  computeSingleTextDiff,
  extractSingleTextDiffParts,
  highlightTextByDiff,
} from "./textDiff";

describe("computeSingleTextDiff", () => {
  it("returns empty when texts match", () => {
    expect(computeSingleTextDiff("你好", "你好")).toEqual([]);
  });

  it("marks punctuation append as insert", () => {
    expect(computeSingleTextDiff("你好世界", "你好，世界。")).toEqual([
      { start: 2, end: 6, kind: "replace" },
    ]);
  });

  it("extracts replace parts when no shared char inside span", () => {
    expect(extractSingleTextDiffParts("三千年前", "三天年前")).toEqual({
      prefix: "三",
      removed: "千",
      inserted: "天",
      suffix: "年前",
      kind: "replace",
    });
  });

  it("highlights changed range in candidate text", () => {
    const parts = highlightTextByDiff("你好，世界。", [
      { start: 2, end: 5, kind: "replace" },
    ]);
    expect(parts).toEqual([
      { text: "你好", highlight: false },
      { text: "，世界", highlight: true },
      { text: "。", highlight: false },
    ]);
  });
});
