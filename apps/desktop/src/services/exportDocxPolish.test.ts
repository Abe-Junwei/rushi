import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPORT_POLISH_LINE_SEPARATOR,
  joinSegmentTextsForExportPolish,
  splitExportPolishJoinedBody,
} from "./exportDocxPolish.helpers";
import {
  exportModeRequiresLlmPolish,
  exportModeSupportsLlmPolish,
  exportWantsLlmPolish,
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

  it("requires polish for clean", () => {
    expect(exportModeRequiresLlmPolish("clean")).toBe(true);
    expect(exportModeRequiresLlmPolish("lecture")).toBe(false);
    expect(exportWantsLlmPolish("clean", false)).toBe(true);
    expect(exportWantsLlmPolish("lecture", false)).toBe(false);
    expect(exportWantsLlmPolish("lecture", true)).toBe(true);
  });

  it("joins segment text with RS (preserves in-segment newlines)", () => {
    expect(joinSegmentTextsForExportPolish([seg("a"), seg("b")])).toBe(
      `a${EXPORT_POLISH_LINE_SEPARATOR}b`,
    );
    const joined = joinSegmentTextsForExportPolish([seg("a"), seg("b\nc")]);
    expect(splitExportPolishJoinedBody(joined)).toEqual(["a", "b\nc"]);
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
});
