import { describe, expect, it } from "vitest";
import { segmentsHaveNonEmptyText } from "./transcribeJobHelpers";
import type { SegmentDto } from "../tauri/projectApi";

const seg = (text: string): SegmentDto => ({
  uid: "u1",
  idx: 0,
  start_sec: 0,
  end_sec: 1,
  text,
  confidence: null,
  low_confidence: false,
  detail: null,
  kind: "speech",
});

describe("segmentsHaveNonEmptyText", () => {
  it("false when empty or whitespace only", () => {
    expect(segmentsHaveNonEmptyText([])).toBe(false);
    expect(segmentsHaveNonEmptyText([seg(""), seg("  ")])).toBe(false);
  });

  it("true when any segment has text", () => {
    expect(segmentsHaveNonEmptyText([seg("hello")])).toBe(true);
  });
});
