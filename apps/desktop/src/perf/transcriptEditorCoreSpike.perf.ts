// @vitest-environment jsdom

import { describe, expect, it, afterEach } from "vitest";
import type { SegmentDto } from "../tauri/projectTypes";
import {
  mountSpikeEditor,
  spikeSelectSegmentLine,
} from "../components/editor/core/__spike__/createSpikeEditor";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 0.8,
    // Vary length so wrapping / height measurement is non-trivial.
    text:
      i % 7 === 0
        ? `长语段 ${i} ` + "内容".repeat(40)
        : `语段 ${i} 简短正文`,
  }));
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx]!;
}

describe("P0 spike perf: CM6 selection dispatch @ 2000 segments", () => {
  let root: HTMLDivElement | null = null;

  afterEach(() => {
    root?.remove();
    root = null;
  });

  it("P95 select-line dispatch stays under current listCommit baseline (400ms)", () => {
    root = document.createElement("div");
    document.body.appendChild(root);
    const segments = makeSegments(2000);
    const view = mountSpikeEditor(root, segments, { heightPx: 480, editContext: false });
    try {
      const samples: number[] = [];
      // Warm-up
      for (let i = 0; i < 20; i++) spikeSelectSegmentLine(view, i);
      // Measure
      for (let i = 0; i < 200; i++) {
        const target = (i * 17) % 2000;
        const t0 = performance.now();
        spikeSelectSegmentLine(view, target);
        samples.push(performance.now() - t0);
      }
      samples.sort((a, b) => a - b);
      const p95 = percentile(samples, 95);
      const p50 = percentile(samples, 50);
      // eslint-disable-next-line no-console
      console.log(
        `[spike-selection-latency] n=2000 samples=${samples.length} p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms max=${samples[samples.length - 1]!.toFixed(2)}ms`,
      );
      // Gate from acceptance: ≤ status quo listCommit ≈400ms; subjective target <50ms.
      expect(p95).toBeLessThanOrEqual(400);
      expect(p95).toBeLessThan(50);
    } finally {
      view.destroy();
    }
  });
});
