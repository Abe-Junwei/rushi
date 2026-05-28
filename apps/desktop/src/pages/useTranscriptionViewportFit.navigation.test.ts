import { describe, expect, it } from "vitest";
import { computeFitSelectionPxPerSec, resolveSelectionFitPxPerSec } from "../utils/pxPerSec";

describe("navigation mode fit policy", () => {
  it("mode switch uses resolve path when segment already fits at current zoom", () => {
    const w = 800;
    const seg = { start: 10, end: 12 };
    const current = 120;
    const resolved = resolveSelectionFitPxPerSec(w, seg.start, seg.end, current);
    const forced = computeFitSelectionPxPerSec(w, seg.start, seg.end);
    expect(resolved).toBe(current);
    expect(forced).toBeGreaterThan(current);
  });
});
