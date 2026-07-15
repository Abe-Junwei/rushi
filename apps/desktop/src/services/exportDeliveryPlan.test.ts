import { describe, expect, it, vi } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { fingerprintExportPolishSegments } from "./exportPolishPreviewCache";
import type { ExportPolishResult } from "./exportDocxPolish";

vi.mock("./exportPolishDelivery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./exportPolishDelivery")>();
  return {
    ...actual,
    assessExportPolishReadiness: vi.fn(() => ({
      canExport: true,
      blockReason: null,
    })),
  };
});

vi.mock("./postprocess/postprocessRuntimeContract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./postprocess/postprocessRuntimeContract")>();
  return {
    ...actual,
    readLlmRuntimeConfigFromStorage: vi.fn(() => ({
      providerId: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen2.5:7b",
      apiKeyId: null,
    })),
  };
});

import { planDeliveryDocxExport } from "./exportDeliveryPlan";

const segments: SegmentDto[] = [
  { uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "第一句。" },
];

function polishFor(rows: SegmentDto[]): ExportPolishResult {
  return {
    paragraphs: ["第一句。"],
    correctedLines: ["第一句。"],
    lineChanges: [],
    breakAfterLine: [],
    diagnostic: {
      lines: [],
      llmTypoLines: 0,
      llmPunctLines: 0,
      llmRejectedLines: 0,
      typoInFinal: 0,
      punctInFinal: 0,
      singleCharRulesSkipped: 0,
      acceptedSingleCharRules: 0,
    },
    diagnosticHint: null,
    segmentsFingerprint: fingerprintExportPolishSegments(rows),
    reconcileStats: {
      llmCount: 1,
      segmentCount: 1,
      paddedFromBefore: 0,
      mergedSegmentPairs: 0,
      paddedLineIndices: [],
    },
  };
}

describe("planDeliveryDocxExport", () => {
  it("allows LLM polish export with polishResult (no preview gate)", () => {
    const plan = planDeliveryDocxExport({
      request: {
        mode: "clean",
        includeRevisionAppendix: false,
        llmPolish: true,
        polishResult: polishFor(segments),
      },
      segments,
      editLogRows: [],
      currentFileId: "f1",
      exportMetaLine: undefined,
    });

    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.docxOptions.polishedParagraphs).toEqual(["第一句。"]);
      expect(plan.docxOptions.polishTrackAuthor).toBe("qwen2.5:7b");
    }
  });

  it("blocks polish export when polishResult missing", () => {
    const plan = planDeliveryDocxExport({
      request: {
        mode: "clean",
        includeRevisionAppendix: false,
        llmPolish: true,
        polishResult: null,
      },
      segments,
      editLogRows: [],
      currentFileId: "f1",
      exportMetaLine: undefined,
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.error).toMatch(/润色结果/);
    }
  });

  it("blocks clean export without polish", () => {
    const plan = planDeliveryDocxExport({
      request: {
        mode: "clean",
        includeRevisionAppendix: false,
        llmPolish: false,
      },
      segments,
      editLogRows: [],
      currentFileId: "f1",
      exportMetaLine: "meta",
    });

    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.error).toMatch(/润色结果/);
    }
  });
});
