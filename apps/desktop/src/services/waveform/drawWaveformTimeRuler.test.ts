import { describe, expect, it, vi } from "vitest";
import { buildVisibleRulerTicks, computeEmbeddedRulerLabelStride } from "./waveformRulerTicks";
import {
  drawWaveformTimeRuler,
  type DrawWaveformTimeRulerInput,
  WAVEFORM_EMBEDDED_RULER_HEIGHT_PX,
} from "./drawWaveformTimeRuler";
import { effectiveTimelinePxPerSec, paddedVisibleTimeWindow, timeToTimelinePx } from "../../utils/waveformProjection";

const palette = {
  minorTick: "rgb(55, 53, 47)",
  majorTick: "rgb(55, 53, 47)",
  label: "rgb(55, 53, 47)",
  labelActive: "rgb(55, 53, 47)",
};

function makeCtx() {
  const strokeCalls: Array<{ x: number; yTop: number; yBottom: number }> = [];
  const labels: string[] = [];
  const ctx = {
    clearRect: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    font: "",
    textBaseline: "",
    beginPath: vi.fn(),
    moveTo: vi.fn((x: number, y: number) => {
      strokeCalls.push({ x, yTop: y, yBottom: 0 });
    }),
    lineTo: vi.fn((_x: number, y: number) => {
      const last = strokeCalls[strokeCalls.length - 1];
      if (last) last.yBottom = y;
    }),
    stroke: vi.fn(),
    fillText: vi.fn((text: string) => {
      labels.push(text);
    }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, strokeCalls, labels };
}

function baseInput(overrides: Partial<DrawWaveformTimeRulerInput> = {}): DrawWaveformTimeRulerInput {
  return {
    ctx: makeCtx().ctx,
    scrollLeftPx: 1000,
    viewportWidthPx: 500,
    timelineWidthPx: 2000,
    durationSec: 100,
    currentTimeSec: 50,
    formatMediaTime: (sec) => `${Math.round(sec)}`,
    interactionActive: false,
    palette,
    ...overrides,
  };
}

describe("drawWaveformTimeRuler", () => {
  it("exports embedded ruler height constant", () => {
    expect(WAVEFORM_EMBEDDED_RULER_HEIGHT_PX).toBe(22);
  });

  it("clears canvas and skips drawing when duration is zero", () => {
    const { ctx } = makeCtx();
    drawWaveformTimeRuler(baseInput({ ctx, durationSec: 0 }));
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 500, WAVEFORM_EMBEDDED_RULER_HEIGHT_PX);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("maps tick times to viewport x = timelinePx - scrollLeft", () => {
    const scrollLeftPx = 1000;
    const viewportWidthPx = 500;
    const timelineWidthPx = 2000;
    const durationSec = 100;
    const tickPxPerSec = effectiveTimelinePxPerSec(timelineWidthPx, durationSec);
    const visibleView = paddedVisibleTimeWindow({
      scrollLeftPx,
      viewportWidthPx,
      timelineWidthPx,
      durationSec,
    });
    const { ticks } = buildVisibleRulerTicks({
      durationSec,
      tickPxPerSec,
      visibleStart: visibleView.start,
      visibleEnd: visibleView.end,
    });
    const majorAt50 = ticks.find((tick) => tick.major && Math.abs(tick.t - 50) < 1e-6);
    expect(majorAt50).toBeTruthy();

    const expectedX =
      timeToTimelinePx(50, timelineWidthPx, durationSec) - scrollLeftPx;

    const { ctx, strokeCalls } = makeCtx();
    drawWaveformTimeRuler(
      baseInput({ ctx, scrollLeftPx, viewportWidthPx, timelineWidthPx, durationSec, currentTimeSec: 50 }),
    );

    const tickAt50 = strokeCalls.find((call) => Math.abs(call.x - (expectedX + 0.5)) < 0.01);
    expect(tickAt50).toBeTruthy();
  });

  it("respects embedded label stride when drawing labels", () => {
    const scrollLeftPx = 0;
    const viewportWidthPx = 800;
    const timelineWidthPx = 8000;
    const durationSec = 400;
    const tickPxPerSec = effectiveTimelinePxPerSec(timelineWidthPx, durationSec);
    const visibleView = paddedVisibleTimeWindow({
      scrollLeftPx,
      viewportWidthPx,
      timelineWidthPx,
      durationSec,
    });
    const { ticks, majorStep } = buildVisibleRulerTicks({
      durationSec,
      tickPxPerSec,
      visibleStart: visibleView.start,
      visibleEnd: visibleView.end,
    });
    const majorTicks = ticks.filter((tick) => tick.major);
    const labelStride = computeEmbeddedRulerLabelStride(true, majorStep, tickPxPerSec);
    const expectedLabels = majorTicks
      .filter((_, index) => index % labelStride === 0)
      .filter((tick) => {
        const viewportPx =
          timeToTimelinePx(tick.t, timelineWidthPx, durationSec) - scrollLeftPx;
        return viewportPx >= -4 && viewportPx <= viewportWidthPx + 4;
      })
      .map((tick) => `${Math.round(tick.t)}`);

    const { ctx, labels } = makeCtx();
    drawWaveformTimeRuler(
      baseInput({
        ctx,
        scrollLeftPx,
        viewportWidthPx,
        timelineWidthPx,
        durationSec,
        currentTimeSec: 0,
      }),
    );

    expect(labels.length).toBe(expectedLabels.length);
    expect(labels).toEqual(expectedLabels);
  });
});
