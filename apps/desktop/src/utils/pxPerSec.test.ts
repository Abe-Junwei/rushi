import { describe, expect, it } from "vitest";
import { clampPxPerSec, PX_PER_SEC_MAX, PX_PER_SEC_MIN, TIMELINE_PX_PER_SEC } from "./pxPerSec";

describe("clampPxPerSec", () => {
  it("clamps to min/max", () => {
    expect(clampPxPerSec(1)).toBe(PX_PER_SEC_MIN);
    expect(clampPxPerSec(9999)).toBe(PX_PER_SEC_MAX);
  });

  it("returns default for non-finite", () => {
    expect(clampPxPerSec(Number.NaN)).toBe(TIMELINE_PX_PER_SEC);
  });

  it("passes through in-range values", () => {
    expect(clampPxPerSec(56)).toBe(56);
    expect(clampPxPerSec(120)).toBe(120);
  });
});
