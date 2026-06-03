import { describe, expect, it } from "vitest";
import type { ExportPolishResult } from "./exportDocxPolish";
import {
  clearExportPolishPreviewCache,
  fingerprintExportPolishSegments,
  getExportPolishPreviewCache,
  setExportPolishPreviewCache,
  tryAdoptExportPolishPreview,
} from "./exportPolishPreviewCache";
import type { SegmentDto } from "../tauri/projectApi";

function seg(text: string): SegmentDto {
  return { idx: 0, start_sec: 0, end_sec: 1, text, low_confidence: false };
}

function mockResult(segments: SegmentDto[]): ExportPolishResult {
  const fp = fingerprintExportPolishSegments(segments);
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
    segmentsFingerprint: fp,
    reconcileStats: {
      llmCount: 1,
      segmentCount: 1,
      paddedFromBefore: 0,
      mergedSegmentPairs: 0,
      paddedLineIndices: [],
    },
  };
}

describe("exportPolishPreviewCache", () => {
  it("stores and retrieves by segment fingerprint", () => {
    clearExportPolishPreviewCache();
    const segments = [seg("hello"), seg("world")];
    const result = mockResult(segments);
    setExportPolishPreviewCache(segments, result);
    expect(getExportPolishPreviewCache(segments)).toBe(result);
    expect(getExportPolishPreviewCache([seg("changed")])).toBeNull();
  });

  it("tryAdopt returns cache when fingerprint matches", () => {
    clearExportPolishPreviewCache();
    const segments = [seg("同一正文")];
    const result = mockResult(segments);
    setExportPolishPreviewCache(segments, result);
    expect(tryAdoptExportPolishPreview(segments, null)).toBe(result);
    expect(tryAdoptExportPolishPreview(segments, result)).toBe(result);
  });

  it("fingerprint changes when text changes", () => {
    const a = fingerprintExportPolishSegments([seg("a")]);
    const b = fingerprintExportPolishSegments([seg("b")]);
    expect(a).not.toBe(b);
  });
});
