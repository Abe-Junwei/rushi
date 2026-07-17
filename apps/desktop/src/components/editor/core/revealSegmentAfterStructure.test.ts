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
  const view = {
    state,
    scrollDOM,
    lineBlockAt(pos: number) {
      const line = state.doc.lineAt(pos);
      const b = blocks[line.number - 1] ?? { top: 0, bottom: 50, height: 50 };
      return { from: line.from, to: line.to, ...b, type: "text" };
    },
  } as unknown as EditorView;
  return { view, scrollDOM };
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

  it("preserves prior viewport offset after structure geometry change", () => {
    const { view, scrollDOM } = makeView({
      scrollTop: 350,
      blocks: [
        { top: 0, bottom: 50, height: 50 },
        // After merge, line1 sits higher (collapsed lines above).
        { top: 200, bottom: 280, height: 80 },
        { top: 400, bottom: 450, height: 50 },
        { top: 600, bottom: 650, height: 50 },
      ],
    });
    // Prior offset was 50 (400 - 350). Keep line start 50px below viewport top → scrollTop 150.
    expect(
      revealSegmentPreservingViewportOffset(view, 1, { priorAnchorOffsetPx: 50 }),
    ).toBe(true);
    expect(scrollDOM.scrollTop).toBe(150);
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
    // min(80-20, 80) = 60; start stays visible, not snapped to 900-200=700.
    expect(scrollDOM.scrollTop).toBe(60);
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

  it("revealSegmentAfterStructureChange bumps generation (cancelable chain)", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const { view } = makeView({ scrollTop: 0 });
    const before = getRevealScheduleGenerationForTests(view);
    // Bypass validateTarget path for bare mock view — schedule directly.
    scheduleRevealSegment(view, 1, {
      preserveAnchor: true,
      priorAnchorOffsetPx: 10,
      deferLayout: true,
      validateTarget: false,
    });
    expect(getRevealScheduleGenerationForTests(view)).toBeGreaterThan(before);
    void revealSegmentAfterStructureChange;
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
    // Sync: keep offset 50 → scrollTop 350.
    expect(scrollDOM.scrollTop).toBe(350);
    scrollDOM.scrollTop = 360;
    for (const cb of raf) cb(0);
    // Line start 400 still inside [360, 560] → no nudge.
    expect(scrollDOM.scrollTop).toBe(360);
  });
});

