import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPORT_POLISH_LINE_SEPARATOR,
  exportPolishSnapshotUids,
  joinSegmentTextsForExportPolish,
  splitExportPolishJoinedBody,
} from "./exportDocxPolish.helpers";
import {
  exportModeRequiresLlmPolish,
  exportModeSupportsLlmPolish,
  exportWantsLlmPolish,
  fetchExportLectureOptimizeResult,
  fetchExportPolishResult,
  resolveExportPolishBlockReason,
} from "./exportDocxPolish";
import type { SegmentDto } from "../tauri/projectApi";
import { tryBuildPostprocessRuntimeBridge } from "./postprocess/postprocessRuntimeContract";
import { postprocessExportPolish } from "../tauri/postprocessApi";
import { correctionStableRulesList } from "../tauri/correctionApi";
import { glossaryList } from "../tauri/glossaryApi";

vi.mock("../tauri/postprocessApi", () => ({
  postprocessExportPolish: vi.fn(),
}));

vi.mock("../tauri/correctionApi", () => ({
  correctionStableRulesList: vi.fn(),
}));

vi.mock("../tauri/glossaryApi", () => ({
  glossaryList: vi.fn(),
}));

vi.mock("./postprocess/postprocessRuntimeContract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./postprocess/postprocessRuntimeContract")>();
  return {
    ...actual,
    tryBuildPostprocessRuntimeBridge: vi.fn(actual.tryBuildPostprocessRuntimeBridge),
  };
});

function seg(text: string): SegmentDto {
  return {
    idx: 0,
    start_sec: 0,
    end_sec: 1,
    text,
    low_confidence: false,
  };
}

