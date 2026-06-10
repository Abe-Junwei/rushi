import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../../tauri/projectApi";
import {
  collectStageBEligibleSegmentIndices,
  describeStageBDropSummary,
  describeStageBPreviewSummary,
  describeStageBProgress,
  estimateStageBProgressTotal,
  isLocalLoopbackRuntimeBridge,
  mapPostTranscribeStageBProofreadError,
  planStageBRefineChunks,
  resolveStageBRefineBatchLimits,
  STAGE_B_REFINE_CLOUD_MAX_CHARS,
  STAGE_B_REFINE_CLOUD_MAX_SEGMENTS,
  STAGE_B_REFINE_LOCAL_MAX_CHARS,
  STAGE_B_REFINE_LOCAL_MAX_SEGMENTS,
} from "./postTranscribeStageB";
import { OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY } from "./llmProviderCatalog";
import type { RefineSegmentItem } from "./postprocessSegmentOps";

const loopbackRuntime = {
  provider: "Ollama",
  baseUrl: "http://127.0.0.1:11434/v1",
  model: "qwen2.5",
  apiKey: OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY,
  allowInsecureHttp: true,
};

const cloudRuntime = {
  provider: "DeepSeek",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  apiKeyId: "sk-test",
};

function refineItem(uid: string, text: string): RefineSegmentItem {
  return { uid, startSec: 0, endSec: 1, text };
}

describe("stage B refine batch limits", () => {
  it("detects loopback runtime bridge", () => {
    expect(isLocalLoopbackRuntimeBridge(loopbackRuntime)).toBe(true);
    expect(isLocalLoopbackRuntimeBridge(cloudRuntime)).toBe(false);
  });

  it("uses smaller batches for loopback than cloud", () => {
    expect(resolveStageBRefineBatchLimits(loopbackRuntime)).toEqual({
      maxSegments: STAGE_B_REFINE_LOCAL_MAX_SEGMENTS,
      maxChars: STAGE_B_REFINE_LOCAL_MAX_CHARS,
    });
    expect(resolveStageBRefineBatchLimits(cloudRuntime)).toEqual({
      maxSegments: STAGE_B_REFINE_CLOUD_MAX_SEGMENTS,
      maxChars: STAGE_B_REFINE_CLOUD_MAX_CHARS,
    });
  });
});

describe("stage B eligible segments", () => {
  it("includes all segments with non-empty text", () => {
    const segments = Array.from({ length: 75 }, (_, i) => ({
      uid: `u${i}`,
      text: i % 5 === 0 ? "" : `line ${i}`,
    })) as SegmentDto[];
    expect(collectStageBEligibleSegmentIndices(segments)).toHaveLength(60);
  });
});

describe("planStageBRefineChunks", () => {
  it("caps cloud batches at 16 short segments", () => {
    const items = Array.from({ length: 20 }, (_, i) => refineItem(`u${i}`, `t${i}`));
    const chunks = planStageBRefineChunks(items, resolveStageBRefineBatchLimits(cloudRuntime));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(16);
    expect(chunks[1]).toHaveLength(4);
  });

  it("caps local batches at 8 short segments", () => {
    const items = Array.from({ length: 10 }, (_, i) => refineItem(`u${i}`, `t${i}`));
    const chunks = planStageBRefineChunks(items, resolveStageBRefineBatchLimits(loopbackRuntime));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(8);
    expect(chunks[1]).toHaveLength(2);
  });

  it("splits by char budget before segment cap", () => {
    const items = [
      refineItem("a", "x".repeat(1500)),
      refineItem("b", "y".repeat(1500)),
      refineItem("c", "z".repeat(500)),
    ];
    const chunks = planStageBRefineChunks(items, resolveStageBRefineBatchLimits(loopbackRuntime));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.map((x) => x.uid)).toEqual(["a", "b"]);
    expect(chunks[1]?.map((x) => x.uid)).toEqual(["c"]);
  });

  it("keeps an oversized single segment in its own batch", () => {
    const items = [refineItem("a", "x".repeat(STAGE_B_REFINE_LOCAL_MAX_CHARS + 500))];
    const chunks = planStageBRefineChunks(items, resolveStageBRefineBatchLimits(loopbackRuntime));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(1);
  });
});

describe("describeStageBPreviewSummary", () => {
  it("returns headline and operator hint for preview list", () => {
    const summary = describeStageBPreviewSummary(7);
    expect(summary.headline).toBe("共 7 条语段有改稿建议");
    expect(summary.hint).toContain("暖色高亮");
    expect(summary.hint).toContain("确认写回");
  });
});

describe("describeStageBProgress", () => {
  it("labels merged proofread batches with aligned step counts", () => {
    expect(describeStageBProgress({ done: 3, total: 25 })).toEqual({
      phaseLabel: "智能改稿",
      detail: "批次 4 / 25",
      percent: 12,
      stepDone: 4,
      stepTotal: 25,
    });
    expect(describeStageBProgress({ done: 0, total: 1 }).percent).toBe(0);
    expect(describeStageBProgress({ done: 1, total: 1 }).percent).toBe(100);
  });
});

describe("stage B progress", () => {
  it("uses provider-aware batch count only", () => {
    const segments = Array.from({ length: 20 }, (_, i) => ({
      uid: `u${i}`,
      idx: i,
      start_sec: i,
      end_sec: i + 1,
      text: `line ${i}`,
    })) as SegmentDto[];
    const cloudTotal = estimateStageBProgressTotal({ segments, runtime: cloudRuntime });
    expect(cloudTotal).toBe(2);
    const localTotal = estimateStageBProgressTotal({ segments, runtime: loopbackRuntime });
    expect(localTotal).toBe(3);
  });
});

describe("describeStageBDropSummary", () => {
  it("breaks down ignored reasons and excludes unchanged", () => {
    const out = describeStageBDropSummary({
      parseMalformed: 2,
      unchanged: 120,
      invalid: 1,
      ungrounded: 30,
      evidenceMismatch: 7,
      llmHomophone: 12,
    });
    expect(out.ignoredCount).toBe(40);
    expect(out.detail).toContain("JSON 结构不完整 2 条");
    expect(out.detail).toContain("同音推测已列入候选");
    expect(out.detail).toContain("另有 120 条 LLM 返回但未改动正文");
  });
});

describe("mapPostTranscribeStageBProofreadError", () => {
  it("rewrites legacy wording", () => {
    expect(mapPostTranscribeStageBProofreadError(new Error("段界整理请求失败"))).toContain("智能改稿");
    expect(mapPostTranscribeStageBProofreadError(new Error("自动标点返回内容为空"))).toContain("智能改稿");
    expect(mapPostTranscribeStageBProofreadError(new Error("智能改稿请求已取消"))).toBe(
      "智能改稿请求已取消",
    );
  });
});
