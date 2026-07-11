import type { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../tauri/projectTypes";
import {
  mountSpikeEditor,
  spikeSelectSegmentLine,
} from "../components/editor/core/__spike__/createSpikeEditor";

export type SpikeScrollBenchResult = {
  segmentCount: number;
  durationMs: number;
  frames: number;
  fps: number;
  gutterSamples: number;
  gutterMaxAbsDeltaPx: number;
  gutterPass: boolean;
  selectionP95Ms: number;
};

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i * 1.2,
    end_sec: i * 1.2 + 1,
    text:
      i % 11 === 0
        ? `长语段 ${i} ` + "校对内容".repeat(28)
        : `语段 ${i} 简短正文`,
  }));
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx];
}

/** Sample visible content lines vs gutter markers for vertical lockstep. */
export function measureGutterLockstep(view: EditorView): {
  samples: number;
  maxAbsDeltaPx: number;
} {
  const scroller = view.scrollDOM;
  const contentRects: { top: number; bottom: number }[] = [];
  const contentLines = scroller.querySelectorAll(".cm-content .cm-line");
  contentLines.forEach((node) => {
    const r = (node as HTMLElement).getBoundingClientRect();
    if (r.height > 0) contentRects.push({ top: r.top, bottom: r.bottom });
  });

  const gutterEls = scroller.querySelectorAll(
    ".cm-spike-meta-gutter .cm-gutterElement",
  );
  let samples = 0;
  let maxAbsDeltaPx = 0;
  gutterEls.forEach((node) => {
    const g = (node as HTMLElement).getBoundingClientRect();
    if (g.height <= 0) return;
    // Match by vertical overlap with a content line.
    let best = Number.POSITIVE_INFINITY;
    for (const c of contentRects) {
      const mid = (g.top + g.bottom) / 2;
      if (mid >= c.top - 1 && mid <= c.bottom + 1) {
        best = Math.min(best, Math.abs(g.top - c.top));
      }
    }
    if (Number.isFinite(best)) {
      samples += 1;
      maxAbsDeltaPx = Math.max(maxAbsDeltaPx, best);
    }
  });
  return { samples, maxAbsDeltaPx };
}

export async function runSpikeScrollBench(
  view: EditorView,
  opts: { durationMs?: number; gutterTolerancePx?: number } = {},
): Promise<SpikeScrollBenchResult> {
  const durationMs = opts.durationMs ?? 1500;
  const gutterTolerancePx = opts.gutterTolerancePx ?? 2;
  const scroller = view.scrollDOM;
  const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);

  // Selection latency samples interleaved with scroll.
  const selSamples: number[] = [];
  for (let i = 0; i < 40; i++) {
    const target = (i * 47) % view.state.doc.lines;
    const t0 = performance.now();
    spikeSelectSegmentLine(view, target);
    selSamples.push(performance.now() - t0);
  }
  selSamples.sort((a, b) => a - b);

  let frames = 0;
  let gutterMaxAbsDeltaPx = 0;
  let gutterSamples = 0;
  const tStart = performance.now();

  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - tStart;
      const progress = Math.min(1, elapsed / durationMs);
      scroller.scrollTop = maxScroll * progress;
      const lock = measureGutterLockstep(view);
      gutterSamples = Math.max(gutterSamples, lock.samples);
      gutterMaxAbsDeltaPx = Math.max(gutterMaxAbsDeltaPx, lock.maxAbsDeltaPx);
      if (elapsed >= durationMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const fps = frames / (durationMs / 1000);
  return {
    segmentCount: view.state.doc.lines,
    durationMs,
    frames,
    fps,
    gutterSamples,
    gutterMaxAbsDeltaPx,
    gutterPass: gutterMaxAbsDeltaPx <= gutterTolerancePx && gutterSamples > 0,
    selectionP95Ms: percentile(selSamples, 95),
  };
}

declare global {
  interface Window {
    __spikeView?: EditorView;
    __spikeBench?: () => Promise<SpikeScrollBenchResult>;
    __spikeLastResult?: SpikeScrollBenchResult;
  }
}

const host = document.getElementById("host");
const status = document.getElementById("status");
const btn = document.getElementById("btn-bench");

if (!host || !status || !btn) {
  throw new Error("spike page missing DOM nodes");
}

const SEGMENT_COUNT = 2000;
const view = mountSpikeEditor(host, makeSegments(SEGMENT_COUNT), {
  heightPx: host.clientHeight || 640,
  editContext: false,
});
window.__spikeView = view;
window.__spikeBench = async () => {
  status.textContent = "running bench…";
  const result = await runSpikeScrollBench(view);
  window.__spikeLastResult = result;
  status.textContent = JSON.stringify(result, null, 2);
  return result;
};

btn.addEventListener("click", () => {
  void window.__spikeBench?.();
});

status.textContent = `ready · ${SEGMENT_COUNT} segments · click bench or call __spikeBench()`;
