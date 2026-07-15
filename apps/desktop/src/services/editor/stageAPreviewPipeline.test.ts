import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../../tauri/projectApi";
import { buildStageAPreviewChanges } from "./stageAPreviewPipeline";

describe("stageAPreviewPipeline", () => {
  const segments: SegmentDto[] = [
    { uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "制控　系统。。。" },
    { uid: "s2", idx: 1, start_sec: 1, end_sec: 2, text: "无变化" },
  ];

  it("applies hygiene before rule matching", () => {
    const changes = buildStageAPreviewChanges(segments, [{ wrong: "制控", right: "智控" }]);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.beforeText).toBe("制控　系统。。。");
    expect(changes[0]?.afterText).toBe("智控 系统。");
  });

  it("includes hygiene-only segments when no rules", () => {
    const changes = buildStageAPreviewChanges(segments, []);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.afterText).toBe("制控 系统。");
  });

  it("includes diff highlights for hygiene and rule changes", () => {
    const changes = buildStageAPreviewChanges(segments, [{ wrong: "制控", right: "智控" }]);
    expect(changes[0]?.beforeHighlights.length).toBeGreaterThan(0);
    expect(changes[0]?.afterHighlights.length).toBeGreaterThan(0);
  });
});