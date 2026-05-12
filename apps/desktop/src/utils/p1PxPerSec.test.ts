import { describe, expect, it } from "vitest";
import { clampP1PxPerSec, P1_PX_PER_SEC_MAX, P1_PX_PER_SEC_MIN, P1_TIMELINE_PX_PER_SEC } from "./p1PxPerSec";

describe("clampP1PxPerSec", () => {
  it("clamps to min/max", () => {
    expect(clampP1PxPerSec(1)).toBe(P1_PX_PER_SEC_MIN);
    expect(clampP1PxPerSec(9999)).toBe(P1_PX_PER_SEC_MAX);
  });

  it("returns default for non-finite", () => {
    expect(clampP1PxPerSec(Number.NaN)).toBe(P1_TIMELINE_PX_PER_SEC);
  });

  it("passes through in-range values", () => {
    expect(clampP1PxPerSec(56)).toBe(56);
    expect(clampP1PxPerSec(120)).toBe(120);
  });
});
