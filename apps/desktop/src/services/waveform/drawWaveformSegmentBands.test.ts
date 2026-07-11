import { describe, expect, it } from "vitest";
import {
  drawWaveformSegmentBands,
  findFirstSegmentIndexEndingAtOrAfter,
  findLastSegmentIndexStartingAtOrBefore,
} from "./drawWaveformSegmentBands";

describe("drawWaveformSegmentBands", () => {
  it("draws only bands intersecting the padded viewport", () => {
    let fillRectCalls = 0;
    const ctx = {
      clearRect: () => {},
      fillRect: () => {
        fillRectCalls += 1;
      },
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    const segments = Array.from({ length: 200 }, (_, i) => ({
      idx: i,
      uid: `u-${i}`,
      start_sec: i * 10,
      end_sec: i * 10 + 8,
      text: `s${i}`,
    }));

    drawWaveformSegmentBands({
      ctx,
      segments,
      scrollLeftPx: 500,
      viewportWidthPx: 800,
      timelineWidthPx: 10000,
      durationSec: 1000,
      layoutHeightPx: 96,
    });

    expect(fillRectCalls).toBeGreaterThan(0);
    expect(fillRectCalls).toBeLessThan(200);
  });

  it("skips indices in skipIndices", () => {
    let fillRectCalls = 0;
    const ctx = {
      clearRect: () => {},
      fillRect: () => {
        fillRectCalls += 1;
      },
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    drawWaveformSegmentBands({
      ctx,
      segments: [{ idx: 0, uid: "a", start_sec: 0, end_sec: 10, text: "a" }],
      scrollLeftPx: 0,
      viewportWidthPx: 800,
      timelineWidthPx: 1000,
      durationSec: 100,
      layoutHeightPx: 96,
      skipIndices: [0],
    });

    expect(fillRectCalls).toBe(0);
  });

  it("dirtyIndices only clears and paints the requested bands", () => {
    const cleared: Array<[number, number, number, number]> = [];
    let bandFillRectCalls = 0;
    const ctx = {
      clearRect: (x: number, y: number, w: number, h: number) => {
        cleared.push([x, y, w, h]);
      },
      fillRect: (_x: number, _y: number, w: number) => {
        if (w > 1) bandFillRectCalls += 1;
      },
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    const segments = Array.from({ length: 10 }, (_, i) => ({
      idx: i,
      uid: `u-${i}`,
      start_sec: i * 10,
      end_sec: i * 10 + 8,
      text: `s${i}`,
    }));

    drawWaveformSegmentBands({
      ctx,
      segments,
      scrollLeftPx: 0,
      viewportWidthPx: 1000,
      timelineWidthPx: 1000,
      durationSec: 100,
      layoutHeightPx: 96,
      dirtyIndices: [2, 3],
      selectedIdx: 3,
    });

    expect(cleared.length).toBe(2);
    expect(cleared.every((rect) => rect[2] < 1000)).toBe(true);
    expect(bandFillRectCalls).toBe(2);
  });

  it("dirtyIndices still clearRect skipped overlay-owned bands", () => {
    const cleared: Array<[number, number, number, number]> = [];
    const filled: Array<[number, number, number, number]> = [];
    const ctx = {
      clearRect: (x: number, y: number, w: number, h: number) => {
        cleared.push([x, y, w, h]);
      },
      fillRect: (x: number, y: number, w: number, h: number) => {
        filled.push([x, y, w, h]);
      },
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    // 10s @ 10px/s → selected band is [30, 80) in timeline px.
    drawWaveformSegmentBands({
      ctx,
      segments: [
        { idx: 0, uid: "a", start_sec: 0, end_sec: 3, text: "a" },
        { idx: 1, uid: "b", start_sec: 3, end_sec: 8, text: "b" },
        { idx: 2, uid: "c", start_sec: 8, end_sec: 10, text: "c" },
      ],
      scrollLeftPx: 0,
      viewportWidthPx: 100,
      timelineWidthPx: 100,
      durationSec: 10,
      layoutHeightPx: 96,
      dirtyIndices: [0, 1, 2],
      selectedIdx: 1,
      skipIndexSet: new Set([1]),
    });

    expect(cleared.some((rect) => rect[0] === 30 && rect[2] === 50)).toBe(true);
    // Neighbors paint; overlay-owned selected band is cleared but not filled.
    expect(filled.filter((rect) => rect[2] > 1)).toHaveLength(2);
    // Neighbor separators still paint under the translucent DOM overlay, so a
    // selected/overlay-owned abutting boundary does not disappear.
    expect(filled.some((rect) => rect[0] === 29 && rect[2] === 1)).toBe(true);
    expect(filled.some((rect) => rect[0] === 79 && rect[2] === 1)).toBe(true);
    expect(filled.some((rect) => rect[0] === 99 && rect[2] === 1)).toBe(true);
  });

  it("draws separators between adjacent canvas-owned segments", () => {
    const filled: Array<[number, number, number, number]> = [];
    const ctx = {
      clearRect: () => {},
      fillRect: (x: number, y: number, w: number, h: number) => {
        filled.push([x, y, w, h]);
      },
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    drawWaveformSegmentBands({
      ctx,
      segments: [
        { idx: 0, uid: "a", start_sec: 0, end_sec: 3, text: "a" },
        { idx: 1, uid: "b", start_sec: 3, end_sec: 8, text: "b" },
      ],
      scrollLeftPx: 0,
      viewportWidthPx: 100,
      timelineWidthPx: 100,
      durationSec: 10,
      layoutHeightPx: 96,
    });

    expect(filled.some((rect) => rect[0] === 29 && rect[2] === 1)).toBe(true);
  });

  it("paints abutting separators after all fills (no cover-up)", () => {
    const ops: Array<{ kind: "band" | "separator" | "clear" }> = [];
    const ctx = {
      clearRect: () => {
        ops.push({ kind: "clear" });
      },
      fillRect: (_x: number, _y: number, w: number) => {
        ops.push({ kind: w === 1 ? "separator" : "band" });
      },
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    drawWaveformSegmentBands({
      ctx,
      segments: [
        { idx: 0, uid: "a", start_sec: 0, end_sec: 3, text: "a" },
        { idx: 1, uid: "b", start_sec: 3, end_sec: 8, text: "b" },
        { idx: 2, uid: "c", start_sec: 8, end_sec: 10, text: "c" },
      ],
      scrollLeftPx: 0,
      viewportWidthPx: 100,
      timelineWidthPx: 100,
      durationSec: 10,
      layoutHeightPx: 96,
    });

    expect(ops.filter((op) => op.kind === "band")).toHaveLength(3);
    expect(ops.filter((op) => op.kind === "separator")).toHaveLength(3);
    const lastBand = ops.map((op) => op.kind).lastIndexOf("band");
    const firstSeparator = ops.findIndex((op) => op.kind === "separator");
    expect(firstSeparator).toBeGreaterThan(lastBand);
  });

  it("paints fractional-time abutting separators as a solid pixel", () => {
    const filled: Array<[number, number, number, number]> = [];
    const ctx = {
      clearRect: () => {},
      fillRect: (x: number, y: number, w: number, h: number) => {
        filled.push([x, y, w, h]);
      },
      stroke: () => {
        throw new Error("separator should not use antialiased stroke");
      },
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    drawWaveformSegmentBands({
      ctx,
      segments: [
        { idx: 0, uid: "a", start_sec: 0, end_sec: 1, text: "a" },
        { idx: 1, uid: "b", start_sec: 1, end_sec: 2, text: "b" },
      ],
      scrollLeftPx: 0,
      viewportWidthPx: 100,
      timelineWidthPx: 100,
      durationSec: 3,
      layoutHeightPx: 96,
    });

    expect(filled.some((rect) => rect[0] === 32 && rect[2] === 1)).toBe(true);
  });

  it("respects skipIndexSet the same as skipIndices (S10 external Set)", () => {
    let fillRectCalls = 0;
    const ctx = {
      clearRect: () => {},
      fillRect: () => {
        fillRectCalls += 1;
      },
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    drawWaveformSegmentBands({
      ctx,
      segments: [{ idx: 0, uid: "a", start_sec: 0, end_sec: 10, text: "a" }],
      scrollLeftPx: 0,
      viewportWidthPx: 800,
      timelineWidthPx: 1000,
      durationSec: 100,
      layoutHeightPx: 96,
      skipIndexSet: new Set([0]),
    });

    expect(fillRectCalls).toBe(0);
  });

  it("does not fill indices outside listVisibleIndexSet", () => {
    let bandFillRectCalls = 0;
    const ctx = {
      clearRect: () => {},
      fillRect: (_x: number, _y: number, w: number) => {
        if (w > 1) bandFillRectCalls += 1;
      },
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    drawWaveformSegmentBands({
      ctx,
      segments: [
        { idx: 0, uid: "a", start_sec: 0, end_sec: 5, text: "a" },
        { idx: 1, uid: "b", start_sec: 5, end_sec: 10, text: "b" },
      ],
      scrollLeftPx: 0,
      viewportWidthPx: 800,
      timelineWidthPx: 1000,
      durationSec: 100,
      layoutHeightPx: 96,
      listVisibleIndexSet: new Set([0]),
    });

    expect(bandFillRectCalls).toBe(1);
  });

  it("dirtyIndices clear filtered-out bands without filling them", () => {
    const cleared: Array<[number, number, number, number]> = [];
    let fillRectCalls = 0;
    const ctx = {
      clearRect: (x: number, y: number, w: number, h: number) => {
        cleared.push([x, y, w, h]);
      },
      fillRect: () => {
        fillRectCalls += 1;
      },
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    drawWaveformSegmentBands({
      ctx,
      segments: [{ idx: 0, uid: "a", start_sec: 0, end_sec: 10, text: "a" }],
      scrollLeftPx: 0,
      viewportWidthPx: 800,
      timelineWidthPx: 1000,
      durationSec: 100,
      layoutHeightPx: 96,
      dirtyIndices: [0],
      listVisibleIndexSet: new Set(),
    });

    expect(cleared.length).toBe(1);
    expect(fillRectCalls).toBe(0);
  });

  it("full clearRect runs when dirtyIndices is omitted (gap ghost guard)", () => {
    const cleared: Array<[number, number, number, number]> = [];
    let bandFillRectCalls = 0;
    const ctx = {
      clearRect: (x: number, y: number, w: number, h: number) => {
        cleared.push([x, y, w, h]);
      },
      fillRect: (_x: number, _y: number, w: number) => {
        if (w > 1) bandFillRectCalls += 1;
      },
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    // Two segments with a true gap (5–10s). Full paint must clear the whole
    // window so any prior idle pixels in the gap cannot survive.
    drawWaveformSegmentBands({
      ctx,
      segments: [
        { idx: 0, uid: "a", start_sec: 0, end_sec: 5, text: "a" },
        { idx: 1, uid: "b", start_sec: 10, end_sec: 15, text: "b" },
      ],
      scrollLeftPx: 0,
      viewportWidthPx: 400,
      timelineWidthPx: 1000,
      durationSec: 100,
      layoutHeightPx: 96,
    });

    expect(cleared.some((r) => r[0] === 0 && r[1] === 0 && r[2] === 400 && r[3] === 96)).toBe(
      true,
    );
    expect(bandFillRectCalls).toBe(2);
  });

  it("dirtyIndices-only path does not clear the full window (documents gap risk)", () => {
    const cleared: Array<[number, number, number, number]> = [];
    const ctx = {
      clearRect: (x: number, y: number, w: number, h: number) => {
        cleared.push([x, y, w, h]);
      },
      fillRect: () => {},
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    drawWaveformSegmentBands({
      ctx,
      segments: [
        { idx: 0, uid: "a", start_sec: 0, end_sec: 5, text: "a" },
        { idx: 1, uid: "b", start_sec: 10, end_sec: 15, text: "b" },
      ],
      scrollLeftPx: 0,
      viewportWidthPx: 400,
      timelineWidthPx: 1000,
      durationSec: 100,
      layoutHeightPx: 96,
      dirtyIndices: [0],
    });

    expect(cleared.some((r) => r[0] === 0 && r[1] === 0 && r[2] === 400)).toBe(false);
  });

  it("finds visible index window on sorted segments", () => {
    const segments = Array.from({ length: 500 }, (_, i) => ({
      idx: i,
      uid: `u-${i}`,
      start_sec: i * 10,
      end_sec: i * 10 + 8,
      text: `s${i}`,
    }));

    const from = findFirstSegmentIndexEndingAtOrAfter(segments, 500);
    const to = findLastSegmentIndexStartingAtOrBefore(segments, 700);
    expect(from).toBe(50);
    expect(to).toBe(70);
    expect(to - from).toBeLessThan(50);
  });
});
