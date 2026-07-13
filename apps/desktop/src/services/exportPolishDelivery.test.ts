import { describe, expect, it, vi } from "vitest";

vi.mock("./exportDocxPolish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./exportDocxPolish")>();
  return {
    ...actual,
    resolveExportPolishBlockReason: () => null,
  };
});
import type { ExportPolishResult } from "./exportDocxPolish";
import {
  assertExportPolishParagraphsAlignLines,
  assessExportPolishReadiness,
} from "./exportPolishDelivery";
import { fingerprintExportPolishSegments } from "./exportPolishPreviewCache";
import type { SegmentDto } from "../tauri/projectApi";

function seg(text: string): SegmentDto {
  return { idx: 0, start_sec: 0, end_sec: 1, text, low_confidence: false };
}

function mockResult(segments: SegmentDto[]): ExportPolishResult {
  return {
    paragraphs: ["A"],
    correctedLines: ["A"],
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
    segmentsFingerprint: fingerprintExportPolishSegments(segments),
    reconcileStats: {
      llmCount: 1,
      segmentCount: 1,
      paddedFromBefore: 0,
      mergedSegmentPairs: 0,
      paddedLineIndices: [],
    },
  };
}

describe("assertExportPolishParagraphsAlignLines", () => {
  it("passes when flat text matches", () => {
    expect(() =>
      assertExportPolishParagraphsAlignLines({
        ...mockResult([seg("ab")]),
        paragraphs: ["a", "b"],
        correctedLines: ["a", "b"],
      }),
    ).not.toThrow();
  });

  it("throws when paragraph flat text diverges", () => {
    expect(() =>
      assertExportPolishParagraphsAlignLines({
        ...mockResult([seg("x")]),
        paragraphs: ["xy"],
        correctedLines: ["x"],
      }),
    ).toThrow(/不一致/);
  });
});

describe("assessExportPolishReadiness", () => {
  it("allows lecture export without preview when LLM is ready", () => {
    const segments = [seg("正文")];
    const r = assessExportPolishReadiness(segments, "lecture", true);
    expect(r.canExport).toBe(true);
    expect(r.blockReason).toBeNull();
  });

  it("still allows clean export with polish when ready", () => {
    const segments = [seg("正文")];
    const r = assessExportPolishReadiness(segments, "clean", true);
    expect(r.canExport).toBe(true);
  });
});
