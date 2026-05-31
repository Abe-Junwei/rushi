import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  AUTO_PUNCTUATE_NEIGHBOR_SNIPPET_MAX,
  collectAutoPunctuateNeighborContext,
  neighborContextSummary,
} from "./autoPunctuateNeighbors";

function seg(text: string): SegmentDto {
  return {
    uid: "u",
    idx: 0,
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

describe("collectAutoPunctuateNeighborContext", () => {
  it("returns prev and next when both have text", () => {
    const segments = [seg("前段"), seg("当前"), seg("后段")];
    const ctx = collectAutoPunctuateNeighborContext(segments, 1);
    expect(ctx).toEqual([
      { role: "prev", text: "前段" },
      { role: "next", text: "后段" },
    ]);
    expect(neighborContextSummary(ctx)).toBe("含邻段上下文（上一语段、下一语段）");
  });

  it("skips empty neighbors and truncates long snippets", () => {
    const long = "长".repeat(AUTO_PUNCTUATE_NEIGHBOR_SNIPPET_MAX + 10);
    const segments = [seg(""), seg("当前"), seg(long)];
    const ctx = collectAutoPunctuateNeighborContext(segments, 1);
    expect(ctx).toHaveLength(1);
    expect(ctx[0]?.role).toBe("next");
    expect(ctx[0]?.text.endsWith("…")).toBe(true);
    expect(ctx[0]?.text.length).toBe(AUTO_PUNCTUATE_NEIGHBOR_SNIPPET_MAX + 1);
  });
});
