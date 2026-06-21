import { describe, expect, it } from "vitest";
import {
  EXPORT_POLISH_LINE_SEPARATOR,
  joinSegmentTextsForExportPolish,
  splitExportPolishJoinedBody,
} from "./exportDocxPolish.helpers";
import {
  exportModeSupportsLlmPolish,
  resolveExportPolishBlockReason,
} from "./exportDocxPolish";
import type { SegmentDto } from "../tauri/projectApi";

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
  it("supports lecture and clean only", () => {
    expect(exportModeSupportsLlmPolish("lecture")).toBe(true);
    expect(exportModeSupportsLlmPolish("clean")).toBe(true);
    expect(exportModeSupportsLlmPolish("verbatim")).toBe(false);
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
});
