import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { resolveSegmentIndexAtWaveformPointer } from "../utils/waveformSegmentBounds";
import { isPerfCiRunner } from "./perfCi";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    idx: i,
    start_sec: i * 0.05,
    end_sec: i * 0.05 + 0.04,
    text: `s${i}`,
  }));
}

function hitOnce(segments: SegmentDto[], timeSec: number): number {
  return resolveSegmentIndexAtWaveformPointer({
    segments,
    timeSec,
    pointerClientY: 20,
    overlayClientTop: 0,
    layoutHeightPx: 40,
    laneByIndex: segments.map(() => 0),
    laneCount: 1,
    selectedIdx: 0,
    durationSec: Math.max(1, segments.length * 0.05 + 1),
    timelineWidthPx: 4000,
  });
}

/**
 * Waveform shell hit-test must stay O(n). CI gates on wall-clock with a loose
 * budget; local runs record absolute ms for the remediation acceptance log.
 */
describe("waveform hit-test scale perf", () => {
  it("1k / 3k / 10k stay near-linear and under budget", () => {
    const sizes = [1000, 3000, 10000] as const;
    const timesMs: number[] = [];
    for (const n of sizes) {
      const segments = makeSegments(n);
      // Warm
      hitOnce(segments, 1.23);
      const t0 = performance.now();
      const iters = n >= 10000 ? 8 : 20;
      for (let i = 0; i < iters; i += 1) {
        hitOnce(segments, (i * 0.37) % (n * 0.05));
      }
      const perCall = (performance.now() - t0) / iters;
      timesMs.push(perCall);
      expect(hitOnce(segments, 0.02)).toBeGreaterThanOrEqual(0);
    }

    const [t1k, t3k, t10k] = timesMs;
    // Super-linear would make 10k >> 10× of 1k; allow noise + expand geometry cost.
    expect(t10k).toBeLessThan(t1k * 20 + 5);
    // Local target ≤10ms; CI runners get a looser budget.
    const budgetMs = isPerfCiRunner ? 40 : 12;
    expect(t10k).toBeLessThan(budgetMs);
    // Keep values visible in vitest output when diagnosing.
    expect({ t1k, t3k, t10k, budgetMs }).toBeTruthy();
  });
});
