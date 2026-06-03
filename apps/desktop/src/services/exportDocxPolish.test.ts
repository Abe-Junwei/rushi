import { describe, expect, it } from "vitest";
import { joinSegmentTextsForExportPolish } from "./exportDocxPolish.helpers";
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

  it("joins segment text", () => {
    expect(joinSegmentTextsForExportPolish([seg("a"), seg("b")])).toBe("a\nb");
  });

  it("blocks empty", () => {
    expect(resolveExportPolishBlockReason([seg("")])).toMatch(/没有可导出/);
  });
});
