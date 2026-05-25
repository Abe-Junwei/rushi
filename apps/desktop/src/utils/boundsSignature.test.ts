import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { p1LaneBoundsSignature, waveformBoundsSignature } from "./boundsSignature";

function seg(partial: Partial<SegmentDto> & Pick<SegmentDto, "start_sec" | "end_sec">): SegmentDto {
  return {
    idx: 0,
    text: "hello",
    confidence: null,
    low_confidence: false,
    detail: null,
    ...partial,
  };
}

describe("boundsSignature", () => {
  it("p1LaneBoundsSignature ignores text edits", () => {
    const a = [seg({ start_sec: 0, end_sec: 1, text: "one" })];
    const b = [seg({ start_sec: 0, end_sec: 1, text: "two" })];
    expect(p1LaneBoundsSignature(a)).toBe(p1LaneBoundsSignature(b));
  });

  it("waveformBoundsSignature changes when low_confidence changes", () => {
    const plain = [seg({ start_sec: 0, end_sec: 1, low_confidence: false })];
    const flagged = [seg({ start_sec: 0, end_sec: 1, low_confidence: true })];
    expect(waveformBoundsSignature(plain)).not.toBe(waveformBoundsSignature(flagged));
  });
});
