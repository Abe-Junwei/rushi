import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  readSegmentViewportAnchorOffsetPx,
  revealSegmentAfterStructureChange,
  revealSegmentPreservingViewportOffset,
} from "./revealSegmentAfterStructure";
import {
  cancelScheduledReveal,
  getRevealScheduleGenerationForTests,
  scheduleRevealSegment,
} from "./revealSegment";

function makeView(args?: {
  scrollTop?: number;
  clientHeight?: number;
  scrollHeight?: number;
  blocks?: Array<{ top: number; bottom: number; height: number }>;
  withRequestMeasure?: boolean;
}) {
  const state = EditorState.create({ doc: "line0\nline1\nline2\nline3" });
  const scrollDOM = document.createElement("div");
  Object.defineProperty(scrollDOM, "clientHeight", {
    configurable: true,
    value: args?.clientHeight ?? 200,
  });
  Object.defineProperty(scrollDOM, "scrollHeight", {
    configurable: true,
    value: args?.scrollHeight ?? 2000,
  });
  Object.defineProperty(scrollDOM, "scrollTop", {
    configurable: true,
    writable: true,
    value: args?.scrollTop ?? 0,
  });
  const blocks = args?.blocks ?? [
    { top: 0, bottom: 50, height: 50 },
    { top: 400, bottom: 450, height: 50 },
    { top: 800, bottom: 850, height: 50 },
    { top: 1200, bottom: 1250, height: 50 },
  ];
  const measureRequests: Array<{ read: () => unknown; write: (v: unknown) => void }> = [];
  const view = {
    state,
    scrollDOM,
    lineBlockAt(pos: number) {
      const line = state.doc.lineAt(pos);
      const b = blocks[line.number - 1] ?? { top: 0, bottom: 50, height: 50 };
      return { from: line.from, to: line.to, ...b, type: "text" };
    },
    ...(args?.withRequestMeasure
      ? {
          requestMeasure(req: { read: () => unknown; write: (v: unknown) => void }) {
            measureRequests.push(req);
          },
        }
      : {}),
  } as unknown as EditorView;
  return { view, scrollDOM, measureRequests };
}

/** Flush queued rAF callbacks (structure waitForMeasure uses nested rAF). */
function flushRafs(raf: FrameRequestCallback[]): void {
  const snapshot = [...raf];
  raf.length = 0;
  for (const cb of snapshot) cb(0);
}