describe("exportDocxPolish", () => {
  beforeEach(async () => {
    const actual = await vi.importActual<typeof import("./postprocess/postprocessRuntimeContract")>(
      "./postprocess/postprocessRuntimeContract",
    );
    vi.mocked(tryBuildPostprocessRuntimeBridge).mockImplementation(
      actual.tryBuildPostprocessRuntimeBridge,
    );
    vi.mocked(correctionStableRulesList).mockResolvedValue([]);
    vi.mocked(glossaryList).mockResolvedValue([]);
    vi.mocked(postprocessExportPolish).mockReset();
  });

  it("supports lecture and clean only", () => {
    expect(exportModeSupportsLlmPolish("lecture")).toBe(true);
    expect(exportModeSupportsLlmPolish("clean")).toBe(true);
    expect(exportModeSupportsLlmPolish("verbatim")).toBe(false);
  });

  it("requires the matching LLM task for fidelity and lecture optimize", () => {
    expect(exportModeRequiresLlmPolish("clean")).toBe(true);
    expect(exportModeRequiresLlmPolish("lecture")).toBe(true);
    expect(exportWantsLlmPolish("clean", false)).toBe(true);
    expect(exportWantsLlmPolish("lecture", false)).toBe(true);
    expect(exportWantsLlmPolish("lecture", true)).toBe(true);
  });

  it("joins segment text with RS (preserves in-segment newlines)", () => {
    expect(joinSegmentTextsForExportPolish([seg("a"), seg("b")])).toBe(
      `a${EXPORT_POLISH_LINE_SEPARATOR}b`,
    );
    const joined = joinSegmentTextsForExportPolish([seg("a"), seg("b\nc")]);
    expect(splitExportPolishJoinedBody(joined)).toEqual(["a", "b\nc"]);
  });

  it("uses stable segment uids and deterministic snapshot fallbacks", () => {
    const rows = [
      { ...seg("a"), uid: "stable", idx: 7 },
      { ...seg("b"), uid: "stable", idx: 8 },
      { ...seg("c"), idx: 9 },
    ];
    expect(exportPolishSnapshotUids(rows)).toEqual([
      "stable",
      "export-snapshot:1:8",
      "export-snapshot:2:9",
    ]);
  });

  it("blocks empty", () => {
    expect(resolveExportPolishBlockReason([seg("")])).toMatch(/没有可导出/);
  });

  it("ignores soft llm presentation block when runtime bridge is ready", () => {
    vi.mocked(tryBuildPostprocessRuntimeBridge).mockReturnValue({
      provider: "Ollama",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen2.5:7b",
      apiKey: "ollama",
    });
    expect(
      resolveExportPolishBlockReason([seg("正文")], "请在「LLM」探测连接。"),
    ).toBeNull();
  });

  it("applies stable rules before asking the llm for punctuation", async () => {
    vi.mocked(tryBuildPostprocessRuntimeBridge).mockReturnValue({
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      apiKey: "test-key",
    });
    vi.mocked(correctionStableRulesList).mockResolvedValue([
      { wrong: "绝关", right: "觉观", hitCount: 3, acceptedAsRule: true },
    ]);
    vi.mocked(postprocessExportPolish).mockResolvedValue({
      punctLines: ["在儿童上做觉观。"],
      contentContractValid: true,
      contractFallbackLineIndices: [],
      breakAfterLine: [0],
      provider: "DeepSeek",
      latency_ms: 1,
    });

    const result = await fetchExportPolishResult([seg("在儿童上做绝关")]);

    expect(postprocessExportPolish).toHaveBeenCalledWith(
      expect.objectContaining({ body: "在儿童上做觉观", lineCount: 1 }),
    );
    expect(result.correctedLines).toEqual(["在儿童上做觉观。"]);
    expect(result.diagnostic.llmTypoLines).toBe(0);
    expect(result.diagnostic.llmPunctLines).toBe(1);
    expect(result.diagnostic.lines[0]?.ruleChanged).toBe(true);
  });

  it("falls back the complete trusted body when the id contract is invalid", async () => {
    vi.mocked(tryBuildPostprocessRuntimeBridge).mockReturnValue({
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      apiKey: "test-key",
    });
    vi.mocked(postprocessExportPolish).mockResolvedValue({
      punctLines: ["人生前景。", "被模型改写。"],
      contentContractValid: false,
      contractFallbackLineIndices: [0, 1],
      breakAfterLine: [0],
      provider: "DeepSeek",
      latency_ms: 1,
    });

    const result = await fetchExportPolishResult([seg("留守儿童"), seg("学校很小")]);

    expect(result.correctedLines).toEqual(["留守儿童", "学校很小"]);
    expect(result.reconcileStats.paddedLineIndices).toEqual([0, 1]);
    expect(result.diagnosticHint).toContain("正文已安全回退");
    expect(result.diagnostic.llmRejectedLines).toBe(2);
  });

  it("keeps punctuation from valid batches when another batch falls back", async () => {
    vi.mocked(tryBuildPostprocessRuntimeBridge).mockReturnValue({
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      apiKey: "test-key",
    });
    vi.mocked(postprocessExportPolish).mockResolvedValue({
      punctLines: ["第一批。", "第二批"],
      contentContractValid: false,
      contractFallbackLineIndices: [1],
      breakAfterLine: [],
      provider: "DeepSeek",
      latency_ms: 1,
    });

    const result = await fetchExportPolishResult([seg("第一批"), seg("第二批")]);

    expect(result.correctedLines).toEqual(["第一批。", "第二批"]);
    expect(result.reconcileStats.paddedLineIndices).toEqual([1]);
    expect(result.diagnostic.llmPunctLines).toBe(1);
    expect(result.diagnostic.llmRejectedLines).toBe(1);
  });

  it("keeps lecture optimization rewrites and uses the dedicated task", async () => {
    vi.mocked(tryBuildPostprocessRuntimeBridge).mockReturnValue({
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      apiKey: "test-key",
    });
    vi.mocked(postprocessExportPolish).mockResolvedValue({
      punctLines: ["今天讨论这个问题。", "这个问题很重要。"],
      contentContractValid: true,
      contractFallbackLineIndices: [],
      breakAfterLine: [1],
      provider: "DeepSeek",
      latency_ms: 1,
    });

    const result = await fetchExportLectureOptimizeResult([
      seg("嗯那个我们今天说这个问题"),
      seg("这个这个问题很重要"),
    ]);

    expect(postprocessExportPolish).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "export_lecture_optimize",
        lineCount: 2,
        lineUids: ["export-snapshot:0:0", "export-snapshot:1:0"],
      }),
    );
    expect(result.strategy).toBe("lecture_optimize");
    expect(result.correctedLines).toEqual(["今天讨论这个问题。", "这个问题很重要。"]);
  });

  it("forces declared invalid lecture items back to their original text", async () => {
    vi.mocked(tryBuildPostprocessRuntimeBridge).mockReturnValue({
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      apiKey: "test-key",
    });
    vi.mocked(postprocessExportPolish).mockResolvedValue({
      punctLines: ["第一批优化。", "不应采用的改写。"],
      contentContractValid: false,
      contractFallbackLineIndices: [1],
      breakAfterLine: [],
      provider: "DeepSeek",
      latency_ms: 1,
    });

    const result = await fetchExportLectureOptimizeResult([seg("第一批"), seg("第二批原文")]);

    expect(result.correctedLines).toEqual(["第一批优化。", "第二批原文"]);
    expect(result.reconcileStats.paddedLineIndices).toEqual([1]);
  });

  it("reports rejected neighbor-context echoes", async () => {
    vi.mocked(tryBuildPostprocessRuntimeBridge).mockReturnValue({
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      apiKey: "test-key",
    });
    vi.mocked(postprocessExportPolish).mockResolvedValue({
      punctLines: ["上一段完整内容。", "当前语段原文。"],
      contentContractValid: true,
      contractFallbackLineIndices: [1],
      breakAfterLine: [],
      protocolStats: {
        omittedUnchanged: 0,
        invalidEdits: 1,
        unknownUids: 0,
        duplicateUids: 0,
        emptyEdits: 0,
        malformedEdits: 0,
        contextEchoEdits: 1,
        invalidBreakUids: 0,
        legacyResponse: false,
        sparseResponse: true,
        retriedEdits: 1,
        recoveredEdits: 0,
      },
      provider: "DeepSeek",
      latency_ms: 1,
    });

    const result = await fetchExportLectureOptimizeResult([
      seg("上一段完整内容。"),
      seg("当前语段原文。"),
    ]);

    expect(result.correctedLines).toEqual(["上一段完整内容。", "当前语段原文。"]);
    expect(result.diagnosticHint).toContain("检测到 1 次邻段内容复述，已拦截");
  });

  it("falls back the whole lecture when invalid contract metadata has no usable indices", async () => {
    vi.mocked(tryBuildPostprocessRuntimeBridge).mockReturnValue({
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      apiKey: "test-key",
    });
    vi.mocked(postprocessExportPolish).mockResolvedValue({
      punctLines: ["不可信改写一。", "不可信改写二。"],
      contentContractValid: false,
      contractFallbackLineIndices: [99],
      breakAfterLine: [],
      provider: "DeepSeek",
      latency_ms: 1,
    });

    const result = await fetchExportLectureOptimizeResult([seg("原文一"), seg("原文二")]);

    expect(result.correctedLines).toEqual(["原文一", "原文二"]);
    expect(result.reconcileStats.paddedLineIndices).toEqual([0, 1]);
  });
});
