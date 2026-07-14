import { describe, expect, it } from "vitest";
import {
  coalesceFrozenRanges,
  resolveFrozenPlaybackSkipTargetSec,
  segmentsForDeliveryExport,
} from "./frozenPlaybackSkip";

function seg(start: number, end: number, frozen = false) {
  return { start_sec: start, end_sec: end, frozen, text: "x" };
}

describe("frozenPlaybackSkip", () => {
  it("coalesces adjacent frozen ranges", () => {
    expect(
      coalesceFrozenRanges([
        seg(0, 1),
        seg(1, 2, true),
        seg(2, 3, true),
        seg(4, 5, true),
      ]),
    ).toEqual([
      { startSec: 1, endSec: 3 },
      { startSec: 4, endSec: 5 },
    ]);
  });

  it("resolves seek target inside frozen window", () => {
    const segments = [seg(0, 1), seg(1, 3, true), seg(3, 4)];
    expect(resolveFrozenPlaybackSkipTargetSec(1.5, segments)).toBe(3);
    expect(resolveFrozenPlaybackSkipTargetSec(0.5, segments)).toBeNull();
    expect(resolveFrozenPlaybackSkipTargetSec(2.9, segments)).toBe(3);
    expect(resolveFrozenPlaybackSkipTargetSec(2.99, segments)).toBeNull();
  });

  it("filters frozen from delivery export", () => {
    const rows = [seg(0, 1), seg(1, 2, true), seg(2, 3)];
    expect(segmentsForDeliveryExport(rows)).toHaveLength(2);
    expect(segmentsForDeliveryExport(rows).every((s) => !s.frozen)).toBe(true);
  });
});
