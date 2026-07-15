import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPORT_POLISH_LINE_SEPARATOR,
  joinSegmentTextsForExportPolish,
  splitExportPolishJoinedBody,
} from "./exportDocxPolish.helpers";
import {
  estimateExportPolishSeconds,
  estimateExportPolishSecondsForSegments,
  exportModeRequiresLlmPolish,
  exportModeSupportsLlmPolish,
  exportWantsLlmPolish,
  resolveExportPolishBlockReason,
} from "./exportDocxPolish";
import type { SegmentDto } from "../tauri/projectApi";
import { tryBuildPostprocessRuntimeBridge } from "./postprocess/postprocessRuntimeContract";

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

  it("estimates polish seconds scaling with char count and loopback", () => {
    expect(estimateExportPolishSeconds(0, false)).toBe(5);
    expect(estimateExportPolishSeconds(0, true)).toBe(15);
    expect(estimateExportPolishSeconds(3_000, true)).toBe(21);
    expect(estimateExportPolishSeconds(500_000, true)).toBe(900);
    expect(estimateExportPolishSeconds(500_000, false)).toBe(180);
  });

  it("estimates polish seconds from current segments' char count", () => {
    const secs = estimateExportPolishSecondsForSegments([seg("你好"), seg("世界")]);
    expect(secs).toBeGreaterThanOrEqual(5);
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
});
