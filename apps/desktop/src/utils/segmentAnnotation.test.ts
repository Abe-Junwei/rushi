import { describe, expect, it } from "vitest";
import {
  formatSegmentAnnotationPreview,
  mergeSegmentAnnotations,
  normalizeSegmentAnnotationInput,
  segmentAnnotationMenuLabel,
  segmentHasAnnotation,
} from "./segmentAnnotation";
import type { SegmentDto } from "../tauri/projectApi";

const seg = (annotation?: string | null): SegmentDto => ({
  uid: "u1",
  idx: 0,
  start_sec: 0,
  end_sec: 1,
  text: "x",
  annotation,
});

describe("segmentAnnotation", () => {
  it("segmentHasAnnotation treats blank as empty", () => {
    expect(segmentHasAnnotation(seg(null))).toBe(false);
    expect(segmentHasAnnotation(seg("  "))).toBe(false);
    expect(segmentHasAnnotation(seg("note"))).toBe(true);
  });

  it("segmentAnnotationMenuLabel switches by presence", () => {
    expect(segmentAnnotationMenuLabel(seg(null))).toBe("添加备注…");
    expect(segmentAnnotationMenuLabel(seg("n"))).toBe("编辑备注…");
  });

  it("formatSegmentAnnotationPreview collapses whitespace and truncates", () => {
    expect(formatSegmentAnnotationPreview("a\n\nb", 10)).toBe("a b");
    expect(formatSegmentAnnotationPreview("1234567890", 5)).toBe("1234…");
  });

  it("normalizeSegmentAnnotationInput trims and nulls empty", () => {
    expect(normalizeSegmentAnnotationInput("  hi  ")).toBe("hi");
    expect(normalizeSegmentAnnotationInput("   ")).toBeNull();
  });

  it("mergeSegmentAnnotations follows B5–B7 rules", () => {
    expect(mergeSegmentAnnotations(seg("L"), seg(null))).toBe("L");
    expect(mergeSegmentAnnotations(seg(null), seg("R"))).toBe("R");
    expect(mergeSegmentAnnotations(seg("L"), seg("R"))).toBe("L\n\n---\n\nR");
  });
});
