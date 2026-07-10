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
    expect(fillRectCalls).toBe(2);
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