describe("revealSegmentAfterStructure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("readSegmentViewportAnchorOffsetPx captures offset from scrollTop", () => {
    const { view } = makeView({ scrollTop: 350 });
    // line1 top=400 → offset 50
    expect(readSegmentViewportAnchorOffsetPx(view, 1)).toBe(50);
  });

  it("places same-primary line at viewport middle after structure change", () => {
    const { view, scrollDOM } = makeView({
      scrollTop: 350,
      clientHeight: 200,
      blocks: [
        { top: 0, bottom: 50, height: 50 },
        // After merge, line1 sits higher (collapsed lines above).
        { top: 200, bottom: 280, height: 80 },
        { top: 400, bottom: 450, height: 50 },
        { top: 600, bottom: 650, height: 50 },
      ],
    });
    // Center offset = (200 - 80) / 2 = 60 → scrollTop 200 - 60 = 140.
    // Not the prior bottom-stuck offset (50 → 150).
    expect(
      revealSegmentPreservingViewportOffset(view, 1, { priorAnchorOffsetPx: 50 }),
    ).toBe(true);
    expect(scrollDOM.scrollTop).toBe(140);
  });

  it("pins oversized merged line start instead of scrolling to bottom", () => {
    const { view, scrollDOM } = makeView({
      scrollTop: 100,
      clientHeight: 200,
      blocks: [
        { top: 80, bottom: 900, height: 820 },
        { top: 920, bottom: 970, height: 50 },
        { top: 1000, bottom: 1050, height: 50 },
        { top: 1100, bottom: 1150, height: 50 },
      ],
    });
    expect(
      revealSegmentPreservingViewportOffset(view, 0, { priorAnchorOffsetPx: 20 }),
    ).toBe(true);
    // Oversized: pin start at 80 (not center math, not bottom 900-200=700).
    expect(scrollDOM.scrollTop).toBe(80);
  });

  it("scheduleRevealSegment cancels prior generation", () => {
    const { view, scrollDOM } = makeView({ scrollTop: 0 });
    const g1 = scheduleRevealSegment(view, 1, { deferLayout: false, y: "start" });
    expect(scrollDOM.scrollTop).toBe(400);
    scrollDOM.scrollTop = 0;
    const g2 = scheduleRevealSegment(view, 2, { deferLayout: false, y: "start" });
    expect(g2).toBeGreaterThan(g1);
    expect(scrollDOM.scrollTop).toBe(800);
    cancelScheduledReveal(view);
    expect(getRevealScheduleGenerationForTests(view)).toBeGreaterThan(g2);
  });

  it("waitForMeasure does not scroll synchronously; centers after rAF", () => {
    const raf: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      raf.push(cb);
      return raf.length;
    });
    const { view, scrollDOM } = makeView({
      scrollTop: 0,
      clientHeight: 200,
      blocks: [
        { top: 0, bottom: 50, height: 50 },
        { top: 400, bottom: 480, height: 80 },
        { top: 500, bottom: 550, height: 50 },
        { top: 600, bottom: 650, height: 50 },
      ],
    });
    scheduleRevealSegment(view, 1, {
      preserveAnchor: true,
      priorAnchorOffsetPx: 50,
      waitForMeasure: true,
      validateTarget: false,
    });
    // Sync path must not move scroll (avoids CM measure fight).
    expect(scrollDOM.scrollTop).toBe(0);
    flushRafs(raf);
    // First rAF applies center: offset 60 → scrollTop 340.
    expect(scrollDOM.scrollTop).toBe(340);
    flushRafs(raf);
    // Second rAF settle: line start still in view → no further jump.
    expect(scrollDOM.scrollTop).toBe(340);
    void revealSegmentAfterStructureChange;
  });

  it("waitForMeasure schedules apply outside requestMeasure write", () => {
    const raf: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      raf.push(cb);
      return raf.length;
    });
    const { view, scrollDOM, measureRequests } = makeView({
      scrollTop: 10,
      clientHeight: 200,
      withRequestMeasure: true,
      blocks: [
        { top: 0, bottom: 50, height: 50 },
        { top: 400, bottom: 480, height: 80 },
        { top: 500, bottom: 550, height: 50 },
        { top: 600, bottom: 650, height: 50 },
      ],
    });
    scheduleRevealSegment(view, 1, {
      preserveAnchor: true,
      priorAnchorOffsetPx: 50,
      waitForMeasure: true,
      validateTarget: false,
    });
    expect(scrollDOM.scrollTop).toBe(10);
    expect(measureRequests).toHaveLength(1);
    // Measure write only queues rAF — must not scroll inside measure.
    measureRequests[0]!.write(measureRequests[0]!.read());
    expect(scrollDOM.scrollTop).toBe(10);
    flushRafs(raf);
    expect(scrollDOM.scrollTop).toBe(340);
  });

  it("revealSegmentAfterStructureChange bumps generation (cancelable chain)", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const { view } = makeView({ scrollTop: 0 });
    const before = getRevealScheduleGenerationForTests(view);
    scheduleRevealSegment(view, 1, {
      preserveAnchor: true,
      priorAnchorOffsetPx: 10,
      waitForMeasure: true,
      validateTarget: false,
    });
    expect(getRevealScheduleGenerationForTests(view)).toBeGreaterThan(before);
  });

  it("deferLayout settle skips re-scroll when line geometry is unchanged", () => {
    const raf: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      raf.push(cb);
      return raf.length;
    });
    const { view, scrollDOM } = makeView({ scrollTop: 0 });
    scheduleRevealSegment(view, 1, {
      y: "start",
      deferLayout: true,
      validateTarget: false,
    });
    expect(scrollDOM.scrollTop).toBe(400);
    scrollDOM.scrollTop = 123;
    // Geometry unchanged → settle must not overwrite user's interim scroll.
    for (const cb of raf) cb(0);
    expect(scrollDOM.scrollTop).toBe(123);
  });

  it("preserveAnchor defer does not re-scroll when line start stays in viewport", () => {
    const raf: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      raf.push(cb);
      return raf.length;
    });
    const { view, scrollDOM } = makeView({
      scrollTop: 350,
      clientHeight: 200,
      blocks: [
        { top: 0, bottom: 50, height: 50 },
        { top: 400, bottom: 480, height: 80 },
        { top: 500, bottom: 550, height: 50 },
        { top: 600, bottom: 650, height: 50 },
      ],
    });
    scheduleRevealSegment(view, 1, {
      preserveAnchor: true,
      priorAnchorOffsetPx: 50,
      deferLayout: true,
      validateTarget: false,
    });
    // Sync: viewport middle → offset 60 → scrollTop 340.
    expect(scrollDOM.scrollTop).toBe(340);
    scrollDOM.scrollTop = 360;
    for (const cb of raf) cb(0);
    // Line start 400 still inside [360, 560] → no nudge.
    expect(scrollDOM.scrollTop).toBe(360);
  });
});
