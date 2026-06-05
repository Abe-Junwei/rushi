import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../../tauri/projectApi";
import {
  collectStageBEligibleSegmentIndices,
  describeStageBProgress,
  estimateStageBProgressTotal,
  filterTypoOnlyRefineOps,
  isLocalLoopbackRuntimeBridge,
  mapPostTranscribeStageBRefineError,
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

describe("describeStageBProgress", () => {
  it("labels punctuate vs refine phases", () => {
    expect(describeStageBProgress({ done: 2, total: 68, punctuateSteps: 60 })).toMatchObject({
      phaseLabel: "标点",
      detail: "语段 3 / 60",
    });
    expect(describeStageBProgress({ done: 60, total: 68, punctuateSteps: 60 })).toMatchObject({
      phaseLabel: "错字",
      detail: "批次 1 / 8",
    });
  });
});

describe("stage B progress", () => {
  it("includes punctuate steps plus provider-aware refine batches", () => {
    const segments = Array.from({ length: 20 }, (_, i) => ({
      uid: `u${i}`,
      idx: i,
      start_sec: i,
      end_sec: i + 1,
      text: `line ${i}`,
    })) as SegmentDto[];
    const cloudTotal = estimateStageBProgressTotal({ segments, runtime: cloudRuntime });
    expect(cloudTotal).toBe(20 + 2);
    const localTotal = estimateStageBProgressTotal({ segments, runtime: loopbackRuntime });
    expect(localTotal).toBe(20 + 3);
  });
});

describe("mapPostTranscribeStageBRefineError", () => {
  it("rewrites segment-refine wording", () => {
    expect(mapPostTranscribeStageBRefineError(new Error("段界整理请求失败"))).toContain(
      "智能改稿（错字）",
    );
  });
});

describe("filterTypoOnlyRefineOps", () => {
  it("keeps update_text and counts boundary ops", () => {
    const { typoOps, rejectedBoundaryOps } = filterTypoOnlyRefineOps([
      { op: "update_text", uid: "a", text: "新" },
      { op: "merge", uids: ["a", "b"] },
    ]);
    expect(typoOps).toHaveLength(1);
    expect(rejectedBoundaryOps).toBe(1);
  });
});
