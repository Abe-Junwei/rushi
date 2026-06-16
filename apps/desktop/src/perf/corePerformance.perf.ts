import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { computeSegmentListVirtualWindow } from "../utils/segmentListVirtualWindow";
import { segmentsPersistSignature } from "../pages/segmentListHelpers";

function elapsedMs(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

function makeSegments(count: number): SegmentDto[] {
  return Array.from({ length: count }, (_, idx) => ({
    idx,
    uid: `seg-${idx}`,
    start_sec: idx * 2,
    end_sec: idx * 2 + 1.5,
    text: `segment ${idx}`,
    confidence: null,
    low_confidence: false,
    detail: null,
    kind: "speech",
  }));
}

describe("core performance gates", () => {
  it("keeps virtual-window calculation comfortably sublinear", () => {
    const duration = elapsedMs(() => {
      for (let i = 0; i < 200_000; i += 1) {
        computeSegmentListVirtualWindow({
          scrollTop: (i % 10_000) * 17,
          viewportHeight: 720,
          itemStridePx: 74,
          totalCount: 50_000,
          overscan: 12,
        });
      }
    });

    expect(duration).toBeLessThan(2_000);
  });

  it("keeps dirty-state signature generation bounded for large projects", () => {
    const segments = makeSegments(5_000);
    const duration = elapsedMs(() => {
      for (let i = 0; i < 20; i += 1) {
        segmentsPersistSignature(segments);
      }
    });

    expect(duration).toBeLessThan(2_000);
  });
});
